-- ============================================================================
-- 41_inscricao_aberta.sql — LINK ABERTO DE INSCRIÇÃO (pré-cadastro)
-- ----------------------------------------------------------------------------
-- Rode no Supabase. Permite que a pessoa que se inscreve pelo link publico crie
-- o PRÓPRIO registro em people (user_id = auth.uid()). Continua pendente de
-- aprovação do admin (role_status em profiles). O RLS soma esta política via OR
-- com as políticas de editores (admin/líder), então nada muda para eles.
-- ============================================================================

drop policy if exists "people_insert_self" on public.people;
create policy "people_insert_self" on public.people
  for insert to authenticated
  with check ( user_id = auth.uid() );
