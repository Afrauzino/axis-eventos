-- ============================================================================
-- 101 — PALCO ↔ MESA: botões com ETAPAS (até 3 toques) + LINK DO CELULAR — 2026-11-22
-- Idempotente. Depende do sql/100.
--
-- ETAPAS (opcional, por botão): até 2 telas de escolha antes de enviar.
--   Ex.: botão "Back" → etapa 1 "Qual problema?" [Sem retorno, Retorno alto]
--                     → etapa 2 "Qual back?"     [Ana, João, Maria]
--   = 3 toques. A mesa recebe "Back" + detalhe "Sem retorno · Ana".
--   Formato: [{"titulo":"Qual back?","opcoes":["Ana","João"]}, ...]  (máx. 2 etapas,
--   1–6 opções cada — 6 pra caber nas teclas 1–6 do pedal físico).
--
-- LINK DO CELULAR (por palco): um link só que abre no celular as DUAS funções —
--   enviar como um dos pedais (a pessoa escolhe "quem é você") e o monitor da mesa.
--   Tem o poder do link da mesa + de qualquer pedal do palco. Trate como o da mesa.
-- ============================================================================

-- ── 1. Colunas novas ─────────────────────────────────────────────────────────
alter table public.palco_botoes   add column if not exists etapas  jsonb not null default '[]'::jsonb;
alter table public.palco_chamados add column if not exists detalhe text  not null default '';
-- default volátil → o Postgres gera um token DIFERENTE pra cada palco já existente
alter table public.palco_canais   add column if not exists token_celular text not null default replace(gen_random_uuid()::text, '-', '');
create unique index if not exists palco_canais_token_celular_key on public.palco_canais(token_celular);

