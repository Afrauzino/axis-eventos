-- ============================================================================
-- 85_hardening_funcoes.sql — segurança leve: fecha funções internas pro anônimo
-- (o advisor do Supabase apontava SECURITY DEFINER executáveis por anon).
-- NÃO muda nada do app: as funções já checavam admin por dentro ou são de uso
-- logado; nome_ja_existe FICA aberta (a inscrição chama antes do login).
-- JÁ RODADO no banco (2026-07-16).
-- ============================================================================

revoke execute on function public.analisar_orfaos() from public, anon;
grant  execute on function public.analisar_orfaos() to authenticated;

revoke execute on function public.limpar_orfaos() from public, anon;
grant  execute on function public.limpar_orfaos() to authenticated;

revoke execute on function public.adocao_status(uuid) from public, anon;
grant  execute on function public.adocao_status(uuid) to authenticated;

revoke execute on function public.salvar_push_assinatura(text,text,text,text) from public, anon;
grant  execute on function public.salvar_push_assinatura(text,text,text,text) to authenticated;

-- Função de trigger: ninguém deve chamar direto (o trigger dispara mesmo sem grant).
revoke execute on function public.trava_privilegio_profiles() from public, anon, authenticated;

-- Deixados de PROPÓSITO como estão (mexer traria risco/quebra):
--   - nome_ja_existe: precisa ser anônima (inscrição, antes do login).
--   - pode_editar_pessoas: usada dentro das políticas RLS — não mexer.
--   - senha_solicitacoes (insert anônimo): é o fluxo "esqueci a senha".
--   - buckets públicos "listáveis": baixo impacto; mexer pode quebrar imagens.
