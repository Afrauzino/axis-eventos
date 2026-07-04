-- ============================================================================
-- 26_diagnostico_permissoes.sql — SOMENTE LEITURA (não muda nada no banco)
-- Objetivo: levantar tudo que existe hoje sobre permissões pra decidir como
-- unificar de vez as duas tabelas (`permissions` em inglês vs `permissoes`
-- em português) sem quebrar admin/pastor/secretaria.
-- Rode no SQL Editor do Supabase e cole TODO o resultado (são 8 consultas,
-- vai aparecer 8 tabelas de resultado, uma embaixo da outra ou em abas).
-- ============================================================================

-- 1) A tabela `permissions` (inglês) tem alguma linha? (Se 0, ela está morta —
--    o app nunca gravou nela, e é por isso que has_permission() sempre falha
--    pra quem não é admin.)
select 'permissions (EN) - total de linhas' as consulta, count(*) as total from public.permissions;

-- 2) A tabela `permissoes` (português) tem linhas? Essa é a que o app usa de
--    verdade (tela Admin > Usuários/Equipes > Liberações).
select 'permissoes (PT) - total de linhas' as consulta, count(*) as total from public.permissoes;

-- 3) Quais módulos/ações estão realmente configurados hoje em `permissoes`
--    (pra saber quais telas usam permissão granular de verdade)
select modulo, acao, permitido, count(*) as qtd,
       count(*) filter (where person_id is not null) as via_pessoa,
       count(*) filter (where team_id is not null)   as via_equipe
from public.permissoes
group by modulo, acao, permitido
order by modulo, acao;

-- 4) Colunas de cada tabela (pra comparar os formatos)
select 'permissions (EN)' as tabela, column_name, data_type
from information_schema.columns
where table_schema='public' and table_name='permissions'
union all
select 'permissoes (PT)' as tabela, column_name, data_type
from information_schema.columns
where table_schema='public' and table_name='permissoes'
order by tabela, column_name;

-- 5) Todas as políticas (RLS) que existem hoje nas tabelas de conteúdo
--    (é aqui que mora o bug do "cria mas não edita" / "edita mas não cria")
select tablename, policyname, cmd, permissive, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'people','teams','schedules','schedule_assignments',
    'theaters','theater_cast','medications','alerts','alert_reads',
    'occurrences','permissions','permissoes','logistica_checklist_itens',
    'logistica_checklist_status','logistica_pessoa','midias','teatro_midias',
    'crachas','configuracoes'
  )
order by tablename, cmd, policyname;

-- 6) Definição atual das funções-chave usadas pelas policies
select proname as funcao, pg_get_functiondef(oid) as definicao
from pg_proc
where proname in ('has_permission','is_admin','is_approved','pode_editar_pessoas')
  and pronamespace = 'public'::regnamespace;

-- 7) Cargos (user_role) que existem hoje em profiles, com quantidade de gente
select user_role, role_status, count(*) as qtd
from public.profiles
group by user_role, role_status
order by user_role, role_status;

-- 8) Confere se `people.user_id` está preenchido (é o link usado por
--    `permissoes` pra achar equipe/individual da pessoa)
select
  count(*) as total_people,
  count(*) filter (where user_id is not null) as com_user_id,
  count(*) filter (where user_id is null) as sem_user_id
from public.people;
