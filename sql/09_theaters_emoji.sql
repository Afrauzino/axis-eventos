-- ============================================================
-- 09_theaters_emoji.sql — Emoji do teatro
-- Cole no SQL Editor do Supabase e clique RUN.
-- ============================================================
ALTER TABLE theaters ADD COLUMN IF NOT EXISTS emoji TEXT;
