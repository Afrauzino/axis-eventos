-- ============================================================
-- 12_med_ultima_dose.sql — Última dose tomada (medicamento contínuo)
-- Cole no SQL Editor do Supabase e clique RUN.
-- Reusa as tabelas existentes med_controlados e med_agenda.
-- ============================================================
ALTER TABLE med_controlados ADD COLUMN IF NOT EXISTS ultima_dose TIMESTAMPTZ;
