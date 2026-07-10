-- ============================================================================
-- 54_push_subscriptions.sql — Web Push (notificação com o app FECHADO)
-- ----------------------------------------------------------------------------
-- Guarda a "assinatura de push" de cada aparelho. A Edge Function de envio lê
-- essa tabela (com a chave de serviço) pra empurrar a notificação.
-- Rode no Supabase: SQL Editor -> Run.
-- ============================================================================

create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists idx_push_user on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

-- Cada pessoa gerencia SÓ as próprias assinaturas. (A Edge Function usa a chave
-- de serviço e enxerga todas pra poder enviar.)
drop policy if exists "push_sel" on public.push_subscriptions;
drop policy if exists "push_ins" on public.push_subscriptions;
drop policy if exists "push_del" on public.push_subscriptions;
create policy "push_sel" on public.push_subscriptions for select to authenticated using (auth.uid() = user_id);
create policy "push_ins" on public.push_subscriptions for insert to authenticated with check (auth.uid() = user_id);
create policy "push_del" on public.push_subscriptions for delete to authenticated using (auth.uid() = user_id);
