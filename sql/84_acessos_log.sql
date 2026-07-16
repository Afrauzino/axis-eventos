-- ============================================================================
-- 84_acessos_log.sql — registro de acessos por dia (pro Painel de Análises)
-- "quem entrou e quando". 1 linha por (conta, evento, dia); reentradas somam qtd.
-- O app chama registrar_acesso(evento) 1x por carregamento. JÁ RODADO no banco.
-- ============================================================================

create table if not exists public.acessos_log (
  id        uuid primary key default gen_random_uuid(),
  event_id  uuid,
  user_id   uuid not null,
  dia       date not null,
  qtd       int  not null default 1,
  primeira  timestamptz not null default now(),
  ultima    timestamptz not null default now(),
  unique (user_id, event_id, dia)
);
create index if not exists idx_acessos_dia on public.acessos_log(event_id, dia);

alter table public.acessos_log enable row level security;

-- Só quem é admin ou tem relatorios/ver LÊ. Escrita é só pela função (definer).
drop policy if exists "acessos_select" on public.acessos_log;
create policy "acessos_select" on public.acessos_log
  for select to authenticated using (
    is_admin()
    or exists (
      select 1 from public.permissoes pm
      join public.people pe on pe.id = pm.person_id
      where pe.user_id = auth.uid()
        and pm.modulo = 'relatorios' and pm.acao = 'ver' and pm.permitido = true
    )
  );

create or replace function public.registrar_acesso(p_event uuid)
returns void
language plpgsql security definer set search_path to 'public' as $$
declare uid uuid := auth.uid(); d date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if uid is null then return; end if;
  insert into public.acessos_log (event_id, user_id, dia, qtd, primeira, ultima)
  values (p_event, uid, d, 1, now(), now())
  on conflict (user_id, event_id, dia)
  do update set qtd = acessos_log.qtd + 1, ultima = now();
end $$;

grant execute on function public.registrar_acesso(uuid) to authenticated;
