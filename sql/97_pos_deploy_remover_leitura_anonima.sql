-- ============================================================================
-- 97 — RODAR SÓ DEPOIS de publicar na Vercel a versão que usa rpc('buscar_convite').
-- Remove a regra que deixava visitante SEM login ler todo cadastro com código de
-- convite (CPF, endereço, telefone…). O primeiro acesso passa a usar buscar_convite.
-- ============================================================================
drop policy if exists sel_anon on public.people;
