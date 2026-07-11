-- ============================================================================
-- 69_grant_service_role.sql — restaura o acesso do service_role ao schema public
-- ----------------------------------------------------------------------------
-- SINTOMA: a Edge Function enviar-push devolveu "permission denied for schema
-- public" ao ler push_subscriptions com a chave de serviço. Ou seja: o papel
-- (role) que a chave de serviço usa PERDEU o USAGE no schema public. Isso veio
-- da migração de API keys do Supabase (as chaves legadas viraram DEPRECATED e o
-- projeto passou pelo sistema novo), não das nossas migrações.
--
-- ESTE SQL restaura o padrão do Supabase: service_role enxerga tudo do public
-- (ele é usado SÓ no servidor, com a chave secreta — nunca no navegador; RLS
-- continua protegendo anon/authenticated normalmente).
-- Rode no Supabase: SQL Editor -> Run. Depois republique a função enviar-push.
-- ============================================================================

grant usage on schema public to service_role;

grant all privileges on all tables    in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant all privileges on all routines  in schema public to service_role;

-- Tabelas/sequências/funções FUTURAS também já entram liberadas pro service_role
alter default privileges in schema public grant all on tables    to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant all on routines  to service_role;

-- Rede de segurança: garante também o USAGE de anon/authenticated (não muda RLS)
grant usage on schema public to anon, authenticated;

notify pgrst, 'reload schema';
