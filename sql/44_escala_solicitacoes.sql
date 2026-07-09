-- ============================================================================
-- 44_escala_solicitacoes.sql — Solicitação de alteração de escala
-- ----------------------------------------------------------------------------
-- Rode no Supabase. O usuário comum não edita a escala: ele SOLICITA alteração,
-- e o pedido vai para o LÍDER QUE CRIOU a escala (created_by), que aprova/recusa.
-- ============================================================================

-- Quem criou a escala (líder) — destino da solicitação
alter table public.escalas add column if not exists created_by uuid;

create table if not exists public.escala_solicitacoes (
  id                  uuid primary key default gen_random_uuid(),
  escala_id           uuid not null references public.escalas(id) on delete cascade,
  event_id            uuid,
  solicitante_user_id uuid,
  solicitante_nome    text,
  escala_titulo       text,
  lider_user_id       uuid,        -- líder que criou a escala (destino)
  mensagem            text,
  status              text not null default 'pendente',  -- pendente | aprovada | recusada
  resposta            text,
  created_at          timestamptz not null default now(),
  resolved_at         timestamptz
);
create index if not exists idx_escala_solic_evt   on public.escala_solicitacoes (event_id, status);
create index if not exists idx_escala_solic_lider on public.escala_solicitacoes (lider_user_id, status);

alter table public.escala_solicitacoes enable row level security;
drop policy if exists "es_sel" on public.escala_solicitacoes;
drop policy if exists "es_ins" on public.escala_solicitacoes;
drop policy if exists "es_upd" on public.escala_solicitacoes;
create policy "es_sel" on public.escala_solicitacoes for select using (true);
create policy "es_ins" on public.escala_solicitacoes for insert to authenticated with check (auth.uid() is not null);
create policy "es_upd" on public.escala_solicitacoes for update to authenticated using (auth.uid() is not null);
