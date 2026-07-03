-- ============================================================================
-- 23_encontrista_conhecidos.sql — #19 "conheço esta pessoa"
-- Encontreiros marcam que conhecem um encontrista (vários podem marcar).
-- Guarda nome/foto/WhatsApp do encontreiro (snapshot) p/ mostrar no perfil.
-- Rode no SQL Editor do Supabase.
-- ============================================================================

create table if not exists public.encontrista_conhecidos (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid,
  encontrista_id uuid not null references public.people(id) on delete cascade,
  worker_user_id uuid,                       -- conta do encontreiro que marcou
  worker_name    text,
  worker_photo   text,
  worker_phone   text,
  created_at     timestamptz not null default now(),
  unique (encontrista_id, worker_user_id)    -- um encontreiro marca uma vez por encontrista
);

create index if not exists idx_conhecidos_encontrista on public.encontrista_conhecidos(encontrista_id);

alter table public.encontrista_conhecidos enable row level security;

-- Qualquer usuário logado vê as marcações; cada um cria/remove a SUA marcação.
drop policy if exists "conhecidos_select" on public.encontrista_conhecidos;
drop policy if exists "conhecidos_insert" on public.encontrista_conhecidos;
drop policy if exists "conhecidos_delete" on public.encontrista_conhecidos;

create policy "conhecidos_select" on public.encontrista_conhecidos
  for select to authenticated using (true);

create policy "conhecidos_insert" on public.encontrista_conhecidos
  for insert to authenticated with check (worker_user_id = auth.uid());

create policy "conhecidos_delete" on public.encontrista_conhecidos
  for delete to authenticated using (worker_user_id = auth.uid());
