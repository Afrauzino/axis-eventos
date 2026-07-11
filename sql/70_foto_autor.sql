-- ============================================================================
-- 70_foto_autor.sql — Dono da foto do carrossel
-- ----------------------------------------------------------------------------
-- Guarda QUEM postou cada foto/vídeo do carrossel, pra poder avisar essa pessoa
-- quando curtirem/comentarem a foto dela (regras foto_curtida / foto_comentario).
-- As fotos antigas ficam sem dono (autor_user_id null) — e simplesmente não
-- geram esse aviso. Não quebra nada do que já existe.
--
-- Rodar no Supabase (SQL Editor). Pode rodar de novo.
-- ============================================================================

alter table public.home_midias add column if not exists autor_user_id uuid;

notify pgrst, 'reload schema';
