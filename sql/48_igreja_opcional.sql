-- ============================================================================
-- 48_igreja_opcional.sql — Tira a obrigatoriedade da IGREJA no cadastro
-- ----------------------------------------------------------------------------
-- Hoje people.church é NOT NULL, então cadastrar sem igreja dava erro.
-- Isto deixa o campo opcional (pode ficar vazio). Rode no Supabase (SQL Editor → Run).
-- ============================================================================

alter table public.people alter column church drop not null;
