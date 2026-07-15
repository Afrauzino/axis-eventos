-- ============================================================================
-- 80_notificacoes_push_tudo.sql  —  "RODE ISTO" pra destravar o push no celular
-- ----------------------------------------------------------------------------
-- Junta num arquivo só os dois consertos que o push precisa (já existiam soltos
-- em 68 e 69) e NO FIM imprime um RELATÓRIO do estado atual. É idempotente:
-- pode rodar quantas vezes quiser, não quebra nada.
--
-- Por que o push "só cai no sininho" e não no celular, quase sempre é UMA destas:
--   (1) o service_role perdeu acesso ao schema public (migração de chaves do
--       Supabase) -> a Edge Function enviar-push toma "permission denied" ao ler
--       as assinaturas. CONSERTO: os GRANTs abaixo.
--   (2) a assinatura do aparelho ficou amarrada a OUTRA conta (mesmo celular,
--       outro login). CONSERTO: a função salvar_push_assinatura reamarra sempre
--       ao usuário logado agora.
--   (3) a Edge Function enviar-push NÃO foi republicada depois do conserto — o
--       código no repo está certo, mas o Supabase roda a versão publicada.
--       Isso NÃO dá pra fazer por SQL: Dashboard -> Edge Functions -> enviar-push
--       -> Deploy/Republish (ou `supabase functions deploy enviar-push`).
--
-- COMO USAR: Supabase -> SQL Editor -> cole tudo -> Run. Leia o RELATÓRIO no fim.
-- Depois REPUBLIQUE a Edge Function enviar-push e teste no celular
-- (Perfil -> Notificações -> "Rodar diagnóstico completo").
-- ============================================================================

-- (1) service_role enxerga o public de novo (server-only; RLS segue protegendo o resto)
grant usage on schema public to service_role;
grant all privileges on all tables    in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant all privileges on all routines  in schema public to service_role;
alter default privileges in schema public grant all on tables    to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant all on routines  to service_role;
grant usage on schema public to anon, authenticated;

-- (2) policy de UPDATE + função que reamarra a assinatura ao usuário logado
drop policy if exists "push_upd" on public.push_subscriptions;
create policy "push_upd" on public.push_subscriptions
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.salvar_push_assinatura(
  p_endpoint text, p_p256dh text, p_auth text, p_ua text
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;
  delete from public.push_subscriptions where endpoint = p_endpoint;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(coalesce(p_ua, ''), 200));
end;
$$;
grant execute on function public.salvar_push_assinatura(text, text, text, text) to authenticated;

notify pgrst, 'reload schema';

-- ============================================================================
-- RELATÓRIO — leia as 4 linhas abaixo depois do Run
-- ============================================================================

-- A) service_role tem USAGE no public? (tem que dizer 'OK')
select 'A) service_role USAGE public'::text as check,
       case when has_schema_privilege('service_role','public','USAGE')
            then 'OK' else 'FALTANDO — era esse o problema' end as resultado;

-- B) service_role consegue LER push_subscriptions? (tem que dizer 'OK')
select 'B) service_role SELECT push_subscriptions'::text as check,
       case when has_table_privilege('service_role','public.push_subscriptions','SELECT')
            then 'OK' else 'FALTANDO' end as resultado;

-- C) a função salvar_push_assinatura existe? (tem que dizer 'OK')
select 'C) função salvar_push_assinatura'::text as check,
       case when exists (select 1 from pg_proc where proname = 'salvar_push_assinatura')
            then 'OK' else 'FALTANDO' end as resultado;

-- D) quantos aparelhos estão inscritos pra receber push? (0 = ninguém vai receber;
--    aí o problema é a assinatura no celular, não o servidor — refaça em Perfil ->
--    Notificações -> Ativar; precisa ser o app instalado na tela inicial no iPhone)
select 'D) aparelhos inscritos (push_subscriptions)'::text as check,
       count(*)::text || ' assinatura(s)' as resultado
from public.push_subscriptions;
