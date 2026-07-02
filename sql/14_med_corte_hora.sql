-- ============================================================
-- 14_med_corte_hora.sql — Hora de corte do período de medicamento (configurável)
-- Cole no SQL Editor do Supabase e clique RUN.
-- Padrão 14 (14h). Define até que hora do dia seguinte ao dia completo as doses são geradas.
-- ============================================================
ALTER TABLE events ADD COLUMN IF NOT EXISTS med_corte_hora INTEGER NOT NULL DEFAULT 14;
