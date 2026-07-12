-- ============================================================================
-- 74_fix_trigger_cadastro.sql — CONSERTA os cadastros que não salvavam
-- ----------------------------------------------------------------------------
-- BUG (achado 2026-07-12 auditando o banco REAL pelo Chrome): existia um trigger
-- BEFORE INSERT em public.people chamado `trg_set_valor_pessoa` (função
-- set_valor_pessoa) — NÃO estava no código do app, foi criado direto no banco.
-- Ele auto-preenchia NEW.valor_total, mas NÃO retornava NEW no fim -> em trigger
-- BEFORE INSERT, retornar NULL DESCARTA a linha em SILÊNCIO (sem erro).
-- Resultado: TODO cadastro (inclusive do admin) "salvava" sem erro mas sumia.
--
-- CONSERTO: remove o trigger quebrado. O app NÃO depende de people.valor_total
-- (o valor esperado é calculado de events.valor_encontrista/valor_encontreiro
-- pelo próprio app). A coluna valor_total é anulável, então inserir sem ela é ok.
--
-- Rodar no Supabase (SQL Editor). Pode rodar de novo.
-- ============================================================================

drop trigger if exists trg_set_valor_pessoa on public.people;

-- (a função fica desanexada e inofensiva; se quiser, dá pra apagar também:)
-- drop function if exists public.set_valor_pessoa();

notify pgrst, 'reload schema';
