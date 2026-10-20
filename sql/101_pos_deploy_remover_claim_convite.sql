-- ============================================================================
-- 101 — RODAR SÓ DEPOIS de publicar na Vercel a versão do Login que usa
-- rpc('assumir_convite') (sql/100). Antes disso o 1º acesso por código QUEBRA.
-- Remove a regra que deixava qualquer conta logada assumir (e ler) cadastros com
-- código de convite sem saber o código. Idempotente.
-- ============================================================================
drop policy if exists people_claim_convite on public.people;

-- Leitura volta a ser: aprovado vê todos; pendente só o PRÓPRIO.
alter policy sel_auth on public.people
  using ((select public.is_approved()) or user_id = (select auth.uid()));
