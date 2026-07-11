-- ============================================================================
-- 64_limpeza_sistema.sql — Faxina de DADOS MORTOS (registros órfãos)
-- ----------------------------------------------------------------------------
-- O que é "dado morto": um registro que aponta pra algo que NÃO EXISTE mais.
-- Ex.: você excluiu uma pessoa, mas sobrou o vínculo dela numa equipe.
--
-- SEGURANÇA (o pedido do Anderson): o botão NUNCA apaga dado vivo.
--   - Só apaga linhas em que o "pai" comprovadamente sumiu (NOT EXISTS no banco).
--   - A conta é feita no próprio banco (SQL real), não no app — sem risco de
--     "achar que sumiu" por causa de permissão/RLS.
--   - Só admin/pastor roda. Rodar de novo é seguro (não sobra nada e não quebra).
--
-- Duas funções: analisar_orfaos() (só conta, mostra tudo) e limpar_orfaos()
-- (apaga e devolve quanto apagou). O app chama as duas.
--
-- Rode no Supabase (SQL Editor). Pode rodar de novo.
-- ============================================================================

-- Helper: conta órfãos de um vínculo filho(coluna) -> pai(coluna).
-- Retorna 0 se a tabela/coluna não existir (à prova de schema diferente).
create or replace function public._orfaos_count(
  p_child text, p_childcol text, p_parent text, p_parentcol text
) returns bigint
language plpgsql stable security definer set search_path = public as $$
declare n bigint;
begin
  if to_regclass('public.'||p_child) is null or to_regclass('public.'||p_parent) is null then return 0; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name=p_child  and column_name=p_childcol)  then return 0; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name=p_parent and column_name=p_parentcol) then return 0; end if;
  execute format(
    'select count(*) from public.%I c where c.%I is not null and not exists (select 1 from public.%I p where p.%I = c.%I)',
    p_child, p_childcol, p_parent, p_parentcol, p_childcol
  ) into n;
  return coalesce(n,0);
end $$;

-- Helper: APAGA os órfãos (mesma condição do count). Retorna quantos apagou.
create or replace function public._orfaos_delete(
  p_child text, p_childcol text, p_parent text, p_parentcol text
) returns bigint
language plpgsql security definer set search_path = public as $$
declare n bigint;
begin
  if to_regclass('public.'||p_child) is null or to_regclass('public.'||p_parent) is null then return 0; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name=p_child  and column_name=p_childcol)  then return 0; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name=p_parent and column_name=p_parentcol) then return 0; end if;
  execute format(
    'delete from public.%I c where c.%I is not null and not exists (select 1 from public.%I p where p.%I = c.%I)',
    p_child, p_childcol, p_parent, p_parentcol, p_childcol
  );
  get diagnostics n = row_count;
  return coalesce(n,0);
end $$;

-- Os helpers recebem nome de tabela por parâmetro → NUNCA podem ser chamados
-- direto pelo app (senão dava pra mandar apagar qualquer coisa). Só as funções
-- de baixo (que rodam como dono e checam admin) podem usá-los.
revoke all on function public._orfaos_count(text,text,text,text)  from public;
revoke all on function public._orfaos_delete(text,text,text,text) from public;

-- Lista fixa e auditável do que conta como "morto". child, childcol, parent, parentcol.
-- (Se alguma tabela/coluna não existir aqui, o helper devolve 0 e ignora.)
create or replace function public._orfaos_lista()
returns table(categoria text, child text, childcol text, parent text, parentcol text)
language sql immutable set search_path = public as $$
  select * from (values
    ('Vínculos de equipe sem a pessoa',        'people_teams','person_id','people','id'),
    ('Vínculos de equipe sem a equipe',        'people_teams','team_id','teams','id'),
    ('Escalas sem a pessoa',                   'escalas','person_id','people','id'),
    ('Escalas sem a equipe',                   'escalas','team_id','teams','id'),
    ('Pagamentos sem a pessoa',                'financeiro','person_id','people','id'),
    ('Doações sem a pessoa',                   'doacoes','person_id','people','id'),
    ('Elenco de teatro sem o teatro',          'teatro_elenco','theater_id','theaters','id'),
    ('Elenco de teatro sem a pessoa',          'teatro_elenco','person_id','people','id'),
    ('Fichas médicas sem a pessoa',            'saude_fichas','person_id','people','id'),
    ('Agenda de remédios sem a pessoa',        'med_agenda','person_id','people','id'),
    ('Remédios controlados sem a pessoa',      'med_controlados','person_id','people','id'),
    ('Permissões sem a pessoa',                'permissoes','person_id','people','id'),
    ('Permissões sem a equipe',                'permissoes','team_id','teams','id'),
    ('Votos de ranking sem a pessoa',          'ranking_votos','votado_id','people','id'),
    ('Votos de ranking sem a categoria',       'ranking_votos','categoria_id','ranking_categorias','id'),
    ('Correio: checklist sem a pessoa',        'correio_checklist_status','afiliado_id','people','id'),
    ('Correio: checklist sem o item',          'correio_checklist_status','item_id','correio_checklist_itens','id'),
    ('Correio: situação sem a pessoa',         'correio_afiliado_status','afiliado_id','people','id'),
    ('Cozinha: conclusões sem a pessoa',       'cozinha_conclusoes','person_id','people','id'),
    ('Cozinha: conclusões sem o cardápio',     'cozinha_conclusoes','cardapio_id','cozinha_cardapios','id'),
    ('Avisos da liderança sem destinatário',   'alertas_lideres_dest','destinatario_id','people','id')
  ) as t(categoria, child, childcol, parent, parentcol);
$$;

-- Checa se quem chamou é admin/pastor. Levanta erro se não for.
create or replace function public._exige_admin()
returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.profiles
    where user_id = auth.uid() and (is_admin = true or user_role in ('admin','pastor'))
  ) then
    raise exception 'Somente administradores podem fazer a limpeza do sistema.';
  end if;
end $$;
revoke all on function public._exige_admin() from public;

-- ANALISAR: devolve [{categoria, tabela, quantidade}] só do que tem órfão.
create or replace function public.analisar_orfaos()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r record; out jsonb := '[]'::jsonb; c bigint;
begin
  perform public._exige_admin();
  for r in select * from public._orfaos_lista() loop
    c := public._orfaos_count(r.child, r.childcol, r.parent, r.parentcol);
    if c > 0 then
      out := out || jsonb_build_array(jsonb_build_object('categoria', r.categoria, 'tabela', r.child, 'quantidade', c));
    end if;
  end loop;
  return out;
end $$;

-- LIMPAR: apaga tudo que analisar mostraria e devolve [{categoria, tabela, removidos}].
create or replace function public.limpar_orfaos()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare r record; out jsonb := '[]'::jsonb; c bigint;
begin
  perform public._exige_admin();
  for r in select * from public._orfaos_lista() loop
    c := public._orfaos_delete(r.child, r.childcol, r.parent, r.parentcol);
    if c > 0 then
      out := out || jsonb_build_array(jsonb_build_object('categoria', r.categoria, 'tabela', r.child, 'removidos', c));
    end if;
  end loop;
  return out;
end $$;

grant execute on function public.analisar_orfaos() to authenticated;
grant execute on function public.limpar_orfaos()   to authenticated;

notify pgrst, 'reload schema';
