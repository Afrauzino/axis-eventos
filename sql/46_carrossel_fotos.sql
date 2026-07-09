-- ============================================================================
-- 46_carrossel_fotos.sql — Segundo carrossel da Início ("Carrossel de fotos")
-- ----------------------------------------------------------------------------
-- Reaproveita a tabela home_midias, separando os dois carrosséis por "grupo":
--   grupo = 'principal'  -> o carrossel/banner de sempre (só admin)
--   grupo = 'fotos'      -> o NOVO carrossel de fotos (quem tiver a liberação posta)
-- A liberação "Carrossel de fotos" é dada por pessoa em Administração → Liberações.
-- Rode no Supabase (SQL Editor → Run).
-- ============================================================================

alter table public.home_midias add column if not exists grupo text not null default 'principal';
create index if not exists idx_home_midias_grupo on public.home_midias(grupo, ordem);

-- Escrita: admin em tudo; no carrossel de FOTOS qualquer autenticado pode postar
-- (a interface só mostra o botão de postar pra quem tem a liberação "Carrossel de fotos").
drop policy if exists "home_write_admin" on public.home_midias;
drop policy if exists "home_write" on public.home_midias;
create policy "home_write" on public.home_midias
  for all
  using      ( is_admin() or grupo = 'fotos' )
  with check ( is_admin() or grupo = 'fotos' );
