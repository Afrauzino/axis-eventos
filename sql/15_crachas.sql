-- ============================================================
-- 15_crachas.sql — Configuração do crachá (fundo + posição dos campos)
-- Cole no SQL Editor do Supabase e clique RUN.
-- Uma config por evento: tamanho, imagem de fundo (link) e posições dos campos (JSON).
-- ============================================================
CREATE TABLE IF NOT EXISTS crachas (
  event_id   UUID PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  tamanho    TEXT NOT NULL DEFAULT 'grande',   -- grande | pequeno_v | pequeno_h
  fundo_url  TEXT,
  campos     JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE crachas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crachas_select" ON crachas;
CREATE POLICY "crachas_select" ON crachas FOR SELECT USING (is_approved());

DROP POLICY IF EXISTS "crachas_insert" ON crachas;
CREATE POLICY "crachas_insert" ON crachas FOR INSERT WITH CHECK (is_admin());

DROP POLICY IF EXISTS "crachas_update" ON crachas;
CREATE POLICY "crachas_update" ON crachas FOR UPDATE USING (is_admin());
