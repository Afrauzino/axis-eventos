-- ============================================================================
-- 17_menu_config.sql — MENU CONFIGURÁVEL (rode no Supabase)
-- ----------------------------------------------------------------------------
-- Faz o menu real (Nav) passar a respeitar o menu_config: emoji, nome (label),
-- ordem e visível. A ESTRUTURA (rotas/submenus/permissões) continua no código
-- por segurança; aqui você personaliza emoji/nome/ordem/visibilidade.
-- Reseta o menu_config para o conjunto oficial de itens do topo do menu.
-- ============================================================================

alter table public.menu_config add column if not exists emoji text;

-- Reset e re-seed dos itens principais (key = a permissão do item no Nav)
delete from public.menu_config;

insert into public.menu_config (key, label, icon, emoji, rota, parent_id, ordem, visivel, roles) values
  ('menu_inicio',          'Início',            'home',            '🏠', '/',                 null, 1,  true, '{}'),
  ('menu_atividades',      'Minhas Atividades', 'checklist',       '✅', '/minhas-atividades',null, 2,  true, '{}'),
  ('menu_cronograma',      'Cronograma',        'calendar_month',  '📅', '/cronograma',       null, 3,  true, '{}'),
  ('menu_encontristas',    'Encontristas',      'groups',          '👥', '/encontristas',     null, 4,  true, '{}'),
  ('menu_cadastros',       'Cadastros',         'manage_accounts', '📝', '/cadastros',        null, 5,  true, '{}'),
  ('menu_ministracoes',    'Ministrações',      'church',          '🎤', '/ministracoes',     null, 6,  true, '{}'),
  ('menu_ranking',         'Ranking',           'leaderboard',     '🏆', '/ranking',          null, 7,  true, '{}'),
  ('menu_correio',         'Correio',           'mail',            '📬', '/correio',          null, 8,  true, '{}'),
  ('menu_logistica',       'Logística',         'inventory',       '📦', '/logistica',        null, 9,  true, '{}'),
  ('menu_midia',           'Mídia',             'perm_media',      '🎬', '/midia',            null, 10, true, '{}'),
  ('menu_cracha',          'Crachá',            'badge',           '🪪', '/cracha',           null, 11, true, '{}'),
  ('menu_alertas_lideres', 'Alertas',           'campaign',        '📢', '/alertas-lideres',  null, 12, true, '{}'),
  ('menu_cozinha',         'Cozinha',           'restaurant',      '🍴', '/cozinha',          null, 13, true, '{}'),
  ('menu_equipes',         'Equipes',           'shield',          '🛡️', null,               null, 14, true, '{}'),
  ('menu_escalas',         'Escalas',           'event_note',      '🗓️', '/escalas',         null, 15, true, '{}'),
  ('menu_teatro',          'Teatro',            'theater_comedy',  '🎭', null,               null, 16, true, '{}'),
  ('menu_evento',          'Evento',            'event',           '📍', null,               null, 17, true, '{}'),
  ('menu_saude',           'Saúde',             'medical_services','⛑️', null,               null, 18, true, '{}'),
  ('menu_financeiro',      'Financeiro',        'account_balance_wallet','💰', null,          null, 19, true, '{}'),
  ('menu_admin',           'Administração',     'admin_panel_settings',  '⚙️', null,          null, 20, true, '{}');
