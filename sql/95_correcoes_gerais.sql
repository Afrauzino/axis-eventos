-- ============================================================================
-- 95 — Correções gerais (2026-10-20). Idempotente: pode rodar mais de uma vez.
-- ============================================================================

-- ── 1. "Meus dados": só altera o campo que VEIO no pedido ─────────────────────
-- Antes, campo ausente virava NULL (apagava CPF, endereço… se a tela não mandasse)
-- e os campos novos (Instagram, estado civil, 2º telefone, contatos) nem eram salvos.
create or replace function public.atualizar_meu_cadastro(p jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Sem usuário logado'; end if;

  update public.people set
    name                = coalesce(nullif(p->>'name',''), name),
    phone               = coalesce(p->>'phone', phone),
    church              = coalesce(p->>'church', church),
    photo_url           = coalesce(p->>'photo_url', photo_url),
    contact_phone       = case when p ? 'contact_phone'       then nullif(p->>'contact_phone','')        else contact_phone end,
    ano_encontro        = case when p ? 'ano_encontro'        then nullif(p->>'ano_encontro','')::int    else ano_encontro end,
    sexo                = case when p ? 'sexo'                then nullif(p->>'sexo','')                 else sexo end,
    birth_date          = case when p ? 'birth_date'          then nullif(p->>'birth_date','')::date     else birth_date end,
    cpf                 = case when p ? 'cpf'                 then nullif(p->>'cpf','')                  else cpf end,
    rg                  = case when p ? 'rg'                  then nullif(p->>'rg','')                   else rg end,
    cidade              = case when p ? 'cidade'              then nullif(p->>'cidade','')               else cidade end,
    estado              = case when p ? 'estado'              then nullif(p->>'estado','')               else estado end,
    endereco            = case when p ? 'endereco'            then nullif(p->>'endereco','')             else endereco end,
    bairro              = case when p ? 'bairro'              then nullif(p->>'bairro','')               else bairro end,
    cep                 = case when p ? 'cep'                 then nullif(p->>'cep','')                  else cep end,
    cargo               = case when p ? 'cargo'               then nullif(p->>'cargo','')                else cargo end,
    notes               = case when p ? 'notes'               then nullif(p->>'notes','')                else notes end,
    instagram           = case when p ? 'instagram'           then nullif(p->>'instagram','')            else instagram end,
    facebook            = case when p ? 'facebook'            then nullif(p->>'facebook','')             else facebook end,
    rede_outra          = case when p ? 'rede_outra'          then nullif(p->>'rede_outra','')           else rede_outra end,
    estado_civil        = case when p ? 'estado_civil'        then nullif(p->>'estado_civil','')         else estado_civil end,
    phone2              = case when p ? 'phone2'              then nullif(p->>'phone2','')               else phone2 end,
    contact_phone_dono  = case when p ? 'contact_phone_dono'  then nullif(p->>'contact_phone_dono','')   else contact_phone_dono end,
    contact_phone2      = case when p ? 'contact_phone2'      then nullif(p->>'contact_phone2','')       else contact_phone2 end,
    contact_phone2_dono = case when p ? 'contact_phone2_dono' then nullif(p->>'contact_phone2_dono','')  else contact_phone2_dono end
  where user_id = uid;

  update public.profiles set
    name       = coalesce(nullif(p->>'name',''), name),
    phone      = coalesce(p->>'phone', phone),
    church     = coalesce(p->>'church', church),
    avatar_url = coalesce(p->>'photo_url', avatar_url)
  where user_id = uid;
end;
$function$;
revoke all on function public.atualizar_meu_cadastro(jsonb) from public, anon;
grant execute on function public.atualizar_meu_cadastro(jsonb) to authenticated, service_role;

-- ── 2. Cronômetro usa o relógio do SERVIDOR ───────────────────────────────────
-- O início do bloco era gravado com a hora do celular de quem apertou "Iniciar".
-- Celular adiantado/atrasado = bloco terminando antes/depois para todo mundo.
create or replace function public.cron_inicio_relogio_servidor()
returns trigger
language plpgsql
as $function$
begin
  if new.cron_iniciado_em is not null
     and (tg_op = 'INSERT' or new.cron_iniciado_em is distinct from old.cron_iniciado_em) then
    new.cron_iniciado_em := now();
  end if;
  return new;
end;
$function$;
drop trigger if exists trg_cron_inicio_relogio_servidor on public.cronograma_eventos;
create trigger trg_cron_inicio_relogio_servidor
  before insert or update of cron_iniciado_em on public.cronograma_eventos
  for each row execute function public.cron_inicio_relogio_servidor();

-- tempo_atual devolve também a hora do servidor ('agora') → a tela /tempo corrige
-- a diferença do relógio do celular.
create or replace function public.tempo_atual()
returns json
language sql
security definer
set search_path to 'public'
as $function$
  select to_json(t) from (
    select
      b.id,
      coalesce(m.titulo, b.titulo) as titulo,
      b.tipo,
      p.name  as ministrante,
      p.photo_url as foto,
      m.foto_poster as foto_png,
      b.duracao_minutos,
      b.hora_inicio,
      b.hora_fim,
      b.cron_estado,
      b.cron_iniciado_em,
      coalesce(b.cron_ajuste_segundos, 0)   as cron_ajuste_segundos,
      coalesce(b.cron_decorrido_segundos, 0) as cron_decorrido_segundos,
      now() as agora
    from cronograma_eventos b
    left join "ministrações" m on m.id = b.ministracao_id
    left join people p on p.id = m.ministrante_id
    where coalesce(b.cron_estado, '') <> 'encerrado'
      and coalesce(b.status, '') <> 'cancelado'
      and (
            b.cron_estado = 'correndo'
         or b.status = 'em_andamento'
         or (b.cron_estado = 'parado' and coalesce(b.cron_decorrido_segundos, 0) > 0)
      )
    order by (b.cron_estado = 'correndo') desc, b.cron_iniciado_em desc nulls last
    limit 1
  ) t;
$function$;

-- Barra de progresso do telão: bloco CANCELADO não conta no total
-- (antes o total incluía cancelados e a barra nunca chegava ao fim).
create or replace function public.tela_progresso()
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $function$
  with ev as (
    select id, name from public.events where status='active' order by created_at desc limit 1
  ),
  calc as (
    select
      count(*) filter (where c.status='concluido')::int as feitos,
      count(*) filter (where coalesce(c.status,'') <> 'cancelado')::int as total
    from public.cronograma_eventos c join ev on c.event_id = ev.id
  )
  select jsonb_build_object(
    'nome',  (select name from ev),
    'pct',   (select case
                when total <= 0 then 0
                when feitos >= total then 83
                else (array[3,7,13,17,23,27,33,37,43,47,53,57,63,67,73,77,83]::int[])[
                       least(greatest(
                         round(16 * power(feitos::numeric / total, 0.85))::int
                         - (case when feitos % 3 = 2 then 1 else 0 end),
                       0), 15) + 1
                     ]
              end from calc),
    'feitos',(select feitos from calc),
    'total', (select total from calc)
  );
$function$;

-- ── 3. Quem pode chamar o quê ─────────────────────────────────────────────────
-- ajustar_tempo (+/− do cronômetro) estava liberado para visitante SEM login:
-- qualquer um com o link podia mudar o tempo dos blocos. Só logado agora.
revoke execute on function public.ajustar_tempo(uuid, integer) from public, anon;
grant  execute on function public.ajustar_tempo(uuid, integer) to authenticated, service_role;
-- avancar_expirados roda pelo pg_cron (superusuário); não precisa ficar público.
revoke execute on function public.avancar_expirados() from public, anon;
grant  execute on function public.avancar_expirados() to authenticated, service_role;
-- avancar_bloco continua público: a tela /tempo (sem login) chama, e o servidor
-- só conclui quando o tempo REALMENTE acabou (now() do servidor).

-- ── 4. Permissão no banco igual à do app (individual + equipe + tipo) ─────────
-- O app libera por pessoa, por equipe e por tipo (encontrista/encontreiro), mas o
-- banco das adoções só aceitava liberação individual → líder com liberação da
-- equipe via os botões, e "Tirar adoção" não fazia nada.
create or replace function public.tem_permissao(p_modulo text, p_acao text)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  with ev as (
    select id from public.events where status='active' order by created_at desc limit 1
  ),
  eu as (
    select pe.id, pe.role_type, pe.event_id from public.people pe where pe.user_id = auth.uid()
  ),
  eu_ev as (
    select * from eu where event_id = (select id from ev)
  ),
  minhas_equipes as (
    select pt.team_id from public.people_teams pt where pt.person_id in (select id from eu_ev)
    union
    select t.id from public.teams t where t.leader_id in (select id from eu_ev) or t.co_leader_id in (select id from eu_ev)
  ),
  meu_tipo as (
    select case role_type when 'worker' then 'encontreiro' when 'encounterer' then 'encontrista' end as r from eu_ev
  )
  select coalesce(public.is_admin(), false) or exists (
    select 1 from public.permissoes pm
    where pm.modulo = p_modulo
      and (pm.acao = p_acao or (p_acao = 'ver' and pm.acao = 'editar'))
      and pm.permitido = true
      and (   pm.person_id in (select id from eu)
           or pm.team_id   in (select team_id from minhas_equipes)
           or pm.role      in (select r from meu_tipo where r is not null))
  );
$function$;
revoke all on function public.tem_permissao(text, text) from public, anon;
grant execute on function public.tem_permissao(text, text) to authenticated, service_role;

create or replace function public.definir_responsavel(p_encontrista uuid, p_worker uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_event uuid;
  w record;
begin
  if not public.tem_permissao('correio', 'adocoes') then
    raise exception 'Sem permissão para definir responsável.';
  end if;

  select event_id into v_event from public.people where id = p_encontrista;
  select id, name, photo_url, phone, user_id into w from public.people where id = p_worker;
  if w.id is null then raise exception 'Responsável não encontrado.'; end if;

  -- substitui qualquer adoção existente (troca de responsável)
  delete from public.encontrista_adocao where encontrista_id = p_encontrista;
  insert into public.encontrista_adocao (event_id, encontrista_id, worker_user_id, worker_name, worker_photo, worker_phone)
  values (v_event, p_encontrista, w.user_id, w.name, w.photo_url, w.phone);
end;
$function$;
revoke execute on function public.definir_responsavel(uuid, uuid) from public, anon;
grant  execute on function public.definir_responsavel(uuid, uuid) to authenticated, service_role;

drop policy if exists adocao_select on public.encontrista_adocao;
create policy adocao_select on public.encontrista_adocao for select to authenticated
  using (worker_user_id = auth.uid() or public.tem_permissao('correio', 'adocoes'));
drop policy if exists adocao_delete on public.encontrista_adocao;
create policy adocao_delete on public.encontrista_adocao for delete to authenticated
  using (worker_user_id = auth.uid() or public.tem_permissao('correio', 'adocoes'));
