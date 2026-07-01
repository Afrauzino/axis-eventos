-- ============================================================
-- 08_midias.sql — Menu Mídia (fotos/áudios/vídeos por link de nuvem, nível evento)
-- Cole no SQL Editor do Supabase e clique RUN.
-- Igual ao Teatro > Mídia, mas geral do evento. Guarda só o link (não ocupa disco).
-- ============================================================

CREATE TABLE IF NOT EXISTS midias (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL CHECK (tipo IN ('foto','audio','video')),
  titulo      TEXT,
  url         TEXT NOT NULL,
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_midias_event ON midias(event_id);

ALTER TABLE midias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "midias_select" ON midias;
CREATE POLICY "midias_select" ON midias FOR SELECT USING (is_approved());

DROP POLICY IF EXISTS "midias_insert" ON midias;
CREATE POLICY "midias_insert" ON midias FOR INSERT WITH CHECK (is_approved());

DROP POLICY IF EXISTS "midias_delete" ON midias;
CREATE POLICY "midias_delete" ON midias FOR DELETE USING (is_admin());
