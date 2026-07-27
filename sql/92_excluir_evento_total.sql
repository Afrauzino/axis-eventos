-- 92_excluir_evento_total.sql
-- "Excluir evento" agora apaga TUDO mesmo (inclusive cadastros/people) e não deixa
-- nada do passado vazar pro evento futuro.
--
-- Bug corrigido: `ministrações` tinha event_id SEM cascade e link mútuo com `theaters`
-- (ministrações.theater_id -> theaters e theaters.ministracao_id -> ministrações, ambos
-- "no action"). Ao excluir o evento, os theaters eram apagados (cascade) mas a ministração
-- ficava apontando pra um teatro apagado -> violação de FK -> o excluir TRAVAVA. E ainda
-- deixava as ministrações como lixo órfão.
--
-- Testado (evento de teste com o link + pessoa + equipe + cronograma): apaga 100%, sem travar.

-- 1) ministrações passa a apagar JUNTO com o evento (cascade) — conserta o travamento e o órfão.
alter table "ministrações" drop constraint if exists ministracoes_event_fk;
alter table "ministrações"
  add constraint ministracoes_event_fk
  foreign key (event_id) references events(id) on delete cascade;

-- 2) RPC completa: limpa as tabelas com event_id SEM cascade próprio (folhas) e depois
--    apaga o evento (o cascade limpa people/cadastros, teams, cronograma, ministrações,
--    theaters, saúde, financeiro, escalas, correio, ranking, mural, doações, cozinha, etc.).
create or replace function excluir_evento_completo(p_event uuid, p_apagar_contas boolean default true)
returns jsonb
language plpgsql
security definer
set search_path to 'public','auth'
as $function$
declare v_uids uuid[]; v_nome text; v_contas int := 0;
begin
  if auth.uid() is null then raise exception 'Sem usuário logado.'; end if;
  if not is_admin()     then raise exception 'Apenas administradores podem excluir eventos.'; end if;

  select name into v_nome from public.events where id = p_event;
  if v_nome is null then raise exception 'Evento não encontrado.'; end if;

  select array_agg(distinct user_id) into v_uids
    from public.people where event_id = p_event and user_id is not null;

  -- sobras com event_id mas SEM cascade próprio (folhas) — apaga antes do evento
  delete from public.acessos_log            where event_id = p_event;
  delete from public.encontrista_adocao     where event_id = p_event;
  delete from public.encontrista_conhecidos where event_id = p_event;
  delete from public.escala_solicitacoes    where event_id = p_event;
  delete from public.mural_curtidas         where event_id = p_event;
  delete from public.mural_comentarios      where event_id = p_event;

  -- apaga o evento -> cascade limpa TODO o resto (inclusive cadastros/people)
  delete from public.events where id = p_event;

  -- opcional: apaga logins de quem ficou sem nenhum evento (nunca admin/pastor)
  if p_apagar_contas and v_uids is not null then
    delete from auth.users u
     where u.id = any(v_uids)
       and not exists (select 1 from public.people   p  where p.user_id = u.id)
       and not exists (select 1 from public.profiles pr where pr.user_id = u.id
                          and (coalesce(pr.is_admin,false) or pr.user_role in ('admin','pastor')));
    get diagnostics v_contas = row_count;
  end if;

  return jsonb_build_object('ok', true, 'evento', v_nome, 'contas_removidas', v_contas);
end $function$;
