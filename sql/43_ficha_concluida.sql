-- ============================================================================
-- 43_ficha_concluida.sql — marca quando o encontrista concluiu a ficha médica
-- na tela inicial (aí o bloco some da home dele). Editar depois (por um
-- responsável na Saúde) NÃO muda isso — o bloco continua sumido pra ele.
-- ============================================================================

alter table public.saude_fichas add column if not exists concluida boolean not null default false;
