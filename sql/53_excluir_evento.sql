-- ============================================================================
-- 53_excluir_evento.sql — Excluir um EVENTO de verdade, do banco, sem deixar lixo
-- ----------------------------------------------------------------------------
-- PROBLEMA: o app apagava o evento com ~12 `delete` soltos do navegador, e
--   ESQUECIA várias tabelas (saúde, correio, medicamentos, ranking, mural,
--   teatro-cenas, logística…). Sob RLS, um delete barrado NÃO dá erro — some 0
--   linhas em silêncio. Foi isso que criou as equipes/ministrações fantasmas.
--
-- SOLUÇÃO (2 partes):
--   1) TODA coluna que aponta pra events(id) passa a ser ON DELETE CASCADE.
--      Assim, apagar o evento limpa tudo que é dele — inclusive tabelas futuras.
--   2) Uma função (SECURITY DEFINER) que apaga o evento e, opcionalmente, os
--      LOGINS das pessoas que ficaram sem nenhum outro evento (libera os emails).
--      Só admin; numa transação; se algo falhar, nada é apagado.
--
-- Não altera nenhum dado agora. Rode no Supabase: SQL Editor -> Run.
-- ============================================================================

-- 1) event_id -> ON DELETE CASCADE (dinâmico, cobre todas as tabelas)
do $$
declare r record;
begin
  for r in
    select con.conname, con.conrelid::regclass::text as tbl, att.attname as col
    from pg_constraint con
    join pg_class     ref   on ref.oid   = con.confrelid
    join pg_namespace refns on refns.oid = ref.relnamespace
    join pg_attribute att   on att.attrelid = con.conrelid and att.attnum = con.conkey[1]
    where con.contype='f' and refns.nspname='public' and ref.relname='events'
      and array_length(con.conkey,1)=1
      and con.confdeltype <> 'c'   -- ainda NÃO é cascade
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    execute format('alter table %s add constraint %I foreign key (%I) references public.events(id) on delete cascade not valid',
                   r.tbl, r.conname, r.col);
    begin
      execute format('alter table %s validate constraint %I', r.tbl, r.conname);
      raise notice 'cascade ok: % . %', r.tbl, r.conname;
    exception when others then
      raise notice 'cascade (vale daqui pra frente): % . %', r.tbl, r.conname;
    end;
  end loop;
end $$;


-- 2) Função de exclusão de evento
create or replace function public.excluir_evento_completo(
  p_event uuid,
  p_apagar_contas boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uids   uuid[];
  v_nome   text;
  v_contas int := 0;
begin
  if auth.uid() is null then raise exception 'Sem usuário logado.'; end if;
  if not is_admin()     then raise exception 'Apenas administradores podem excluir eventos.'; end if;

  select name into v_nome from public.events where id = p_event;
  if v_nome is null then raise exception 'Evento não encontrado.'; end if;

  -- guarda os logins das pessoas DESTE evento (antes do cascade apagar people)
  select array_agg(distinct user_id) into v_uids
    from public.people where event_id = p_event and user_id is not null;

  -- apaga o evento -> o cascade limpa teams, escalas, people, saúde, teatro, ranking, mural…
  delete from public.events where id = p_event;

  -- opcional: apaga o login das pessoas que ficaram SEM nenhum outro evento (libera o email).
  -- Nunca apaga admin/pastor. A remoção do auth.users leva o profile junto (cascade do sql/45).
  if p_apagar_contas and v_uids is not null then
    delete from auth.users u
     where u.id = any(v_uids)
       and not exists (select 1 from public.people   p  where p.user_id = u.id)
       and not exists (select 1 from public.profiles pr where pr.user_id = u.id
                          and (coalesce(pr.is_admin,false) or pr.user_role in ('admin','pastor')));
    get diagnostics v_contas = row_count;
  end if;

  return jsonb_build_object('ok', true, 'evento', v_nome, 'contas_removidas', v_contas);
end $$;

revoke all on function public.excluir_evento_completo(uuid, boolean) from public;
grant execute on function public.excluir_evento_completo(uuid, boolean) to authenticated;

notify pgrst, 'reload schema';
