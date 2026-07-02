-- ============================================================
-- 11_ficha_medica.sql — Ficha Médica simplificada (fonte única)
-- Cole no SQL Editor do Supabase e clique RUN.
-- Campos Sim/Não; os textos reusam colunas existentes (restricoes_alimentares, alergias).
-- ============================================================
ALTER TABLE saude_fichas ADD COLUMN IF NOT EXISTS restricao_alimentar BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE saude_fichas ADD COLUMN IF NOT EXISTS alergia_medicamentos BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE saude_fichas ADD COLUMN IF NOT EXISTS toma_controlado BOOLEAN NOT NULL DEFAULT false;
