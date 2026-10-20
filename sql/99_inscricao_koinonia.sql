-- =====================================================================
-- 99 — Inscrição pelo KOINONIA (depende do sql/98_inscricao_pagamento)
-- =====================================================================
-- O que muda (só ACRESCENTA — nada existente é alterado ou apagado):
--
-- 1) Cada evento pode abrir inscrição no Koinonia (events.koinonia_*), dizendo
--    quais papéis estão abertos (encontrista / encontreiro) e até quando.
--
-- 2) A ponte: o Koinonia nunca fala direto com o banco. Quem fala é a edge
--    function `koinonia-inscricao` deste projeto, que confere o segredo
--    compartilhado (hash em integracao_chaves) e chama as funções abaixo com
--    a chave de serviço. Por isso TODAS elas são só service_role.
--
-- 3) receber_inscricao_koinonia(): cria a ficha (people, status 'pendente'),
--    a ficha de saúde e REGISTRA O ACEITE ASSINADO pela MESMA função do AXIS
--    (_inscricao_registrar_aceite, sql/98) — numa transação só: se o termo
--    mudou enquanto a pessoa lia, ou o aceite falhar, nada fica gravado.
--    Não duplica: procura a pessoa por vínculo com o Koinonia, CPF, email e
--    telefone+nome. Quem não tem conta no AXIS ganha CÓDIGO de 1º acesso.
--
-- Rodar uma vez no SQL Editor DEPOIS do 98. Pode rodar de novo (idempotente).
-- =====================================================================

-- ---------- 1. colunas novas ----------
alter table public.events add column if not exists koinonia_aberto boolean not null default false;
alter table public.events add column if not exists koinonia_papeis text[] not null default '{}';
alter table public.events add column if not exists inscricao_ate   date;

alter table public.people add column if not exists koinonia_membro_id uuid;
alter table public.people add column if not exists origem             text;   -- 'koinonia' quando veio de lá
alter table public.people add column if not exists inscrito_por_nome  text;   -- o responsável que inscreveu
alter table public.people add column if not exists inscrito_por_tel   text;
create index if not exists idx_people_koinonia on public.people(koinonia_membro_id) where koinonia_membro_id is not null;

-- ---------- 2. segredo da integração (só o servidor lê) ----------
create table if not exists public.integracao_chaves (
  nome       text primary key,               -- 'koinonia'
  hash       text not null,                  -- sha256 (hex) do segredo; o segredo em si não fica aqui
  criado_em  timestamptz not null default now()
);
alter table public.integracao_chaves enable row level security;
revoke all on public.integracao_chaves from anon, authenticated;
grant select on public.integracao_chaves to service_role;

-- ---------- 3. eventos com inscrição aberta no Koinonia ----------
create or replace function public.inscricoes_koinonia_abertas()
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', e.id, 'nome', e.name, 'descricao', e.description,
           'inicio', e.start_date, 'fim', e.end_date, 'local', e.location,
           'papeis', e.koinonia_papeis, 'inscricao_ate', e.inscricao_ate,
           'valor_encontrista', e.valor_encontrista, 'valor_encontreiro', e.valor_encontreiro,
           'parcelas_max', greatest(coalesce(e.parcelas_max, 1), 1))
         order by e.start_date nulls last), '[]'::jsonb)
    from public.events e
   where e.koinonia_aberto
     and e.status <> 'finished'
     and cardinality(e.koinonia_papeis) > 0
     and (e.inscricao_ate is null or e.inscricao_ate >= (now() at time zone 'America/Sao_Paulo')::date)
$$;
revoke all on function public.inscricoes_koinonia_abertas() from public, anon, authenticated;
grant execute on function public.inscricoes_koinonia_abertas() to service_role;

