-- ============================================================================
-- DIAG_TEMA.sql — por que a cor/logo não aparece no LOGIN (deslogado)?
-- Rode no SQL Editor do Supabase e veja os 3 resultados.
-- ============================================================================

-- 1) A cor está salva? (deve mostrar chave=cor_primaria e um valor tipo #6B46C1)
select chave, valor from public.configuracoes where chave in ('cor_primaria','logo_url');

-- 2) Existe policy de LEITURA PÚBLICA? (precisa ter uma com cmd=SELECT e qual=true)
select policyname, cmd, roles, qual
from pg_policies
where schemaname='public' and tablename='configuracoes';

-- 3) O usuário ANÔNIMO (tela de login) consegue ler? (deve devolver o valor)
set role anon;
select chave, valor from public.configuracoes where chave='cor_primaria';
reset role;

-- ----------------------------------------------------------------------------
-- Se o passo 3 vier VAZIO (mas o 1 tem valor), o RLS está bloqueando o anônimo.
-- CORREÇÃO: rode de novo o sql/19_configuracoes_public.sql (ele cria a policy
-- de leitura pública). É idempotente.
-- ----------------------------------------------------------------------------
