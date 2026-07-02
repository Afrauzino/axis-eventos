-- ============================================================
-- 10_refeicao_tipos_emoji.sql — Emoji do tipo de refeição (Cozinha)
-- Cole no SQL Editor do Supabase e clique RUN.
-- ============================================================
ALTER TABLE refeicao_tipos ADD COLUMN IF NOT EXISTS emoji TEXT;
