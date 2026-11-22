-- ============================================================================
-- 102 — PALCO ↔ MESA: configurar pela MESA DE SOM (sem login) — 2026-11-22
-- Idempotente. Depende do sql/100 e 101.
--
-- O técnico da mesa configura tudo pelo próprio link (/mesa ou /cel):
--   • botões: nome, recado, cor, ativo, etapas;
--   • pedais: criar, renomear, ativar/desativar, excluir, gerar novo link.
-- Quem tem o link da mesa (ou do celular) já é o "operador" daquele palco. O link
-- de um PEDAL não configura nada. O link da mesa NÃO consegue trocar o próprio link
-- nem o do celular (isso continua só em /palco, com login) — evita se trancar fora.
-- ============================================================================

-- canal do token de operador (mesa ou celular); null se inválido
create or replace function public.palco__canal_operador(p_token text)
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $function$
  select id from public.palco_canais
   where p_token is not null and char_length(p_token) = 32
     and (token_mesa = p_token or token_celular = p_token) and ativo
   limit 1;
$function$;
revoke all on function public.palco__canal_operador(text) from public, anon, authenticated;

-- Tudo o que o painel ⚙️ precisa: palco, os 6 botões (inclusive inativos) e os pedais com link
create or replace function public.palco_mesa_config(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_canal uuid := public.palco__canal_operador(p_token);
begin
  if v_canal is null then return null; end if;
  return jsonb_build_object(
    'canal', (select jsonb_build_object('nome', c.nome) from public.palco_canais c where c.id = v_canal),
    'botoes', coalesce((select jsonb_agg(jsonb_build_object('posicao', b.posicao, 'nome', b.nome, 'mensagem', b.mensagem,
                                         'cor', b.cor, 'ativo', b.ativo, 'etapas', b.etapas) order by b.posicao)
                          from public.palco_botoes b where b.canal_id = v_canal), '[]'::jsonb),
    'pedais', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.nome, 'ativo', p.ativo, 'token', p.token,
                                         'online', coalesce(p.visto_em > now() - interval '45 seconds', false)) order by p.created_at)
                          from public.palco_pedais p where p.canal_id = v_canal), '[]'::jsonb)
  );
end;
$function$;

-- Salva (ou cria) o botão da posição. Validação de formato fica nas constraints da tabela.
create or replace function public.palco_mesa_salvar_botao(
  p_token text, p_posicao integer, p_nome text, p_mensagem text, p_cor text, p_ativo boolean, p_etapas jsonb default '[]'::jsonb)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_canal uuid := public.palco__canal_operador(p_token);
begin
  if v_canal is null then raise exception 'mesa_invalida'; end if;
  if p_posicao is null or p_posicao not between 1 and 6 then raise exception 'posicao_invalida'; end if;
  insert into public.palco_botoes (canal_id, posicao, nome, mensagem, cor, ativo, etapas)
  values (v_canal, p_posicao, btrim(p_nome), btrim(coalesce(p_mensagem, '')), p_cor, coalesce(p_ativo, true), coalesce(p_etapas, '[]'::jsonb))
  on conflict (canal_id, posicao) do update
     set nome = excluded.nome, mensagem = excluded.mensagem, cor = excluded.cor,
         ativo = excluded.ativo, etapas = excluded.etapas;
  return true;
end;
$function$;

-- Pedais: p_acao = criar | renomear | ativar | desativar | excluir | novo_link
create or replace function public.palco_mesa_pedal(p_token text, p_acao text, p_id uuid default null, p_nome text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_canal uuid := public.palco__canal_operador(p_token);
  v_qtd   integer;
  v_ped   public.palco_pedais;
begin
  if v_canal is null then raise exception 'mesa_invalida'; end if;

  if p_acao = 'criar' then
    select count(*) into v_qtd from public.palco_pedais where canal_id = v_canal;
    if v_qtd >= 30 then raise exception 'limite_pedais'; end if;
    insert into public.palco_pedais (canal_id, nome) values (v_canal, btrim(coalesce(p_nome, ''))) returning * into v_ped;
    return jsonb_build_object('id', v_ped.id, 'token', v_ped.token);
  end if;

  -- demais ações: o pedal tem que ser DESTE palco
  if p_id is null or not exists (select 1 from public.palco_pedais where id = p_id and canal_id = v_canal) then
    raise exception 'pedal_invalido';
  end if;

  if p_acao = 'renomear' then
    update public.palco_pedais set nome = btrim(coalesce(p_nome, '')) where id = p_id;
  elsif p_acao = 'ativar' then
    update public.palco_pedais set ativo = true where id = p_id;
  elsif p_acao = 'desativar' then
    update public.palco_pedais set ativo = false where id = p_id;
  elsif p_acao = 'excluir' then
    delete from public.palco_pedais where id = p_id;
  elsif p_acao = 'novo_link' then
    update public.palco_pedais set token = replace(gen_random_uuid()::text, '-', '') where id = p_id returning * into v_ped;
    return jsonb_build_object('id', v_ped.id, 'token', v_ped.token);
  else
    raise exception 'acao_invalida';
  end if;
  return jsonb_build_object('id', p_id);
end;
$function$;

revoke all on function public.palco_mesa_config(text) from public;
revoke all on function public.palco_mesa_salvar_botao(text, integer, text, text, text, boolean, jsonb) from public;
revoke all on function public.palco_mesa_pedal(text, text, uuid, text) from public;
grant execute on function public.palco_mesa_config(text) to anon, authenticated;
grant execute on function public.palco_mesa_salvar_botao(text, integer, text, text, text, boolean, jsonb) to anon, authenticated;
grant execute on function public.palco_mesa_pedal(text, text, uuid, text) to anon, authenticated;
