-- ============================================================================
-- 30_escala_checklist.sql — recurso novo da Escala:
--   (1) cada escala pode ser do tipo "texto" (como hoje) OU "checklist";
--   (2) checklist individual por escala, com marcar/desmarcar (barra de progresso).
-- (O bloqueio de conflito de horário e a disponibilidade até 22h são feitos no
--  app, não precisam de banco.)
-- Idempotente. Rode no SQL Editor do Supabase.
-- ============================================================================

-- tipo da atividade da escala: 'texto' (padrão) ou 'checklist'
alter table public.escalas add column if not exists tipo text not null default 'texto';

-- itens do checklist (um conjunto por escala; cada item pode ser marcado)
create table if not exists public.escala_checklist (
  id         uuid primary key default gen_random_uuid(),
  escala_id  uuid not null references public.escalas(id) on delete cascade,
  texto      text not null,
  ordem      int  not null default 0,
  feito      boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_escala_checklist_escala on public.escala_checklist(escala_id);

alter table public.escala_checklist enable row level security;
drop policy if exists "sel" on public.escala_checklist;
drop policy if exists "ins" on public.escala_checklist;
drop policy if exists "upd" on public.escala_checklist;
drop policy if exists "del" on public.escala_checklist;
create policy "sel" on public.escala_checklist for select using (true);
create policy "ins" on public.escala_checklist for insert to authenticated with check (auth.uid() is not null);
create policy "upd" on public.escala_checklist for update to authenticated using (auth.uid() is not null);
create policy "del" on public.escala_checklist for delete to authenticated using (auth.uid() is not null);
