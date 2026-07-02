-- ============================================================================
-- 16_audit_triggers.sql — AUDITORIA AUTOMÁTICA NO BANCO (rode no Supabase)
-- ----------------------------------------------------------------------------
-- Registra TODA inserção/edição/exclusão nas tabelas importantes em audit_logs,
-- capturando: quem fez (auth.uid + nome), a ação (create/update/delete), a
-- tabela, o id do registro, o evento, e os valores antigos/novos (metadata).
-- Não depende do app chamar log — pega tudo, inclusive "cagada" feita direto.
-- Requer a tabela audit_logs (sql/05_audit_logs.sql).
-- ============================================================================

create or replace function public.fn_audit()
returns trigger
language plpgsql
security definer            -- grava no audit_logs mesmo com RLS ligado
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_actor text;
  v_row   jsonb;
  v_eid   uuid;
  v_entid uuid;
begin
  -- nome de quem fez (snapshot)
  begin select name into v_actor from public.profiles where user_id = v_uid; exception when others then v_actor := null; end;

  if tg_op = 'DELETE' then v_row := to_jsonb(old); else v_row := to_jsonb(new); end if;
  begin v_entid := (v_row->>'id')::uuid;       exception when others then v_entid := null; end;
  begin v_eid   := (v_row->>'event_id')::uuid; exception when others then v_eid   := null; end;

  insert into public.audit_logs(event_id, user_id, actor_name, action, entity, entity_id, description, metadata)
  values (
    v_eid, v_uid, v_actor,
    case tg_op when 'INSERT' then 'create' when 'UPDATE' then 'update' when 'DELETE' then 'delete' else 'other' end,
    tg_table_name, v_entid,
    null,
    case tg_op
      when 'UPDATE' then jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new))
      when 'DELETE' then jsonb_build_object('old', to_jsonb(old))
      else               jsonb_build_object('new', to_jsonb(new))
    end
  );

  if tg_op = 'DELETE' then return old; else return new; end if;
exception when others then
  -- auditoria JAMAIS quebra a ação principal
  if tg_op = 'DELETE' then return old; else return new; end if;
end $$;

-- Anexa o trigger em todas as tabelas relevantes que existirem
do $$
declare
  t text;
  tabelas text[] := array[
    'people','profiles','teams','people_teams','escalas',
    'ministrações','theaters','teatro_cenas','teatro_elenco','teatro_midias',
    'cronograma_eventos','cronograma_tipos',
    'financeiro','doacoes',
    'saude_fichas','med_controlados','med_agenda','medicamento_entregas',
    'correio_padrinhos','correio_checklist_itens','correio_checklist_status','correio_arquivos','correio_afiliado_status',
    'ranking_categorias','ranking_votos',
    'cozinha_cardapios','refeicao_tipos','locais','crachas','permissoes',
    'events','alertas','occurrences','midias','arquivos_modulo','menu_config'
  ];
begin
  foreach t in array tabelas loop
    if exists (select 1 from information_schema.tables where table_schema='public' and table_name=t) then
      execute format('drop trigger if exists trg_audit on public.%I;', t);
      execute format('create trigger trg_audit after insert or update or delete on public.%I for each row execute function public.fn_audit();', t);
    end if;
  end loop;
end $$;

-- Conferir onde o trigger ficou ativo:
-- select event_object_table from information_schema.triggers where trigger_name='trg_audit' order by 1;