-- ---------- 4. prévia do que a pessoa vai assinar ----------
-- A pessoa ainda não existe no AXIS quando lê o termo no Koinonia, então não
-- dá pra usar o _inscricao_resumo (que pede people.id). Mesma conta dele, a
-- partir de evento + papel + nome. A gravação confere de novo PELO resumo
-- oficial: se as duas contas divergirem, a inscrição volta "termo_mudou" —
-- nunca grava um termo diferente do que a pessoa leu.
create or replace function public.inscricao_previa_koinonia(p_event uuid, p_role text, p_nome text)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare ev public.events%rowtype; v_total numeric; v_termo text;
begin
  select * into ev from public.events where id = p_event;
  if not found or p_role not in ('encounterer','worker') then return null; end if;
  v_total := coalesce(case when p_role = 'worker' then ev.valor_encontreiro else ev.valor_encontrista end, 0);
  select valor into v_termo from public.configuracoes
   where chave = case when p_role = 'worker' then 'termo_encontreiro' else 'termo_encontrista' end;
  v_termo := replace(coalesce(v_termo, ''), '{{nome}}', btrim(coalesce(p_nome, '')));
  return jsonb_build_object(
    'evento', jsonb_build_object('id', ev.id, 'nome', ev.name, 'inicio', ev.start_date, 'fim', ev.end_date, 'local', ev.location),
    'role_type', p_role,
    'papel', case when p_role = 'worker' then 'Encontreiro' else 'Encontrista' end,
    'termo', v_termo,
    'termo_hash', md5(v_termo),
    'valor_total', v_total,
    'parcelas_max', greatest(coalesce(ev.parcelas_max, 1), 1),
    'entrada_minima', least(coalesce(ev.entrada_minima, 0), v_total),
    'pix', case when coalesce(ev.pix_chave, '') = '' then null else jsonb_build_object(
             'chave', ev.pix_chave, 'tipo', ev.pix_tipo, 'nome', ev.pix_nome, 'cidade', ev.pix_cidade) end,
    'responsaveis', coalesce((select jsonb_agg(jsonb_build_object(
             'nome', r.nome, 'whatsapp', r.whatsapp, 'funcao', r.funcao, 'descricao', r.descricao)
             order by (r.funcao <> 'financeiro'), r.ordem, r.nome)
           from public.evento_responsaveis r
           where r.event_id = ev.id and r.publico in ('todos', p_role)), '[]'::jsonb)
  );
end $$;
revoke all on function public.inscricao_previa_koinonia(uuid, text, text) from public, anon, authenticated;
grant execute on function public.inscricao_previa_koinonia(uuid, text, text) to service_role;

-- ---------- 5. a inscrição que chega do Koinonia ----------
-- p (montado pela edge function, que leu o cadastro NO SERVIDOR do Koinonia):
--   person_id (uuid gerado pela função — a assinatura já foi subida em
--   assinaturas/{event_id}/{person_id}.png), event_id, role_type, nome, phone,
--   email, cpf, rg, sexo, estado_civil, birth_date, cep, endereco, bairro,
--   cidade, estado, church, cargo, ano_encontro, photo_url, notes,
--   koinonia_membro_id, inscrito_por {membro_id, nome, tel},
--   saude {...}, termo_hash, parcelas, entrada, user_agent.
-- Devolve {status: ok | ja_inscrito | nome_em_uso | fechado | termo_mudou | erro, ...}
create or replace function public.receber_inscricao_koinonia(p jsonb)
returns jsonb
language plpgsql security definer
set search_path = public, auth
as $$
declare
  v_ev      public.events%rowtype;
  v_role    text := p->>'role_type';
  v_nome    text := btrim(coalesce(p->>'nome', ''));
  v_cpf     text := nullif(regexp_replace(coalesce(p->>'cpf', ''), '\D', '', 'g'), '');
  v_tel     text := nullif(regexp_replace(coalesce(p->>'phone', ''), '\D', '', 'g'), '');
  v_kid     uuid := nullif(p->>'koinonia_membro_id', '')::uuid;
  v_email   text := lower(btrim(coalesce(p->>'email', '')));
  v_pid     uuid := nullif(p->>'person_id', '')::uuid;
  v_uid     uuid;
  v_dup     public.people%rowtype;
  v_code    text;
  v_quem    uuid;
  v_res     json;
  v_sexo    text := case upper(left(coalesce(p->>'sexo', ''), 1)) when 'M' then 'M' when 'F' then 'F' else null end;
  v_ec      text := case lower(coalesce(p->>'estado_civil', ''))
                      when 'solteiro' then 'solteiro' when 'solteira' then 'solteiro'
                      when 'casado' then 'casado' when 'casada' then 'casado'
                      when 'divorciado' then 'divorciado' when 'divorciada' then 'divorciado'
                      when 'separado' then 'divorciado' when 'separada' then 'divorciado'
                      when 'viuvo' then 'viuvo' when 'viúvo' then 'viuvo' when 'viuva' then 'viuvo' when 'viúva' then 'viuvo'
                      else null end;
  s jsonb := coalesce(p->'saude', '{}'::jsonb);
  norm_nome text;
