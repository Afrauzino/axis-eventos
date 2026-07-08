-- ============================================================================
-- 37_menu_escalas.sql — Escalas vira MENU PRINCIPAL próprio + renomeia Equipes
-- ----------------------------------------------------------------------------
-- Rode no Supabase. É IDEMPOTENTE: pode rodar mais de uma vez sem duplicar
-- nem bagunçar a ordem.
--   (1) o menu "Equipes & Escalas" passa a se chamar só "Equipes";
--   (2) cria o item "Escalas" (rota /escalas) logo depois de Equipes, para
--       aparecer no menu e em Administração > Menus.
-- ============================================================================

-- (1) Renomeia Equipes (só se ainda estiver com o nome antigo)
update public.menu_config
   set label = 'Equipes'
 where key = 'menu_equipes' and label = 'Equipes & Escalas';

-- (2) Abre espaço logo após "Equipes" — só na primeira execução
update public.menu_config
   set ordem = ordem + 1
 where ordem > (select ordem from public.menu_config where key = 'menu_equipes')
   and not exists (select 1 from public.menu_config where key = 'menu_escalas');

-- (3) Cria o item Escalas (não duplica se já existir)
insert into public.menu_config (key, label, icon, emoji, rota, parent_id, ordem, visivel, roles)
select 'menu_escalas', 'Escalas', 'event_note', '🗓️', '/escalas', null,
       (select ordem from public.menu_config where key = 'menu_equipes') + 1,
       true, '{}'
 where not exists (select 1 from public.menu_config where key = 'menu_escalas');
