-- ============================================================================
-- 42_inscricao_evento_publico.sql — deixa a TELA DE INSCRIÇÃO (antes do login)
-- enxergar o EVENTO ATIVO. Sem isto, o anônimo não lê nenhum evento e a
-- inscrição sempre aparece como "fechada".
-- ============================================================================

-- Privilégio de tabela para o papel anônimo (o RLS abaixo restringe as linhas)
grant select on public.events to anon;

-- Só o evento ATIVO fica visível para o anônimo (não expõe eventos encerrados)
drop policy if exists "events_select_ativo_publico" on public.events;
create policy "events_select_ativo_publico" on public.events
  for select to anon
  using ( status = 'active' );
