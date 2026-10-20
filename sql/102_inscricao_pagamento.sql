-- ============================================================================
-- 102 (antes "98") — Inscrição com TERMO ASSINADO À MÃO + PIX POR EVENTO + PARCELAS (2026-10-20)
--
-- • Todo cadastro, em TODO evento (mesmo quem já participou de outros), assina o
--   termo do evento com o dedo no celular. Fica guardado: texto exato aceito,
--   valor, plano de parcelas, assinatura (PNG), data/hora, origem (axis/koinonia).
-- • Pix configurado POR EVENTO pelo financeiro + parcelas (quantas precisar) com
--   entrada mínima. O app gera o "Pix copia e cola"/QR com o valor da parcela.
-- • Responsáveis do evento (financeiro e outros) com WhatsApp.
-- • O banco do AXIS é a fonte única: o AXIS e o Koinonia leem/gravam pelas MESMAS
--   funções (_inscricao_*), então os dois apps sempre sabem o que foi feito.
-- Idempotente.
-- ============================================================================

-- ── 1. Configuração do evento ─────────────────────────────────────────────────
alter table public.events add column if not exists pix_chave      text;
alter table public.events add column if not exists pix_tipo       text;   -- cpf | cnpj | email | telefone | aleatoria
alter table public.events add column if not exists pix_nome       text;   -- nome de quem recebe (até 25 letras no Pix)
alter table public.events add column if not exists pix_cidade     text;   -- cidade de quem recebe (até 15 letras no Pix)
alter table public.events add column if not exists parcelas_max   int     not null default 1;
alter table public.events add column if not exists entrada_minima numeric not null default 0;

