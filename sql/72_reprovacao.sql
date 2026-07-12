-- ============================================================================
-- 72_reprovacao.sql — Reprovar cadastro com mensagem + refazer
-- ----------------------------------------------------------------------------
-- 1) profiles.rejeicao_msg: a mensagem (com negrito/cor) que o admin escreve ao
--    NÃO aprovar. A pessoa vê essa mensagem ao entrar no app.
-- 2) reenviar_meu_cadastro(): a pessoa, depois de corrigir o cadastro, reenvia —
--    volta pra 'pending' e limpa a mensagem. Só a PRÓPRIA linha, só se estava
--    'rejected'. NÃO mexe em cargo/permissão (seguro).
--
-- Os MODELOS de mensagem ficam em `configuracoes` (chave 'reprovacao_modelos'),
-- então não precisa de tabela nova.
--
-- Rodar no Supabase (SQL Editor). Pode rodar de novo.
-- ============================================================================

alter table public.profiles add column if not exists rejeicao_msg text;

create or replace function public.reenviar_meu_cadastro()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
     set role_status = 'pending', rejeicao_msg = null
   where user_id = auth.uid() and role_status = 'rejected';
end $$;

revoke all on function public.reenviar_meu_cadastro() from public;
grant execute on function public.reenviar_meu_cadastro() to authenticated;

notify pgrst, 'reload schema';
