-- ============================================================================
-- 103 — CONTRATO por evento + salvar a configuração da inscrição (2026-10-20)
--
-- • Além dos TERMOS (texto por tipo, em Administração), cada evento tem o seu
--   CONTRATO (valores, regras de pagamento/desistência…). A pessoa lê os dois e
--   assina uma vez; o aceite guarda cópia dos dois textos + hash combinado.
-- • Desde o sql/98 (RLS por módulo) só "Administração: editar" altera `events`.
--   O financeiro configura Pix/parcelas/contrato pela função salvar_config_inscricao,
--   que libera admin, Administração:editar ou Financeiro:editar.
-- Idempotente. Depende do sql/102.
-- ============================================================================

alter table public.events            add column if not exists contrato       text;
alter table public.inscricao_aceites add column if not exists contrato_texto text;

create or replace function public._inscricao_resumo(p_person uuid)
returns json
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  pe record; ev record; ac record;
  v_total numeric; v_pago numeric; v_termo text; v_contrato text;
begin
  select id, name, role_type, event_id, user_id into pe from people where id = p_person;
  if pe.id is null then raise exception 'Cadastro não encontrado.'; end if;
  select * into ev from events where id = pe.event_id;

  v_total := coalesce(case when pe.role_type = 'worker' then ev.valor_encontreiro else ev.valor_encontrista end, 0);
  select coalesce(sum(valor), 0) into v_pago from financeiro where person_id = pe.id and status = 'pago';
  select valor into v_termo from configuracoes
   where chave = case when pe.role_type = 'worker' then 'termo_encontreiro' else 'termo_encontrista' end;
  v_termo    := replace(coalesce(v_termo, ''), '{{nome}}', pe.name);
  v_contrato := replace(coalesce(ev.contrato, ''), '{{nome}}', pe.name);
  select * into ac from inscricao_aceites where person_id = pe.id and event_id = pe.event_id;

  return json_build_object(
    'pessoa',  json_build_object('id', pe.id, 'nome', pe.name, 'role_type', pe.role_type),
    'evento',  json_build_object('id', ev.id, 'nome', ev.name, 'inicio', ev.start_date, 'fim', ev.end_date),
    'termo',   v_termo,
    'contrato', v_contrato,
    'texto_hash', md5(v_termo || E'\n\n' || v_contrato),
    'valor_total', v_total,
    'pago',    v_pago,
    'falta',   greatest(v_total - v_pago, 0),
    'parcelas_max',   greatest(coalesce(ev.parcelas_max, 1), 1),
    'entrada_minima', least(coalesce(ev.entrada_minima, 0), v_total),
    'pix', case when coalesce(ev.pix_chave, '') = '' then null else json_build_object(
             'chave', ev.pix_chave, 'tipo', ev.pix_tipo, 'nome', ev.pix_nome, 'cidade', ev.pix_cidade) end,
    'aceite', case when ac.id is null then null else json_build_object(
             'parcelas', ac.parcelas, 'entrada', ac.entrada, 'valor_total', ac.valor_total,
             'aceito_em', ac.aceito_em, 'origem', ac.origem, 'assinatura_path', ac.assinatura_path) end,
    'responsaveis', coalesce((select json_agg(json_build_object(
             'nome', r.nome, 'whatsapp', r.whatsapp, 'funcao', r.funcao, 'descricao', r.descricao)
             order by (r.funcao <> 'financeiro'), r.ordem, r.nome)
           from evento_responsaveis r
           where r.event_id = ev.id and r.publico in ('todos', pe.role_type)), '[]'::json)
  );
end;
$function$;

create or replace function public._inscricao_registrar_aceite(
  p_person uuid, p_parcelas int, p_entrada numeric, p_assinatura_path text,
  p_origem text default 'axis', p_user_agent text default null)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  r json; pe record; v_total numeric; v_max int; v_min numeric; v_entrada numeric;
