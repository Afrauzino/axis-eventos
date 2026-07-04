-- ============================================================================
-- 27_permissoes_fonte_unica.sql
-- Parte 1 da unificação de permissões (TAREFA 1).
--
-- Contexto (descoberto pelo diagnóstico sql/26):
--   • A tabela `permissions` (inglês) e a função `has_permission()` NÃO existem
--     neste banco. Logo, a fonte única de permissões é a tabela `permissoes`
--     (português), usada pelo app via usePermissao/pode().
--   • Hoje o banco está "de portão aberto": quase toda tabela tem policies
--     genéricas (ins/upd/del = "auth.uid() IS NOT NULL"), ou seja, qualquer
--     pessoa logada consegue gravar. Quem controla de verdade é o app.
--
-- Este script FECHA só os 2 buracos perigosos, sem travar nenhum fluxo real:
--   1) `permissoes`: só ADMIN pode inserir/alterar/apagar (fecha a brecha de
--      alguém se autopromover). Leitura continua liberada (o app precisa ler).
--   2) `medicamento_entregas`: histórico de doses entregues não pode ser
--      apagado por qualquer um — só admin (regra "histórico nunca é apagado").
--      (No app, só a exclusão de pessoa pelo Admin apaga isso — admin passa.)
--
-- NÃO mexe em saude_fichas / med_controlados / med_agenda porque a equipe da
-- Saúde apaga esses em fluxos legítimos (remover remédio da ficha, excluir
-- cadastro). Travar quebraria a Saúde.
--
-- Idempotente: pode rodar de novo sem erro. SOMENTE políticas (não apaga dados).
-- Rode no SQL Editor do Supabase.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) PERMISSOES — só admin escreve; leitura continua pública (app usa no pode())
-- ----------------------------------------------------------------------------
alter table public.permissoes enable row level security;

-- Remove as policies de escrita antigas "qualquer logado"
drop policy if exists "ins" on public.permissoes;
drop policy if exists "upd" on public.permissoes;
drop policy if exists "del" on public.permissoes;
-- (defensivo, caso já tenham sido criadas antes)
drop policy if exists "permissoes_insert_admin" on public.permissoes;
drop policy if exists "permissoes_update_admin" on public.permissoes;
drop policy if exists "permissoes_delete_admin" on public.permissoes;

-- Leitura: mantém liberada (o app carrega TODAS as permissões pro pode()).
drop policy if exists "sel" on public.permissoes;
create policy "permissoes_select_public" on public.permissoes
  for select using (true);

-- Escrita: só admin
create policy "permissoes_insert_admin" on public.permissoes
  for insert with check ( public.is_admin() );
create policy "permissoes_update_admin" on public.permissoes
  for update using ( public.is_admin() ) with check ( public.is_admin() );
create policy "permissoes_delete_admin" on public.permissoes
  for delete using ( public.is_admin() );

-- ----------------------------------------------------------------------------
-- 2) MEDICAMENTO_ENTREGAS — histórico de doses só admin apaga
--    (leitura/insert/update seguem como estão, para a Saúde registrar entregas)
-- ----------------------------------------------------------------------------
alter table public.medicamento_entregas enable row level security;

drop policy if exists "del" on public.medicamento_entregas;
drop policy if exists "medicamento_entregas_delete_admin" on public.medicamento_entregas;
create policy "medicamento_entregas_delete_admin" on public.medicamento_entregas
  for delete using ( public.is_admin() );

-- ----------------------------------------------------------------------------
-- Conferência rápida (opcional): rode depois pra ver como ficaram as policies
-- dessas duas tabelas.
-- ----------------------------------------------------------------------------
-- select tablename, policyname, cmd, qual as using, with_check
-- from pg_policies
-- where schemaname='public' and tablename in ('permissoes','medicamento_entregas')
-- order by tablename, cmd;
