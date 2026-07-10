-- ============================================================
-- 60_ministracao_foto_poster.sql
-- Foto PNG (fundo transparente) do ministrante, só para o PÔSTER do cronograma.
-- Se existir, o pôster usa ela no lugar da foto de perfil redonda.
-- Rodar inteiro no SQL Editor do Supabase. Pode rodar mais de uma vez.
-- ============================================================

ALTER TABLE public."ministrações"
  ADD COLUMN IF NOT EXISTS foto_poster text;

NOTIFY pgrst, 'reload schema';
