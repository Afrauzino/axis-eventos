-- ============================================================================
-- 40_mural_interacoes.sql — CURTIDAS e COMENTÁRIOS do Mural de Gratidão
-- ----------------------------------------------------------------------------
-- Rode no Supabase (depois do 39_mural_gratidao.sql).
-- ============================================================================

-- Curtidas (1 por pessoa por post)
create table if not exists public.mural_curtidas (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.mural_posts(id) on delete cascade,
  event_id   uuid,
  user_id    uuid not null,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);
create index if not exists idx_mural_curtidas_evt on public.mural_curtidas (event_id);

alter table public.mural_curtidas enable row level security;
drop policy if exists "mcurt_sel" on public.mural_curtidas;
drop policy if exists "mcurt_ins" on public.mural_curtidas;
drop policy if exists "mcurt_del" on public.mural_curtidas;
create policy "mcurt_sel" on public.mural_curtidas for select using (true);
create policy "mcurt_ins" on public.mural_curtidas for insert to authenticated with check (auth.uid() = user_id);
create policy "mcurt_del" on public.mural_curtidas for delete to authenticated using (auth.uid() = user_id);

-- Comentários
create table if not exists public.mural_comentarios (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.mural_posts(id) on delete cascade,
  event_id   uuid,
  user_id    uuid,
  autor_nome text,
  autor_foto text,
  texto      text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_mural_coment_post on public.mural_comentarios (post_id, created_at);
create index if not exists idx_mural_coment_evt  on public.mural_comentarios (event_id);

alter table public.mural_comentarios enable row level security;
drop policy if exists "mcom_sel" on public.mural_comentarios;
drop policy if exists "mcom_ins" on public.mural_comentarios;
drop policy if exists "mcom_del" on public.mural_comentarios;
create policy "mcom_sel" on public.mural_comentarios for select using (true);
create policy "mcom_ins" on public.mural_comentarios for insert to authenticated with check (auth.uid() is not null);
create policy "mcom_del" on public.mural_comentarios for delete to authenticated using (auth.uid() = user_id);