begin
  select id, event_id, user_id, role_type into pe from people where id = p_person;
  if pe.id is null then raise exception 'Cadastro não encontrado.'; end if;
  if exists (select 1 from inscricao_aceites where person_id = pe.id and event_id = pe.event_id) then
    raise exception 'O termo deste evento já foi assinado.';
  end if;
  if coalesce(p_assinatura_path, '') <> pe.event_id::text || '/' || pe.id::text || '.png' then
    raise exception 'Assinatura inválida.';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'assinaturas' and name = p_assinatura_path) then
    raise exception 'A assinatura não foi enviada. Tente de novo.';
  end if;

  r := _inscricao_resumo(p_person);
  v_total := (r->>'valor_total')::numeric;
  v_max   := (r->>'parcelas_max')::int;
  v_min   := (r->>'entrada_minima')::numeric;

  if p_parcelas is null or p_parcelas < 1 or p_parcelas > v_max then
    raise exception 'Escolha entre 1 e % parcela(s).', v_max;
  end if;
  if p_parcelas = 1 then
    v_entrada := v_total;
  else
    v_entrada := round(coalesce(p_entrada, 0), 2);
    if v_entrada < v_min then raise exception 'A entrada mínima é R$ %.', to_char(v_min, 'FM999G990D00'); end if;
    if v_entrada > v_total then raise exception 'A entrada não pode passar do valor total.'; end if;
  end if;

  insert into inscricao_aceites (event_id, person_id, user_id, role_type, termo_texto, contrato_texto, termo_hash,
                                 valor_total, parcelas, entrada, assinatura_path, origem, user_agent)
  values (pe.event_id, pe.id, pe.user_id, pe.role_type, r->>'termo', r->>'contrato', r->>'texto_hash',
          v_total, p_parcelas, v_entrada, p_assinatura_path,
          case when p_origem = 'koinonia' then 'koinonia' else 'axis' end, left(p_user_agent, 300));

  return _inscricao_resumo(p_person);
end;
$function$;

revoke all on function public._inscricao_resumo(uuid) from public, anon, authenticated;
revoke all on function public._inscricao_registrar_aceite(uuid, int, numeric, text, text, text) from public, anon, authenticated;
grant execute on function public._inscricao_resumo(uuid) to service_role;
grant execute on function public._inscricao_registrar_aceite(uuid, int, numeric, text, text, text) to service_role;

-- Financeiro salva Pix / parcelas / contrato do evento
create or replace function public.salvar_config_inscricao(p_event uuid, p jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then raise exception 'Sem usuário logado.'; end if;
  if not (is_admin() or pode_algum(array['financeiro:editar', 'menu_admin:editar'])) then
    raise exception 'Sem permissão para configurar a inscrição.';
  end if;
  update events set
    pix_tipo       = case when p ? 'pix_tipo'       then nullif(p->>'pix_tipo', '')       else pix_tipo end,
    pix_chave      = case when p ? 'pix_chave'      then nullif(trim(p->>'pix_chave'), '')  else pix_chave end,
    pix_nome       = case when p ? 'pix_nome'       then nullif(trim(p->>'pix_nome'), '')   else pix_nome end,
    pix_cidade     = case when p ? 'pix_cidade'     then nullif(trim(p->>'pix_cidade'), '') else pix_cidade end,
    parcelas_max   = case when p ? 'parcelas_max'   then greatest(1, (p->>'parcelas_max')::int) else parcelas_max end,
    entrada_minima = case when p ? 'entrada_minima' then greatest(0, (p->>'entrada_minima')::numeric) else entrada_minima end,
    contrato       = case when p ? 'contrato'       then nullif(p->>'contrato', '')       else contrato end
  where id = p_event;
  if not found then raise exception 'Evento não encontrado.'; end if;
end;
$function$;
revoke all on function public.salvar_config_inscricao(uuid, jsonb) from public, anon;
grant execute on function public.salvar_config_inscricao(uuid, jsonb) to authenticated, service_role;