-- ── 2. Responsáveis do evento (WhatsApp) ──────────────────────────────────────
create table if not exists public.evento_responsaveis (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events(id) on delete cascade,
  nome       text not null,
  whatsapp   text not null,
  funcao     text not null default 'financeiro',   -- financeiro | geral | outro
  descricao  text,                                  -- ex.: "Dúvidas sobre transporte"
  publico    text not null default 'todos' check (publico in ('todos','encounterer','worker')),
  ordem      int  not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists evento_responsaveis_event_idx on public.evento_responsaveis(event_id);
alter table public.evento_responsaveis enable row level security;
drop policy if exists er_sel on public.evento_responsaveis;
create policy er_sel on public.evento_responsaveis for select to authenticated using (true);
drop policy if exists er_ins on public.evento_responsaveis;
create policy er_ins on public.evento_responsaveis for insert to authenticated
  with check (public.is_admin() or public.tem_permissao('financeiro','editar'));
drop policy if exists er_upd on public.evento_responsaveis;
create policy er_upd on public.evento_responsaveis for update to authenticated
  using (public.is_admin() or public.tem_permissao('financeiro','editar'))
  with check (public.is_admin() or public.tem_permissao('financeiro','editar'));
drop policy if exists er_del on public.evento_responsaveis;
create policy er_del on public.evento_responsaveis for delete to authenticated
  using (public.is_admin() or public.tem_permissao('financeiro','editar'));

-- ── 3. Aceite assinado (1 por pessoa por evento — nunca reaproveita) ──────────
create table if not exists public.inscricao_aceites (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references public.events(id) on delete cascade,
  person_id       uuid not null references public.people(id) on delete cascade,
  user_id         uuid,
  role_type       text,
  termo_texto     text not null,         -- cópia EXATA do termo aceito
  termo_hash      text not null,         -- md5 do texto (prova de que não mudou)
  valor_total     numeric not null,
  parcelas        int not null,
  entrada         numeric not null,
  assinatura_path text not null,         -- storage: assinaturas/{event_id}/{person_id}.png
  origem          text not null default 'axis' check (origem in ('axis','koinonia')),
  user_agent      text,
  aceito_em       timestamptz not null default now(),
  unique (event_id, person_id)
);
alter table public.inscricao_aceites enable row level security;
-- Leitura: a própria pessoa, admin, financeiro e cadastros. Gravação SÓ pelas funções.
drop policy if exists ia_sel on public.inscricao_aceites;
create policy ia_sel on public.inscricao_aceites for select to authenticated using (
  user_id = auth.uid() or public.is_admin()
  or public.tem_permissao('financeiro','ver') or public.tem_permissao('cadastros','ver'));
drop policy if exists ia_del on public.inscricao_aceites;
create policy ia_del on public.inscricao_aceites for delete to authenticated using (public.is_admin());

-- ── 4. Assinaturas (bucket PRIVADO) ───────────────────────────────────────────
insert into storage.buckets (id, name, public) values ('assinaturas', 'assinaturas', false)
  on conflict (id) do nothing;
drop policy if exists assinaturas_ins on storage.objects;
create policy assinaturas_ins on storage.objects for insert to authenticated with check (
  bucket_id = 'assinaturas' and exists (
    select 1 from public.people pe where pe.user_id = auth.uid()
      and storage.objects.name = pe.event_id::text || '/' || pe.id::text || '.png'));
drop policy if exists assinaturas_upd on storage.objects;
create policy assinaturas_upd on storage.objects for update to authenticated using (
  bucket_id = 'assinaturas' and exists (
    select 1 from public.people pe where pe.user_id = auth.uid()
      and storage.objects.name = pe.event_id::text || '/' || pe.id::text || '.png'));
drop policy if exists assinaturas_sel on storage.objects;
create policy assinaturas_sel on storage.objects for select to authenticated using (
  bucket_id = 'assinaturas' and (
    public.is_admin() or public.tem_permissao('financeiro','ver') or public.tem_permissao('cadastros','ver')
    or exists (select 1 from public.people pe where pe.user_id = auth.uid()
               and storage.objects.name = pe.event_id::text || '/' || pe.id::text || '.png')));

-- ── 5. Núcleo (sem checagem de quem chama — só service_role / funções abaixo) ──
-- Resumo completo da inscrição de UMA pessoa: termo, valores, Pix, parcelas,
-- quanto pagou, se já assinou e os responsáveis. É o que AXIS e Koinonia mostram.
create or replace function public._inscricao_resumo(p_person uuid)
returns json
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  pe record; ev record; ac record;
  v_total numeric; v_pago numeric; v_termo text;
begin
  select id, name, role_type, event_id, user_id into pe from people where id = p_person;
  if pe.id is null then raise exception 'Cadastro não encontrado.'; end if;
  select * into ev from events where id = pe.event_id;

  v_total := coalesce(case when pe.role_type = 'worker' then ev.valor_encontreiro else ev.valor_encontrista end, 0);
  select coalesce(sum(valor), 0) into v_pago from financeiro where person_id = pe.id and status = 'pago';
  select valor into v_termo from configuracoes
   where chave = case when pe.role_type = 'worker' then 'termo_encontreiro' else 'termo_encontrista' end;
  v_termo := replace(coalesce(v_termo, ''), '{{nome}}', pe.name);
  select * into ac from inscricao_aceites where person_id = pe.id and event_id = pe.event_id;

  return json_build_object(
    'pessoa',  json_build_object('id', pe.id, 'nome', pe.name, 'role_type', pe.role_type),
    'evento',  json_build_object('id', ev.id, 'nome', ev.name, 'inicio', ev.start_date, 'fim', ev.end_date),
    'termo',   v_termo,
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

-- Registra o aceite assinado. O TEXTO do termo e o VALOR vêm do servidor (não do
-- celular), então ninguém consegue "aceitar" um termo/valor diferente do evento.
create or replace function public._inscricao_registrar_aceite(
  p_person uuid, p_parcelas int, p_entrada numeric, p_assinatura_path text,
  p_origem text default 'axis', p_user_agent text default null)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  r json; pe record; v_total numeric; v_max int; v_min numeric; v_entrada numeric; v_termo text;
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
  v_termo := r->>'termo';

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

  insert into inscricao_aceites (event_id, person_id, user_id, role_type, termo_texto, termo_hash,
                                 valor_total, parcelas, entrada, assinatura_path, origem, user_agent)
  values (pe.event_id, pe.id, pe.user_id, pe.role_type, v_termo, md5(v_termo),
          v_total, p_parcelas, v_entrada, p_assinatura_path,
          case when p_origem = 'koinonia' then 'koinonia' else 'axis' end, left(p_user_agent, 300));

  return _inscricao_resumo(p_person);
end;
$function$;

revoke all on function public._inscricao_resumo(uuid) from public, anon, authenticated;
revoke all on function public._inscricao_registrar_aceite(uuid, int, numeric, text, text, text) from public, anon, authenticated;
grant execute on function public._inscricao_resumo(uuid) to service_role;
grant execute on function public._inscricao_registrar_aceite(uuid, int, numeric, text, text, text) to service_role;

-- ── 6. O que o app AXIS chama (logado) ────────────────────────────────────────
create or replace function public.inscricao_resumo(p_person uuid)
returns json
language plpgsql
stable security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then raise exception 'Sem usuário logado.'; end if;
  if not (exists (select 1 from people where id = p_person and user_id = auth.uid())
          or is_admin() or tem_permissao('financeiro','ver') or tem_permissao('cadastros','ver')) then
    raise exception 'Sem permissão.';
  end if;
  return _inscricao_resumo(p_person);
end;
$function$;

create or replace function public.inscricao_registrar_aceite(
  p_person uuid, p_parcelas int, p_entrada numeric, p_assinatura_path text, p_user_agent text default null)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- Só a PRÓPRIA pessoa assina o próprio termo.
  if not exists (select 1 from people where id = p_person and user_id = auth.uid()) then
    raise exception 'Só a própria pessoa pode assinar o termo.';
  end if;
  return _inscricao_registrar_aceite(p_person, p_parcelas, p_entrada, p_assinatura_path, 'axis', p_user_agent);
end;
$function$;

revoke all on function public.inscricao_resumo(uuid) from public, anon;
revoke all on function public.inscricao_registrar_aceite(uuid, int, numeric, text, text) from public, anon;
grant execute on function public.inscricao_resumo(uuid) to authenticated, service_role;
grant execute on function public.inscricao_registrar_aceite(uuid, int, numeric, text, text) to authenticated, service_role;
