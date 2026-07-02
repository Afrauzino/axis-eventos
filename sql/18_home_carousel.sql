-- ============================================================================
-- 18_home_carousel.sql — CARROSSEL DA TELA INÍCIO (rode no Supabase)
-- ----------------------------------------------------------------------------
-- Banner rotativo na Início com imagens/vídeos que o ADMIN coloca.
-- Se não houver nenhum item, nada aparece. Só admin insere/edita/exclui.
-- ============================================================================

create table if not exists public.home_midias (
  id         uuid primary key default gen_random_uuid(),
  tipo       text not null default 'imagem',   -- 'imagem' | 'video'
  url        text not null,
  ordem      int  not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_home_midias_ordem on public.home_midias(ordem);

alter table public.home_midias enable row level security;

-- Todo mundo autenticado pode VER o carrossel
drop policy if exists "home_select_auth" on public.home_midias;
create policy "home_select_auth" on public.home_midias
  for select using (auth.uid() is not null);

-- Só admin insere / edita / exclui
drop policy if exists "home_write_admin" on public.home_midias;
create policy "home_write_admin" on public.home_midias
  for all using (is_admin()) with check (is_admin());
