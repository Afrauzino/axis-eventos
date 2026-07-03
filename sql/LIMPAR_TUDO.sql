-- ============================================================================
-- LIMPAR_TUDO.sql — RESET PARA COMEÇAR LIMPO (rode no SQL Editor do Supabase)
-- ----------------------------------------------------------------------------
-- ⚠️  APAGA TODOS OS DADOS DE TESTE: eventos, pessoas, equipes, financeiro,
--     saúde, medicamentos, correio, cozinha, teatro, cronograma, ranking,
--     ocorrências, alertas, crachás, mídias, logs, permissões.
-- ✅  MANTÉM: sua conta admin (profiles com user_role='admin') e as
--     CONFIGURAÇÕES do app — tema/cor, logo, boas-vindas (configuracoes),
--     menu (menu_config), tipos de cronograma, personagens/objetos globais,
--     carrossel (home_midias).
--
-- >>> FAÇA UM BACKUP ANTES (Admin → Backup → Exportar) se quiser guardar o teste. <<<
-- >>> Isto é IRREVERSÍVEL. <<<
--
-- ⚠️  Este script NÃO apaga as FOTOS/ARQUIVOS (Storage). O Supabase bloqueia
--     apagar storage por SQL — faça pelo painel Storage. Passo a passo em
--     docs/LIMPAR_STORAGE.md.
--
-- Obs: os LOGINS (auth.users) das pessoas removidas continuam existindo, mas
--      sem profile elas não têm acesso. Para apagá-los de vez: Supabase →
--      Authentication → Users → excluir manualmente (menos a sua conta).
-- ============================================================================

-- Desliga checagem de FK e triggers (inclui o de auditoria) durante a limpeza
set session_replication_role = 'replica';

do $$
declare
  t text;
  -- tabelas de DADOS a zerar (NÃO inclui config/global que queremos manter)
  tabelas text[] := array[
    'audit_logs','arquivos_modulo','notif_lidas',
    'home_midias',                          -- (remova daqui se quiser MANTER o carrossel)
    'med_agenda','medicamento_entregas','med_controlados','saude_fichas',
    'correio_arquivos','correio_checklist_status','correio_checklist_itens','correio_padrinhos','correio_afiliado_status',
    'ranking_votos','ranking_categorias',
    'teatro_objetos_uso','teatro_elenco','teatro_cenas','teatro_midias','theaters',
    'cronograma_eventos',
    'logistica_checklist_status','logistica_checklist_itens','logistica_pessoa',
    'schedule_assignments','schedules','escalas',
    'financeiro','doacoes','medications',
    'cozinha_cardapios','refeicao_tipos','crachas','midias','locais','occurrences',
    'alert_reads','alerts','alertas_lideres_dest','alertas_lideres',
    'permissoes','people_teams','people','events'
  ];
begin
  foreach t in array tabelas loop
    if exists (select 1 from information_schema.tables where table_schema='public' and table_name=t) then
      execute format('delete from public.%I;', t);
    end if;
  end loop;

  -- Perfis: mantém só o(s) admin(s)
  delete from public.profiles where coalesce(user_role,'') <> 'admin';
end $$;

-- Religa as checagens
set session_replication_role = 'origin';

-- ----------------------------------------------------------------------------
-- (OPCIONAL) APAGAR OS LOGINS de teste (auth.users), MANTENDO OS ADMINS.
-- SEGURO: mantém quem tem perfil com user_role='admin'; apaga o resto.
-- (Sem digitar email — não tem como errar e apagar a si mesmo.)
-- Rode DEPOIS da limpeza acima (que já manteve só os perfis admin). Descomente:
-- ----------------------------------------------------------------------------
-- delete from auth.users u
-- where not exists (
--   select 1 from public.profiles p
--   where p.user_id = u.id and p.user_role = 'admin'
-- );
--
-- (Alternativa sem SQL: Supabase → Authentication → Users → excluir manualmente.)

-- Conferência rápida (deve sobrar só o admin em profiles e 0 em events/people)
select 'profiles' as tabela, count(*) as linhas from public.profiles
union all select 'events', count(*) from public.events
union all select 'people', count(*) from public.people;
