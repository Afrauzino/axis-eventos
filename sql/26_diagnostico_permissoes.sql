-- ============================================================================
-- 26_diagnostico_permissoes.sql — SOMENTE LEITURA (não muda nada no banco)
-- Objetivo: levantar tudo que existe hoje sobre permissões pra decidir como
-- unificar de vez o sistema sem quebrar admin/pastor/secretaria.
-- Versão robusta: NÃO referencia direto nenhuma tabela que possa não existir
-- (descoberta: `permissions` em inglês NÃO existe neste banco).
-- Rode no SQL Editor do Supabase e cole TODO o resultado.
-- ============================================================================

-- 1) Quais tabelas relacionadas a permissão realmente EXISTEM neste banco?
select table_name
from information_schema.tables
where table_schema = 'public'
  and (table_name ilike '%permiss%')
order by table_name;

-- 2) A tabela `permissoes` (português) tem linhas? Essa é a que o app usa.
--    (Envolvido em bloco pra não quebrar caso o nome seja outro.)
select 'permissoes (PT) - total de linhas' as consulta, count(*) as total
from public.permissoes;

-- 3) Quais módulos/ações estão configurados hoje em `permissoes`
select modulo, acao, permitido, count(*) as qtd,
       count(*) filter (where person_id is not null) as via_pessoa,
       count(*) filter (where team_id is not null)   as via_equipe,
       count(*) filter (where role is not null)      as via_cargo
from public.permissoes
group by modulo, acao, permitido
order by modulo, acao;

-- 4) Colunas da tabela `permissoes` (pra confirmar o formato exato)
select column_name, data_type
from information_schema.columns
where table_schema='public' and table_name='permissoes'
order by column_name;

-- 5) TODAS as políticas (RLS) que existem HOJE no banco de verdade
--    (é aqui que mora o bug do "cria mas não edita"). Mostra o que está
--    realmente aplicado, não o que está nos arquivos .sql.
select tablename, policyname, cmd, permissive,
       qual        as regra_using,
       with_check  as regra_with_check
from pg_policies
where schemaname = 'public'
order by tablename, cmd, policyname;

-- 6) Definição atual das funções-chave usadas pelas policies
--    (queremos ver o corpo de has_permission — se ela aponta pra uma tabela
--    que não existe, é a causa raiz.)
select proname as funcao, pg_get_functiondef(oid) as definicao
from pg_proc
where proname in ('has_permission','is_admin','is_approved','pode_editar_pessoas')
  and pronamespace = 'public'::regnamespace;

-- 7) Cargos (user_role) e status que existem hoje em profiles
select user_role, role_status, count(*) as qtd
from public.profiles
group by user_role, role_status
order by user_role, role_status;

-- 8) `people.user_id` está preenchido? (link usado pra achar equipe/individual)
select
  count(*) as total_people,
  count(*) filter (where user_id is not null) as com_user_id,
  count(*) filter (where user_id is null)     as sem_user_id
from public.people;
