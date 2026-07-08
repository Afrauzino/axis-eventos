-- ============================================================================
-- 38_contagem_regressiva.sql — Personalização da CONTAGEM REGRESSIVA da home
-- ----------------------------------------------------------------------------
-- Rode no Supabase. Adiciona os campos usados pela caixa de contagem regressiva
-- da tela inicial (igual à caixa "Evento atual"): ligar/desligar, cor e imagem.
-- ============================================================================

alter table public.events add column if not exists contagem_ativa  boolean not null default true;
alter table public.events add column if not exists contagem_cor    text;
alter table public.events add column if not exists contagem_bg_url text;
