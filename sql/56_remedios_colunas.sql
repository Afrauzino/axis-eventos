-- ============================================================
-- 56_remedios_colunas.sql
-- Prepara o aviso de remédio (10 min antes):
--   1) events.med_equipe_id  -> qual equipe recebe o aviso
--   2) med_agenda.push_em     -> marca que o aviso daquela dose já foi enviado
-- Rode inteiro no SQL Editor do Supabase. Pode rodar mais de uma vez.
-- ============================================================

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS med_equipe_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;

ALTER TABLE public.med_agenda
  ADD COLUMN IF NOT EXISTS push_em timestamptz;

NOTIFY pgrst, 'reload schema';
