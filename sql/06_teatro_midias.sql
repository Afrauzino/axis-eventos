-- ============================================================
-- 06_teatro_midias.sql — Mídia e sons do Teatro (por LINK de nuvem)
-- Cole no SQL Editor do Supabase e clique RUN.
-- As mídias NÃO ficam no Supabase: guardamos só o link (Google Drive, Mega, YouTube, etc.).
-- ============================================================

CREATE TABLE IF NOT EXISTS teatro_midias (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  theater_id  UUID NOT NULL REFERENCES theaters(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL CHECK (tipo IN ('foto','audio','video')),
  titulo      TEXT,
  url         TEXT NOT NULL,
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teatro_midias_theater ON teatro_midias(theater_id);

ALTER TABLE teatro_midias ENABLE ROW LEVEL SECURITY;

-- Qualquer usuário aprovado pode ver as mídias
DROP POLICY IF EXISTS "teatro_midias_select" ON teatro_midias;
CREATE POLICY "teatro_midias_select" ON teatro_midias
  FOR SELECT USING (is_approved());

-- Admin cria/edita/exclui
DROP POLICY IF EXISTS "teatro_midias_insert" ON teatro_midias;
CREATE POLICY "teatro_midias_insert" ON teatro_midias
  FOR INSERT WITH CHECK (is_admin());

DROP POLICY IF EXISTS "teatro_midias_delete" ON teatro_midias;
CREATE POLICY "teatro_midias_delete" ON teatro_midias
  FOR DELETE USING (is_admin());
