-- ============================================================
-- 13_med_agenda_entrega.sql — Registro de entrega das doses
-- Cole no SQL Editor do Supabase e clique RUN.
-- ============================================================
ALTER TABLE med_agenda ADD COLUMN IF NOT EXISTS entregue_por UUID REFERENCES people(id);
ALTER TABLE med_agenda ADD COLUMN IF NOT EXISTS entregue_em  TIMESTAMPTZ;
