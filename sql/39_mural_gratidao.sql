-- ============================================================================
-- 39_mural_gratidao.sql — MURAL DE GRATIDÃO (feed da tela inicial)
-- ----------------------------------------------------------------------------
-- Rode no Supabase. Cada pessoa posta uma mensagem curta (com limite de
-- caracteres no app), pode marcar várias pessoas, e todos veem em tempo real.
-- ============================================================================

create table if not exists public.mural_posts (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid references public.events(id) on delete cascade,
  user_id     uuid,                 -- auth.uid() do autor
  autor_nome  text,                 -- nome do autor (denormalizado p/ o feed)
  autor_foto  text,                 -- foto do autor (denormalizado)
  texto       text not null,
  mencionados uuid[] not null default '{}',  -- ids de people marcadas
  created_at  timestamptz not null default now()
);

create index if not exists idx_mural_posts_event on public.mural_posts (event_id, created_at desc);

alter table public.mural_posts enable row level security;

drop policy if exists "mural_sel" on public.mural_posts;
drop policy if exists "mural_ins" on public.mural_posts;
drop policy if exists "mural_del" on public.mural_posts;

create policy "mural_sel" on public.mural_posts for select using (true);
create policy "mural_ins" on public.mural_posts for insert to authenticated with check (auth.uid() is not null);
-- Autor pode apagar o próprio post (admin apaga pela tela do app com service/ível de app).
create policy "mural_del" on public.mural_posts for delete to authenticated using (auth.uid() = user_id);