begin
  if v_pid is null then raise exception 'person_id obrigatório.'; end if;

  -- evento aberto pra esse papel?
  select * into v_ev from public.events where id = nullif(p->>'event_id', '')::uuid;
  if not found or v_ev.status = 'finished' or not v_ev.koinonia_aberto
     or not (v_role = any(v_ev.koinonia_papeis))
     or (v_ev.inscricao_ate is not null and v_ev.inscricao_ate < (now() at time zone 'America/Sao_Paulo')::date) then
    return jsonb_build_object('status', 'fechado');
  end if;
  if length(v_nome) < 3 then return jsonb_build_object('status', 'erro', 'mensagem', 'Nome obrigatório.'); end if;

  -- já tem conta no AXIS? (vínculo antigo com o Koinonia > CPF > email > telefone+nome)
  norm_nome := regexp_replace(translate(lower(v_nome), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'), '\s+', ' ', 'g');
  select user_id into v_uid from public.people
   where user_id is not null and (
         (v_kid is not null and koinonia_membro_id = v_kid)
      or (v_cpf is not null and regexp_replace(coalesce(cpf, ''), '\D', '', 'g') = v_cpf))
   order by created_at desc limit 1;
  if v_uid is null and v_email <> '' and v_email not like '%@koinonia.app' then
    select id into v_uid from auth.users where lower(email) = v_email limit 1;
  end if;
  if v_uid is null and v_tel is not null then
    select user_id into v_uid from public.people
     where user_id is not null
       and right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 11) = right(v_tel, 11)
       and regexp_replace(translate(lower(btrim(name)), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'), '\s+', ' ', 'g') = norm_nome
     order by created_at desc limit 1;
  end if;

  -- já está inscrita NESTE evento? (não duplica)
  select * into v_dup from public.people
   where event_id = v_ev.id and (
         (v_kid is not null and koinonia_membro_id = v_kid)
      or (v_uid is not null and user_id = v_uid)
      or (v_cpf is not null and regexp_replace(coalesce(cpf, ''), '\D', '', 'g') = v_cpf))
   limit 1;
  if found then
    return jsonb_build_object('status', 'ja_inscrito', 'person_id', v_dup.id, 'nome', v_dup.name,
                              'invite_code', v_dup.invite_code, 'tem_conta', v_dup.user_id is not null);
  end if;
  if public.nome_ja_existe(v_ev.id, v_nome) then
    return jsonb_build_object('status', 'nome_em_uso');
  end if;

  -- sem conta no AXIS -> código de primeiro acesso (mesmo alfabeto do Cadastros)
  if v_uid is null then
    loop
      select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
        into v_code from generate_series(1, 8);
      exit when not exists (select 1 from public.people where invite_code = v_code);
    end loop;
  end if;

  -- quem trouxe (o responsável) já está neste evento? vira o "conhecido por"
  if nullif(p->'inscrito_por'->>'membro_id', '') is not null then
    select id into v_quem from public.people
     where event_id = v_ev.id and koinonia_membro_id = (p->'inscrito_por'->>'membro_id')::uuid limit 1;
  end if;

  -- daqui pra baixo é tudo-ou-nada: qualquer falha desfaz a ficha
  begin
    insert into public.people (
      id, event_id, user_id, invite_code, name, phone, church, role_type, status,
      cpf, rg, sexo, estado_civil, birth_date, cep, endereco, bairro, cidade, estado,
      cargo, ano_encontro, photo_url, contact_phone, notes,
      koinonia_membro_id, origem, inscrito_por_nome, inscrito_por_tel, conhecido_por_id)
    values (
      v_pid, v_ev.id, v_uid, v_code, v_nome, nullif(btrim(coalesce(p->>'phone', '')), ''),
      btrim(coalesce(p->>'church', '')), v_role, 'pendente',
      nullif(btrim(coalesce(p->>'cpf', '')), ''), nullif(btrim(coalesce(p->>'rg', '')), ''), v_sexo, v_ec,
      nullif(p->>'birth_date', '')::date, nullif(btrim(coalesce(p->>'cep', '')), ''),
      nullif(btrim(coalesce(p->>'endereco', '')), ''), nullif(btrim(coalesce(p->>'bairro', '')), ''),
      nullif(btrim(coalesce(p->>'cidade', '')), ''), nullif(upper(left(btrim(coalesce(p->>'estado', '')), 2)), ''),
      nullif(btrim(coalesce(p->>'cargo', '')), ''), nullif(p->>'ano_encontro', '')::int,
      nullif(p->>'photo_url', ''), nullif(btrim(coalesce(s->>'contato_emergencia_telefone', '')), ''),
      nullif(btrim(coalesce(p->>'notes', '')), ''),
      v_kid, 'koinonia', nullif(p->'inscrito_por'->>'nome', ''), nullif(p->'inscrito_por'->>'tel', ''), v_quem);

    insert into public.saude_fichas (
      person_id, event_id, diabetes, hipertensao, cardiopatia, epilepsia, ansiedade, celiaca,
      tipo_sanguineo, alergias, medicamentos, restricoes_alimentares, observacoes,
      contato_emergencia_nome, contato_emergencia_telefone)
    values (
      v_pid, v_ev.id,
      coalesce((s->>'diabetes')::boolean, false), coalesce((s->>'hipertensao')::boolean, false),
      coalesce((s->>'cardiopatia')::boolean, false), coalesce((s->>'epilepsia')::boolean, false),
      coalesce((s->>'ansiedade')::boolean, false), coalesce((s->>'celiaca')::boolean, false),
      nullif(s->>'tipo_sanguineo', ''), nullif(s->>'alergias', ''), nullif(s->>'medicamentos', ''),
      nullif(s->>'restricoes_alimentares', ''), nullif(s->>'observacoes', ''),
      coalesce(s->>'contato_emergencia_nome', ''), coalesce(s->>'contato_emergencia_telefone', ''))
    on conflict (person_id, event_id) do nothing;

    -- o termo que vale é o do resumo OFICIAL; se mudou desde a leitura, desfaz
    v_res := public._inscricao_resumo(v_pid);
    if md5(coalesce(v_res->>'termo', '')) is distinct from (p->>'termo_hash') then
      raise exception 'TERMO_MUDOU';
    end if;

    v_res := public._inscricao_registrar_aceite(
      v_pid, coalesce(nullif(p->>'parcelas', '')::int, 1), nullif(p->>'entrada', '')::numeric,
      v_ev.id::text || '/' || v_pid::text || '.png', 'koinonia', left(p->>'user_agent', 300));
  exception when others then
    if sqlerrm = 'TERMO_MUDOU' then return jsonb_build_object('status', 'termo_mudou'); end if;
    return jsonb_build_object('status', 'erro', 'mensagem', sqlerrm);
  end;

  return jsonb_build_object('status', 'ok', 'person_id', v_pid, 'invite_code', v_code,
                            'tem_conta', v_uid is not null, 'resumo', v_res);
end $$;
revoke all on function public.receber_inscricao_koinonia(jsonb) from public, anon, authenticated;
grant execute on function public.receber_inscricao_koinonia(jsonb) to service_role;

notify pgrst, 'reload schema';
