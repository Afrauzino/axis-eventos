-- ============================================================
-- 07_logistica.sql — Módulo Logística (checklist de iniciação por encontrista)
-- Cole no SQL Editor do Supabase e clique RUN.
-- ============================================================

-- Itens do checklist da Logística (configurável, como o do Correio)
CREATE TABLE IF NOT EXISTS logistica_checklist_itens (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id   UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  texto      TEXT NOT NULL,
  ordem      INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_logistica_itens_event ON logistica_checklist_itens(event_id);

-- Marcação do checklist por encontrista x item
CREATE TABLE IF NOT EXISTS logistica_checklist_status (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id       UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  encontrista_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  item_id        UUID NOT NULL REFERENCES logistica_checklist_itens(id) ON DELETE CASCADE,
  marcado        BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (encontrista_id, item_id)
);
CREATE INDEX IF NOT EXISTS idx_logistica_status_event ON logistica_checklist_status(event_id);

-- Info de medicamento contínuo por encontrista (dentro da Logística)
CREATE TABLE IF NOT EXISTS logistica_pessoa (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id       UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  encontrista_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  toma_controlado BOOLEAN NOT NULL DEFAULT false,
  ultima_dose    TIMESTAMPTZ,
  observacoes    TEXT,
  concluido      BOOLEAN NOT NULL DEFAULT false,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, encontrista_id)
);

ALTER TABLE logistica_checklist_itens  ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistica_checklist_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistica_pessoa           ENABLE ROW LEVEL SECURITY;

-- Usuários aprovados podem ver e preencher a logística
DO $$
BEGIN
  -- itens
  DROP POLICY IF EXISTS "logistica_itens_all" ON logistica_checklist_itens;
  CREATE POLICY "logistica_itens_all" ON logistica_checklist_itens
    FOR ALL USING (is_approved()) WITH CHECK (is_approved());
  -- status
  DROP POLICY IF EXISTS "logistica_status_all" ON logistica_checklist_status;
  CREATE POLICY "logistica_status_all" ON logistica_checklist_status
    FOR ALL USING (is_approved()) WITH CHECK (is_approved());
  -- pessoa
  DROP POLICY IF EXISTS "logistica_pessoa_all" ON logistica_pessoa;
  CREATE POLICY "logistica_pessoa_all" ON logistica_pessoa
    FOR ALL USING (is_approved()) WITH CHECK (is_approved());
END $$;
