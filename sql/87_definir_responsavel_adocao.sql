-- ============================================================================
-- 87_definir_responsavel_adocao.sql
-- Admin / líder do correio pode DEFINIR (ou trocar) o responsável pela carta de
-- um encontrista, escolhendo QUALQUER encontreiro — não só adotar na própria conta.
--
-- Por quê um RPC: o INSERT direto em encontrista_adocao tem
--   with check (worker_user_id = auth.uid())  -> só deixa adotar pra si.
-- Este RPC é SECURITY DEFINER e checa a permissão POR DENTRO (admin OU
-- permissão correio/adocoes), então dá pra atribuir outro encontreiro com segurança.
--
-- Tirar responsável continua pelo DELETE normal (a policy adocao_delete já
-- permite dono / admin / líder do correio). JÁ RODADO no banco (2026-07-18).
-- ============================================================================
create or replace function public.definir_responsavel(p_encontrista uuid, p_worker uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ok boolean;
  v_event uuid;
  w record;
begin
  v_ok := is_admin() or exists (
    select 1 from public.permissoes pm
    join public.people pe on pe.id = pm.person_id
    where pe.user_id = auth.uid()
      and pm.modulo = 'correio' and pm.acao = 'adocoes' and pm.permitido = true
  );
  if not v_ok then raise exception 'Sem permissão para definir responsável.'; end if;

  select event_id into v_event from public.people where id = p_encontrista;
  select id, name, photo_url, phone, user_id into w from public.people where id = p_worker;
  if w.id is null then raise exception 'Responsável não encontrado.'; end if;

  -- substitui qualquer adoção existente (troca de responsável)
  delete from public.encontrista_adocao where encontrista_id = p_encontrista;
  insert into public.encontrista_adocao (event_id, encontrista_id, worker_user_id, worker_name, worker_photo, worker_phone)
  values (v_event, p_encontrista, w.user_id, w.name, w.photo_url, w.phone);
end;
$$;

grant execute on function public.definir_responsavel(uuid, uuid) to authenticated;