create or replace function public.palco_etapas_validas(e jsonb)
returns boolean
language plpgsql
immutable
set search_path to 'public'
as $function$
declare x jsonb; o jsonb;
begin
  if e is null or jsonb_typeof(e) <> 'array' or jsonb_array_length(e) > 2 then return false; end if;
  for x in select * from jsonb_array_elements(e) loop
    if jsonb_typeof(x) <> 'object' then return false; end if;
    if coalesce(jsonb_typeof(x->'titulo'), '') <> 'string' or char_length(x->>'titulo') > 40 then return false; end if;
    if coalesce(jsonb_typeof(x->'opcoes'), '') <> 'array' then return false; end if;
    if jsonb_array_length(x->'opcoes') not between 1 and 6 then return false; end if;
    for o in select * from jsonb_array_elements(x->'opcoes') loop
      if jsonb_typeof(o) <> 'string' or char_length(btrim(o #>> '{}')) not between 1 and 30 then return false; end if;
    end loop;
  end loop;
  return true;
end;
$function$;

alter table public.palco_botoes drop constraint if exists palco_botoes_etapas_chk;
alter table public.palco_botoes add constraint palco_botoes_etapas_chk check (public.palco_etapas_validas(etapas));
alter table public.palco_chamados drop constraint if exists palco_chamados_detalhe_chk;
alter table public.palco_chamados add constraint palco_chamados_detalhe_chk check (char_length(detalhe) <= 200);

-- ── 2. Núcleo interno (não exposto): registra o aperto de um pedal ───────────
create or replace function public.palco__registrar(p_pedal uuid, p_posicao integer, p_escolhas text[])
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_pedal   public.palco_pedais;
  v_botao   public.palco_botoes;
  v_atual   public.palco_chamados;
  v_qtd     integer;
  v_n       integer;
  v_detalhe text;
  i         integer;
begin
  -- trava o pedal: apertos simultâneos do mesmo aparelho entram em fila (sem duplicar)
  select p.* into v_pedal from public.palco_pedais p
    join public.palco_canais c on c.id = p.canal_id and c.ativo
   where p.id = p_pedal and p.ativo
   for update of p;
  if not found then raise exception 'pedal_invalido'; end if;

  select * into v_botao from public.palco_botoes
   where canal_id = v_pedal.canal_id and posicao = p_posicao and ativo;
  if not found then raise exception 'botao_inativo'; end if;

  -- escolhas precisam bater com as etapas configuradas (uma por etapa, opção existente)
  v_n := jsonb_array_length(v_botao.etapas);
  if coalesce(array_length(p_escolhas, 1), 0) <> v_n then raise exception 'escolha_invalida'; end if;
  for i in 0 .. v_n - 1 loop
    if p_escolhas[i + 1] is null or not ((v_botao.etapas -> i -> 'opcoes') ? p_escolhas[i + 1]) then
      raise exception 'escolha_invalida';
    end if;
  end loop;
  v_detalhe := coalesce(array_to_string(p_escolhas, ' · '), '');

  select count(*) into v_qtd from public.palco_chamados
   where pedal_id = v_pedal.id and atualizado_em > now() - interval '1 minute';
  if v_qtd >= 40 then raise exception 'limite_apertos'; end if;

  -- mesmo pedal + mesmo botão + mesmo detalhe ainda aberto → REFORÇA em vez de duplicar
  select * into v_atual from public.palco_chamados
   where pedal_id = v_pedal.id and posicao = p_posicao and detalhe = v_detalhe and status in ('aberto','visto')
   order by criado_em desc limit 1;

  if found then
    if v_atual.atualizado_em > now() - interval '1500 milliseconds' then
      return jsonb_build_object('id', v_atual.id, 'status', v_atual.status, 'repeticoes', v_atual.repeticoes, 'ignorado', true);
    end if;
    update public.palco_chamados
       set repeticoes = repeticoes + 1, status = 'aberto', visto_em = null, atualizado_em = now()
     where id = v_atual.id
     returning * into v_atual;
  else
    insert into public.palco_chamados (canal_id, pedal_id, pedal_nome, posicao, nome, mensagem, cor, detalhe)
    values (v_pedal.canal_id, v_pedal.id, v_pedal.nome, v_botao.posicao, v_botao.nome, v_botao.mensagem, v_botao.cor, v_detalhe)
    returning * into v_atual;
  end if;

  update public.palco_pedais set visto_em = now() where id = v_pedal.id;
  return jsonb_build_object('id', v_atual.id, 'status', v_atual.status, 'repeticoes', v_atual.repeticoes, 'ignorado', false);
end;
$function$;

-- Botões ativos (com etapas) de um palco
create or replace function public.palco__botoes_json(p_canal uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce(jsonb_agg(jsonb_build_object('posicao', b.posicao, 'nome', b.nome, 'mensagem', b.mensagem,
                                               'cor', b.cor, 'etapas', b.etapas) order by b.posicao), '[]'::jsonb)
    from public.palco_botoes b where b.canal_id = p_canal and b.ativo;
$function$;

-- Chamados de UM pedal (pro retorno ENVIADO / MESA VIU / RESOLVIDO no palco)
create or replace function public.palco__meus_json(p_pedal uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'posicao', c.posicao, 'status', c.status, 'detalhe', c.detalhe,
                                               'repeticoes', c.repeticoes, 'atualizado_em', c.atualizado_em)
                            order by c.criado_em), '[]'::jsonb)
    from public.palco_chamados c
   where c.pedal_id = p_pedal
     and (c.status in ('aberto','visto')
          or (c.status = 'resolvido' and c.resolvido_em > now() - interval '6 seconds'));
$function$;

-- Estado da mesa (recados abertos, recentes, pedais online)
create or replace function public.palco__mesa_json(p_canal uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  select jsonb_build_object(
    'canal', (select jsonb_build_object('id', c.id, 'nome', c.nome, 'sinal', c.sinal) from public.palco_canais c where c.id = p_canal),
    'pedais', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.nome,
                                          'online', coalesce(p.visto_em > now() - interval '45 seconds', false)) order by p.nome)
        from public.palco_pedais p where p.canal_id = p_canal and p.ativo), '[]'::jsonb),
    'abertos', coalesce((
      select jsonb_agg(to_jsonb(c) - 'canal_id' order by c.criado_em)
        from public.palco_chamados c
       where c.canal_id = p_canal and c.status in ('aberto','visto')), '[]'::jsonb),
    'recentes', coalesce((
      select jsonb_agg(to_jsonb(r) - 'canal_id' order by r.atualizado_em desc) from (
        select * from public.palco_chamados c
         where c.canal_id = p_canal and c.status in ('resolvido','cancelado')
           and c.atualizado_em > now() - interval '3 hours'
         order by c.atualizado_em desc limit 15) r), '[]'::jsonb),
    'agora', now()
  );
