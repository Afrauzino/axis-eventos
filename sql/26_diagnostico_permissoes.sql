-- ============================================================================
-- 26_diagnostico_permissoes.sql — SOMENTE LEITURA (não muda nada no banco)
-- Consulta ÚNICA: devolve uma tabela só, com a coluna "secao" dizendo o que é
-- cada bloco. O Supabase só mostra o resultado da última consulta quando se
-- roda várias juntas — por isso está tudo unido aqui.
-- Rode no SQL Editor e cole TODO o resultado (a coluna "dados" vem em JSON).
-- ============================================================================

with
-- 1) Quais tabelas de permissão existem
tabelas as (
  select '1_tabelas_permissao' as secao,
         coalesce(jsonb_agg(table_name order by table_name), '[]'::jsonb) as dados
  from information_schema.tables
  where table_schema='public' and table_name ilike '%permiss%'
),
-- 2) Total de linhas em permissoes (PT)
perm_total as (
  select '2_permissoes_total' as secao, to_jsonb(count(*)) as dados
  from public.permissoes
),
-- 3) Módulos/ações configurados em permissoes
perm_grupo as (
  select '3_permissoes_por_modulo' as secao,
         coalesce(jsonb_agg(row_to_json(g)), '[]'::jsonb) as dados
  from (
    select modulo, acao, permitido, count(*) as qtd,
           count(*) filter (where person_id is not null) as via_pessoa,
           count(*) filter (where team_id  is not null) as via_equipe,
           count(*) filter (where role     is not null) as via_cargo
    from public.permissoes
    group by modulo, acao, permitido
    order by modulo, acao
  ) g
),
-- 4) Colunas da tabela permissoes
perm_cols as (
  select '4_permissoes_colunas' as secao,
         coalesce(jsonb_agg(jsonb_build_object('coluna',column_name,'tipo',data_type)
                            order by column_name), '[]'::jsonb) as dados
  from information_schema.columns
  where table_schema='public' and table_name='permissoes'
),
-- 5) TODAS as policies reais do banco (o que está aplicado de verdade)
policies as (
  select '5_policies' as secao,
         coalesce(jsonb_agg(jsonb_build_object(
           'tabela', tablename, 'policy', policyname, 'cmd', cmd,
           'permissive', permissive, 'using', qual, 'with_check', with_check
         ) order by tablename, cmd, policyname), '[]'::jsonb) as dados
  from pg_policies
  where schemaname='public'
),
-- 6) Corpo das funções-chave
funcoes as (
  select '6_funcoes' as secao,
         coalesce(jsonb_agg(jsonb_build_object('funcao', proname,
                            'definicao', pg_get_functiondef(oid))), '[]'::jsonb) as dados
  from pg_proc
  where pronamespace='public'::regnamespace
    and proname in ('has_permission','is_admin','is_approved','pode_editar_pessoas')
),
-- 7) Cargos existentes em profiles
cargos as (
  select '7_cargos' as secao,
         coalesce(jsonb_agg(row_to_json(c)), '[]'::jsonb) as dados
  from (
    select user_role, role_status, count(*) as qtd
    from public.profiles
    group by user_role, role_status
    order by user_role, role_status
  ) c
),
-- 8) people.user_id preenchido?
people_link as (
  select '8_people_user_id' as secao,
         jsonb_build_object(
           'total', count(*),
           'com_user_id', count(*) filter (where user_id is not null),
           'sem_user_id', count(*) filter (where user_id is null)
         ) as dados
  from public.people
)
select * from tabelas
union all select * from perm_total
union all select * from perm_grupo
union all select * from perm_cols
union all select * from policies
union all select * from funcoes
union all select * from cargos
union all select * from people_link;
