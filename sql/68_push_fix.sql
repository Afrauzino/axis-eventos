-- ============================================================================
-- 68_push_fix.sql — conserta o Web Push no celular (assinatura por aparelho)
-- ----------------------------------------------------------------------------
-- PROBLEMA: push_subscriptions só tinha policy de INSERT/SELECT/DELETE. O app
-- salvava a assinatura com upsert(onConflict:'endpoint') = INSERT ... ON CONFLICT
-- DO UPDATE. Quando um SEGUNDO usuário logava no MESMO aparelho (mesmo endpoint),
-- o caminho UPDATE era bloqueado pela RLS (não havia policy de UPDATE) → a row
-- continuava amarrada ao PRIMEIRO usuário. Aí o push ia pro dono antigo e a
-- pessoa logada não recebia nada no celular (só no "sininho" in-app).
--
-- SOLUÇÃO: uma função SECURITY DEFINER que SEMPRE reamarra o endpoint ao usuário
-- logado (apaga o dono antigo daquele aparelho e grava pro atual). O app passa a
-- chamar essa função em vez do upsert. Assim, no mesmo celular, quem está logado
-- AGORA é quem recebe — que é o certo (1 aparelho = 1 pessoa por vez).
-- Rode no Supabase: SQL Editor -> Run.
-- ============================================================================

-- Rede de segurança: garante policy de UPDATE (não atrapalha; a função abaixo é a
-- que resolve o caso multi-conta, mas isto deixa o upsert do mesmo dono funcionar).
drop policy if exists "push_upd" on public.push_subscriptions;
create policy "push_upd" on public.push_subscriptions
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Função definitiva: reamarra a assinatura DESTE aparelho ao usuário logado.
create or replace function public.salvar_push_assinatura(
  p_endpoint text,
  p_p256dh   text,
  p_auth     text,
  p_ua       text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'não autenticado';
  end if;
  -- tira o dono antigo deste MESMO aparelho (mesmo endpoint) — pode ser outra conta
  delete from public.push_subscriptions where endpoint = p_endpoint;
  -- grava pro usuário logado agora
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(coalesce(p_ua, ''), 200));
end;
$$;

grant execute on function public.salvar_push_assinatura(text, text, text, text) to authenticated;

notify pgrst, 'reload schema';