$function$;

revoke all on function public.palco__registrar(uuid, integer, text[]) from public, anon, authenticated;
revoke all on function public.palco__botoes_json(uuid)                from public, anon, authenticated;
revoke all on function public.palco__meus_json(uuid)                  from public, anon, authenticated;
revoke all on function public.palco__mesa_json(uuid)                  from public, anon, authenticated;

-- ── 3. PEDAL (link /ped/…) ───────────────────────────────────────────────────
create or replace function public.palco_pedal_estado(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_pedal public.palco_pedais;
  v_canal public.palco_canais;
begin
  if p_token is null or char_length(p_token) <> 32 then return null; end if;
  select * into v_pedal from public.palco_pedais where token = p_token and ativo;
  if not found then return null; end if;
  select * into v_canal from public.palco_canais where id = v_pedal.canal_id and ativo;
  if not found then return null; end if;
  if v_pedal.visto_em is null or v_pedal.visto_em < now() - interval '15 seconds' then
    update public.palco_pedais set visto_em = now() where id = v_pedal.id;
  end if;
  return jsonb_build_object(
    'pedal', jsonb_build_object('id', v_pedal.id, 'nome', v_pedal.nome),
    'canal', jsonb_build_object('nome', v_canal.nome, 'sinal', v_canal.sinal),
    'botoes', public.palco__botoes_json(v_canal.id),
    'chamados', public.palco__meus_json(v_pedal.id),
    'agora', now()
  );
end;
$function$;

drop function if exists public.palco_enviar(text, integer);
create or replace function public.palco_enviar(p_token text, p_posicao integer, p_escolhas text[] default '{}')
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_id uuid;
begin
  if p_token is null or char_length(p_token) <> 32 then raise exception 'pedal_invalido'; end if;
  select id into v_id from public.palco_pedais where token = p_token and ativo;
  if v_id is null then raise exception 'pedal_invalido'; end if;
  return public.palco__registrar(v_id, p_posicao, p_escolhas);
end;
$function$;

-- ── 4. MESA (link /mesa/… ou o link do celular) ──────────────────────────────
create or replace function public.palco_mesa_estado(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_canal uuid;
begin
  if p_token is null or char_length(p_token) <> 32 then return null; end if;
  select id into v_canal from public.palco_canais where token_mesa = p_token and ativo;
  if v_canal is null then return null; end if;
  return public.palco__mesa_json(v_canal);
end;
$function$;

create or replace function public.palco_mesa_marcar(p_token text, p_chamado uuid, p_status text)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_canal uuid;
  v_qtd   integer;
begin
  if p_status not in ('visto','resolvido') then raise exception 'status_invalido'; end if;
  if p_token is null or char_length(p_token) <> 32 then raise exception 'mesa_invalida'; end if;
  select id into v_canal from public.palco_canais where (token_mesa = p_token or token_celular = p_token) and ativo;
  if v_canal is null then raise exception 'mesa_invalida'; end if;
  if p_chamado is null and p_status <> 'resolvido' then raise exception 'status_invalido'; end if;

  update public.palco_chamados
     set status        = p_status,
         visto_em      = coalesce(visto_em, now()),
         resolvido_em  = case when p_status = 'resolvido' then now() else resolvido_em end,
         atualizado_em = now()
   where canal_id = v_canal
     and (p_chamado is null or id = p_chamado)
     and status in ('aberto','visto')
     and not (p_status = 'visto' and status = 'visto');
  get diagnostics v_qtd = row_count;
  return v_qtd;
end;
$function$;

-- ── 5. CELULAR (link /cel/…): palco + mesa no mesmo link ─────────────────────
create or replace function public.palco_cel_estado(p_token text, p_pedal uuid default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_canal uuid;
  v_pedal public.palco_pedais;
  v_meus  jsonb := '[]'::jsonb;
begin
  if p_token is null or char_length(p_token) <> 32 then return null; end if;
  select id into v_canal from public.palco_canais where token_celular = p_token and ativo;
  if v_canal is null then return null; end if;
  if p_pedal is not null then
    select * into v_pedal from public.palco_pedais where id = p_pedal and canal_id = v_canal and ativo;
    if found then
      if v_pedal.visto_em is null or v_pedal.visto_em < now() - interval '15 seconds' then
        update public.palco_pedais set visto_em = now() where id = v_pedal.id;
      end if;
      v_meus := public.palco__meus_json(v_pedal.id);
    end if;
  end if;
  return public.palco__mesa_json(v_canal)
      || jsonb_build_object('botoes', public.palco__botoes_json(v_canal), 'meus', v_meus);
end;
$function$;

create or replace function public.palco_cel_enviar(p_token text, p_pedal uuid, p_posicao integer, p_escolhas text[] default '{}')
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_ok boolean;
begin
  if p_token is null or char_length(p_token) <> 32 then raise exception 'pedal_invalido'; end if;
  select true into v_ok
    from public.palco_canais c join public.palco_pedais p on p.canal_id = c.id
   where c.token_celular = p_token and c.ativo and p.id = p_pedal and p.ativo;
  if v_ok is null then raise exception 'pedal_invalido'; end if;
  return public.palco__registrar(p_pedal, p_posicao, p_escolhas);
end;
$function$;

create or replace function public.palco_cel_cancelar(p_token text, p_chamado uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_qtd integer;
begin
  update public.palco_chamados ch
     set status = 'cancelado', atualizado_em = now()
    from public.palco_canais c
   where c.token_celular = p_token and c.ativo and ch.canal_id = c.id
     and ch.id = p_chamado and ch.status in ('aberto','visto');
  get diagnostics v_qtd = row_count;
  return v_qtd > 0;
end;
$function$;

-- ── 6. Novo link (agora também do celular) ───────────────────────────────────
create or replace function public.palco_novo_token(p_tipo text, p_id uuid)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_tok text := replace(gen_random_uuid()::text, '-', '');
begin
  if not public.pode_algum(array['palco:editar']) then raise exception 'sem_permissao'; end if;
  if p_tipo = 'mesa' then
    update public.palco_canais set token_mesa = v_tok where id = p_id;
  elsif p_tipo = 'celular' then
    update public.palco_canais set token_celular = v_tok where id = p_id;
  elsif p_tipo = 'pedal' then
    update public.palco_pedais set token = v_tok where id = p_id;
  else
    raise exception 'tipo_invalido';
  end if;
  if not found then raise exception 'nao_encontrado'; end if;
  return v_tok;
end;
$function$;

revoke all on function public.palco_enviar(text, integer, text[])            from public;
revoke all on function public.palco_cel_estado(text, uuid)                   from public;
revoke all on function public.palco_cel_enviar(text, uuid, integer, text[])  from public;
revoke all on function public.palco_cel_cancelar(text, uuid)                 from public;
grant execute on function public.palco_enviar(text, integer, text[])           to anon, authenticated;
grant execute on function public.palco_cel_estado(text, uuid)                  to anon, authenticated;
grant execute on function public.palco_cel_enviar(text, uuid, integer, text[]) to anon, authenticated;
grant execute on function public.palco_cel_cancelar(text, uuid)                to anon, authenticated;
grant execute on function public.palco_pedal_estado(text)                      to anon, authenticated;
grant execute on function public.palco_mesa_estado(text)                       to anon, authenticated;
grant execute on function public.palco_mesa_marcar(text, uuid, text)           to anon, authenticated;
grant execute on function public.palco_novo_token(text, uuid)                  to authenticated;
