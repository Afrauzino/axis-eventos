-- ============================================================================
-- AUDITORIA_RLS.sql — RODE NO SQL EDITOR DO SUPABASE (antes de subir online)
-- ----------------------------------------------------------------------------
-- Por que: a "anon key" do app é PÚBLICA (vai no frontend). A única coisa que
-- protege os dados é o RLS (Row Level Security) estar HABILITADO + com policies
-- em TODAS as tabelas. Se alguma tabela estiver com RLS desabilitada, qualquer
-- pessoa com a anon key (todo mundo) pode ler/gravar aquela tabela.
-- ============================================================================

-- 1) Estado do RLS de cada tabela (as SEM rls e SEM policy aparecem primeiro)
select
  c.relname                                   as tabela,
  c.relrowsecurity                            as rls_habilitada,
  (select count(*) from pg_policies p
     where p.schemaname = 'public'
       and p.tablename = c.relname)           as qtd_policies
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'                          -- só tabelas
order by c.relrowsecurity asc, qtd_policies asc, tabela;

-- ----------------------------------------------------------------------------
-- 2) Tabelas PERIGOSAS: RLS desabilitada OU habilitada mas SEM nenhuma policy
--    (essas são as que precisam de atenção antes de ir para produção)
-- ----------------------------------------------------------------------------
select
  c.relname as tabela,
  case when c.relrowsecurity then 'RLS ligada, mas SEM policy (ninguém acessa OU tudo liberado conforme config)'
       else 'RLS DESLIGADA — dados EXPOSTOS para a anon key' end as risco
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
  and (
    c.relrowsecurity = false
    or (select count(*) from pg_policies p where p.schemaname='public' and p.tablename=c.relname) = 0
  )
order by c.relrowsecurity asc, tabela;

-- ----------------------------------------------------------------------------
-- 3) (OPCIONAL) Rede de segurança "negar anônimo": habilita RLS em TODAS as
--    tabelas do schema public. ATENÇÃO: rodar isto SEM criar policies vai
--    BLOQUEAR o app inteiro (inclusive usuários logados). Só use junto com as
--    policies certas. Está comentado de propósito — não rode às cegas.
-- ----------------------------------------------------------------------------
-- do $$
-- declare r record;
-- begin
--   for r in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
--            where n.nspname='public' and c.relkind='r' and c.relrowsecurity=false
--   loop
--     execute format('alter table public.%I enable row level security;', r.relname);
--   end loop;
-- end $$;
