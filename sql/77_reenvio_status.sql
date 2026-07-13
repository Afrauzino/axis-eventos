-- ============================================================================
-- 77_reenvio_status.sql — deixa o cadastro RECUSADO voltar pra PENDENTE ao reenviar
-- ----------------------------------------------------------------------------
-- BUG (achado 13/07/2026): o trigger trg_trava_privilegio (sql/73) reverte
-- role_status pra QUALQUER não-admin. Isso quebrou o reenvio legítimo:
--   a pessoa recusada corrige o cadastro, chama reenviar_meu_cadastro()
--   (que faz role_status: 'rejected' -> 'pending'), mas o trigger REVERTE de
--   volta pra 'rejected' -> a pessoa fica PRESA na tela "Cadastro não aprovado"
--   e o admin nunca recebe pra reaprovar.
--
-- CONSERTO: no trigger, permitir SÓ a transição do PRÓPRIO cadastro
--   rejected -> pending (o reenvio). Todo o resto continua travado (a pessoa
--   NÃO se auto-aprova, NÃO vira admin, NÃO muda user_role).
--
-- Rodar no Supabase (SQL Editor). Pode rodar de novo.
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

  -- NÃO-admin: is_admin e user_role SEMPRE revertidos (sem auto-promoção).
  new.is_admin  := old.is_admin;
  new.user_role := old.user_role;

  -- role_status também é revertido, EXCETO o reenvio do PRÓPRIO cadastro
  -- (rejected -> pending): a pessoa corrige e volta pra fila de aprovação.
  if not (old.role_status = 'rejected'
          and new.role_status = 'pending'
          and old.user_id = auth.uid()) then
    new.role_status := old.role_status;
  end if;

  return new;
end $$;

notify pgrst, 'reload schema';
