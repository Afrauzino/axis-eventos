-- ============================================================================
-- 73_seguranca_admin.sql — FECHA o escalonamento de privilégio no profiles
-- ----------------------------------------------------------------------------
-- FALHA (achada na auditoria): a policy profiles_update_own só tem
--   USING (user_id = auth.uid())  — sem restrição de coluna e sem WITH CHECK.
-- Resultado: um usuário comum logado consegue se auto-promover rodando
--   update profiles set is_admin=true, user_role='admin' where user_id = <o próprio>
-- e vira admin do app inteiro (aprova gente, apaga dados, tudo).
--
-- CONSERTO: um trigger BEFORE UPDATE que, para quem NÃO é admin, REVERTE
-- qualquer mudança nas colunas de privilégio (is_admin, user_role, role_status).
-- O self-update normal (nome, foto, telefone, last_seen...) continua funcionando.
-- Admin de verdade e operações de servidor (service role) passam sem travar.
-- Rode no Supabase: SQL Editor -> Run. Pode rodar de novo.
-- ============================================================================

create or replace function public.trava_privilegio_profiles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare atual_admin boolean;
begin
  -- Contexto de servidor (service role): auth.uid() é null -> confia e libera.
  if auth.uid() is null then
    return new;
  end if;

  -- Quem está executando é admin/pastor?
  select (p.is_admin = true or p.user_role in ('admin','pastor'))
    into atual_admin
    from public.profiles p
   where p.user_id = auth.uid();

  if coalesce(atual_admin, false) then
    return new;  -- admin pode mudar cargo/flag de qualquer um
  end if;

  -- NÃO-admin: reverte qualquer tentativa de mexer nas colunas de privilégio,
  -- mas deixa passar o resto (nome, foto, telefone, last_seen, etc.).
  new.is_admin    := old.is_admin;
  new.user_role   := old.user_role;
  new.role_status := old.role_status;
  return new;
end $$;

drop trigger if exists trg_trava_privilegio on public.profiles;
create trigger trg_trava_privilegio
  before update on public.profiles
  for each row execute function public.trava_privilegio_profiles();
