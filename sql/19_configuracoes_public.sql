-- ============================================================================
-- 19_configuracoes_public.sql — LEITURA PÚBLICA DO TEMA (rode no Supabase)
-- ----------------------------------------------------------------------------
-- A tela de LOGIN é acessada SEM estar logado (usuário anônimo). Ela precisa
-- ler a cor do sistema e a logo (tabela `configuracoes`). Como o RLS só
-- deixava usuário autenticado ler, o login mostrava a cor/logo PADRÃO.
-- Aqui liberamos apenas a LEITURA pública dessa tabela (só guarda tema:
-- cor_primaria, logo_url — nada sensível). Escrita continua restrita.
-- ============================================================================

alter table public.configuracoes enable row level security;

-- Qualquer um (inclusive não logado) pode LER o tema
drop policy if exists "config_select_public" on public.configuracoes;
create policy "config_select_public" on public.configuracoes
  for select using (true);

-- Só admin escreve (mantém o controle)
drop policy if exists "config_write_admin" on public.configuracoes;
create policy "config_write_admin" on public.configuracoes
  for all using (is_admin()) with check (is_admin());
