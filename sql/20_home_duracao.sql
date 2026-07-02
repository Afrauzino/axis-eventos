-- ============================================================================
-- 20_home_duracao.sql — DURAÇÃO DO SLIDE (rode no Supabase)
-- ----------------------------------------------------------------------------
-- Cada imagem do carrossel fica na tela pelos segundos configurados ao inserir.
-- Vídeos tocam sozinhos e avançam quando terminam.
-- ============================================================================

alter table public.home_midias add column if not exists duracao int not null default 5;
