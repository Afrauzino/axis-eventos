-- 93_backup_completo.sql
-- Backup COMPLETO do evento num único JSON (via RPC, sem estourar limite de URL).
-- Usado pelo botão "Backup COMPLETO (tudo)" em Administração → Backup.
-- Empacota TODAS as tabelas de dados do evento (exclui só logs de sistema:
-- audit_logs e acessos_log). Só admin executa.
create or replace function exportar_evento_completo(p_event uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then raise exception 'Sem usuário logado.'; end if;
  if not is_admin() then raise exception 'Apenas administradores podem exportar o evento.'; end if;
  return (select jsonb_build_object(
    'evento',        (select to_jsonb(e) from events e where e.id = p_event),
    'exportado_em',  now(),
    'completo',      true,
    'people',                    (select coalesce(jsonb_agg(to_jsonb(t)),'[]') from people t where t.event_id=p_event),
    'teams',                     (select coalesce(jsonb_agg(to_jsonb(t)),'[]') from teams t where t.event_id=p_event),
    'people_teams',              (select coalesce(jsonb_agg(to_jsonb(t)),'[]') from people_teams t where t.person_id in (select id from people where event_id=p_event) or t.team_id in (select id from teams where event_id=p_event)),
    'theaters',                  (select coalesce(jsonb_agg(to_jsonb(t)),'[]') from theaters t where t.event_id=p_event),
    'teatro_elenco',             (select coalesce(jsonb_agg(to_jsonb(t)),'[]') from teatro_elenco t where t.theater_id in (select id from theaters where event_id=p_event)),
    'teatro_midias',             (select coalesce(jsonb_agg(to_jsonb(t)),'[]') from teatro_midias t where t.theater_id in (select id from theaters where event_id=p_event)),
    'teatro_cenas',              (select coalesce(jsonb_agg(to_jsonb(t)),'[]') from teatro_cenas t where t.theater_id in (select id from theaters where event_id=p_event)),
    'ministracoes',              (select coalesce(jsonb_agg(to_jsonb(t)),'[]') from "ministrações" t where t.event_id=p_event),
    'cronograma_eventos',        (select coalesce(jsonb_agg(to_jsonb(t)),'[]') from cronograma_eventos t where t.event_id=p_event),
    'locais',                    (select coalesce(jsonb_agg(to_jsonb(t)),'[]') from locais t where t.event_id=p_event),
    'refeicao_tipos',            (select coalesce(jsonb_agg(to_jsonb(t)),'[]') from refeicao_tipos t where t.event_id=p_event),
    'financeiro',                (select coalesce(jsonb_agg(to_jsonb(t)),'[]') from financeiro t where t.event_id=p_event),
    'doacoes',                   (select coalesce(jsonb_agg(to_jsonb(t)),'[]') from doacoes t where t.event_id=p_event),
    'occurrences',               (select coalesce(jsonb_agg(to_jsonb(t)),'[]') from occurrences t where t.event_id=p_event),
    'saude_fichas',              (select coalesce(jsonb_agg(to_jsonb(t)),'[]') from saude_fichas t where t.event_id=p_event),
    'medications',               (select coalesce(jsonb_agg(to_jsonb(t)),'[]') from medications t where t.event_id=p_event),
    'med_agenda',                (select coalesce(jsonb_agg(to_jsonb(t)),'[]') from med_agenda t where t.event_id=p_event),
    'med_controlados',           (select coalesce(jsonb_agg(to_jsonb(t)),'[]') from med_controlados t where t.event_id=p_event),
    'medicamento_entregas',      (select coalesce(jsonb_agg(to_jsonb(t)),'[]') from medicamento_entregas t where t.medication_id in (select id from medications where event_id=p_event)),
    'escalas',                   (select coalesce(jsonb_agg(to_jsonb(t)),'[]') from escalas t where t.event_id=p_event),
    'escala_solicitacoes',       (select coalesce(jsonb_agg(to_jsonb(t)),'[]') from escala_solicitacoes t where t.event_id=p_event),
    'logistica_pessoa',          (select coalesce(jsonb_agg(to_jsonb(t)),'[]') from logistica_pessoa t where t.event_id=p_event),
    'logistica_checklist_itens', (select coalesce(jsonb_agg(to_jsonb(t)),'[]') from logistica_checklist_itens t where t.event_id=p_event),
    'logistica_checklist_status',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from logistica_checklist_status t where t.event_id=p_event),
    'correio_padrinhos',         (select coalesce(jsonb_agg(to_jsonb(t)),'[]') from correio_padrinhos t where t.event_id=p_event),
    'correio_afiliado_status',   (select coalesce(jsonb_agg(to_jsonb(t)),'[]') from correio_afiliado_status t where t.event_id=p_event),
    'correio_arquivos',          (select coalesce(jsonb_agg(to_jsonb(t)),'[]') from correio_arquivos t where t.event_id=p_event),
    'correio_checklist_itens',   (select coalesce(jsonb_agg(to_jsonb(t)),'[]') from correio_checklist_itens t where t.event_id=p_event),
    'correio_checklist_status',  (select coalesce(jsonb_agg(to_jsonb(t)),'[]') from correio_checklist_status t where t.event_id=p_event),
    'cozinha_cardapios',         (select coalesce(jsonb_agg(to_jsonb(t)),'[]') from cozinha_cardapios t where t.event_id=p_event),
    'cozinha_conclusoes',        (select coalesce(jsonb_agg(to_jsonb(t)),'[]') from cozinha_conclusoes t where t.event_id=p_event),
    'mural_posts',               (select coalesce(jsonb_agg(to_jsonb(t)),'[]') from mural_posts t where t.event_id=p_event),
    'mural_comentarios',         (select coalesce(jsonb_agg(to_jsonb(t)),'[]') from mural_comentarios t where t.event_id=p_event),
    'mural_curtidas',            (select coalesce(jsonb_agg(to_jsonb(t)),'[]') from mural_curtidas t where t.event_id=p_event),
    'ranking_categorias',        (select coalesce(jsonb_agg(to_jsonb(t)),'[]') from ranking_categorias t where t.event_id=p_event),
    'ranking_votos',             (select coalesce(jsonb_agg(to_jsonb(t)),'[]') from ranking_votos t where t.event_id=p_event),
    'avaliacoes',                (select coalesce(jsonb_agg(to_jsonb(t)),'[]') from avaliacoes t where t.event_id=p_event),
    'crachas',                   (select coalesce(jsonb_agg(to_jsonb(t)),'[]') from crachas t where t.event_id=p_event),
    'midias',                    (select coalesce(jsonb_agg(to_jsonb(t)),'[]') from midias t where t.event_id=p_event),
    'arquivos_modulo',           (select coalesce(jsonb_agg(to_jsonb(t)),'[]') from arquivos_modulo t where t.event_id=p_event),
    'alerts',                    (select coalesce(jsonb_agg(to_jsonb(t)),'[]') from alerts t where t.event_id=p_event),
    'alertas_lideres',           (select coalesce(jsonb_agg(to_jsonb(t)),'[]') from alertas_lideres t where t.event_id=p_event),
    'encontrista_adocao',        (select coalesce(jsonb_agg(to_jsonb(t)),'[]') from encontrista_adocao t where t.event_id=p_event),
    'encontrista_conhecidos',    (select coalesce(jsonb_agg(to_jsonb(t)),'[]') from encontrista_conhecidos t where t.event_id=p_event)
  ));
end $function$;
grant execute on function exportar_evento_completo(uuid) to authenticated;
