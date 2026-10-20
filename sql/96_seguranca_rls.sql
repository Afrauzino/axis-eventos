-- ============================================================================
-- 96 — Segurança do banco (RLS) — 2026-10-20. Idempotente.
--
-- PROBLEMA: quase todas as tabelas tinham regras "ins/upd/del" que só exigiam
-- ESTAR LOGADO (auth.uid() IS NOT NULL). Como a inscrição é aberta, qualquer
-- pessoa que criasse uma conta (ainda PENDENTE) podia, direto pela API:
--   • apagar o perfil de outra pessoa e recriar o próprio como admin;
--   • apagar/alterar eventos, cadastros, cronograma, financeiro, saúde…
-- E um visitante SEM login lia todos os cadastros que tinham código de convite.
--
-- REGRA NOVA (não muda nada para quem já é APROVADO):
--   • aprovado (profiles.role_status='approved') → continua podendo o que podia;
--   • pendente/recusado/bloqueado → só mexe no PRÓPRIO cadastro, ficha de saúde
--     e remédios (o que a inscrição precisa);
--   • perfis: ninguém cria perfil de outro nem apaga perfil (só admin);
--   • eventos: criar/apagar só admin ou quem tem "Administração: editar".
-- ============================================================================

-- ── 1. Tabelas comuns: "estar logado" → "estar APROVADO" ──────────────────────
do $$
declare r record; cond text := 'public.is_approved()';
begin
  for r in
    select tablename, policyname, cmd from pg_policies
    where schemaname = 'public'
      and cmd in ('INSERT','UPDATE','DELETE')
      and tablename not in ('profiles','events','people','saude_fichas','med_controlados','med_agenda',
                            'audit_logs','senha_solicitacoes','notif_lidas','push_subscriptions')
      and (   coalesce(qual,'')       = '(( SELECT auth.uid() AS uid) IS NOT NULL)'
           or coalesce(with_check,'') = '(( SELECT auth.uid() AS uid) IS NOT NULL)'
           or (tablename in ('cozinha_conclusoes','escala_checklist','escala_solicitacoes','mural_comentarios','mural_posts')
               and (qual = 'true' or with_check = 'true')))
  loop
    if r.cmd = 'INSERT' then
      execute format('alter policy %I on public.%I with check (%s)', r.policyname, r.tablename, cond);
    elsif r.cmd = 'DELETE' then
      execute format('alter policy %I on public.%I using (%s)', r.policyname, r.tablename, cond);
    else
      execute format('alter policy %I on public.%I using (%s) with check (%s)', r.policyname, r.tablename, cond, cond);
    end if;
  end loop;
end $$;

-- ── 2. Saúde e remédios: aprovado OU a própria pessoa (inscrição) ─────────────
do $$
declare t text; cond text :=
  '(public.is_approved() or person_id in (select pe.id from public.people pe where pe.user_id = auth.uid()))';
begin
  foreach t in array array['saude_fichas','med_controlados','med_agenda'] loop
    if exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname='ins') then
      execute format('alter policy ins on public.%I with check %s', t, cond); end if;
    if exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname='upd') then
      execute format('alter policy upd on public.%I using %s with check %s', t, cond, cond); end if;
    if exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname='del') then
      execute format('alter policy del on public.%I using %s', t, cond); end if;
  end loop;
end $$;

-- ── 3. Cadastros (people) ─────────────────────────────────────────────────────
alter policy ins on public.people with check (public.is_approved());
alter policy upd on public.people using (public.is_approved()) with check (public.is_approved());
alter policy del on public.people using (public.is_approved());
-- (people_insert_self continua: a pessoa cria o PRÓPRIO cadastro na inscrição)
-- A pessoa edita o PRÓPRIO cadastro:
drop policy if exists people_update_self on public.people;
create policy people_update_self on public.people for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Primeiro acesso por código: a conta nova "assume" o cadastro criado pela liderança.
drop policy if exists people_claim_convite on public.people;
create policy people_claim_convite on public.people for update to authenticated
  using (user_id is null and invite_code is not null) with check (user_id = auth.uid());

-- Visitante sem login lia TODO cadastro com código de convite (CPF, endereço…).
-- Agora só consulta o código que digitou, por esta função:
create or replace function public.buscar_convite(p_codigo text)
returns json
language sql
stable security definer
set search_path to 'public'
as $function$
  select to_json(t) from (
    select id, name, apelido, user_id, event_id, phone, church, role_type, sexo, birth_date, cpf, rg,
           cidade, estado, endereco, bairro, cep, contact_phone, photo_url, notes, ano_encontro, cargo
    from public.people
    where invite_code is not null and invite_code = upper(trim(p_codigo))
    limit 1
  ) t;
$function$;
revoke all on function public.buscar_convite(text) from public;
grant execute on function public.buscar_convite(text) to anon, authenticated, service_role;
-- A regra antiga (sel_anon) só é removida DEPOIS de publicar o app novo: ver sql/97.

-- ── 4. Perfis (profiles) ──────────────────────────────────────────────────────
alter policy ins on public.profiles with check (user_id = auth.uid() or public.is_admin());
alter policy upd on public.profiles using (public.is_approved()) with check (public.is_approved());
alter policy del on public.profiles using (public.is_admin());
-- (profiles_self_lastseen continua: cada um atualiza o PRÓPRIO perfil)

-- Perfil criado pelo app por quem NÃO é admin nasce sem privilégio
-- (antes: apagava o próprio perfil e recriava como admin).
create or replace function public.trava_privilegio_profiles_insert()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  new.is_admin    := false;
  new.user_role   := 'visitante';
  new.role_status := 'pending';
  return new;
end $function$;
drop trigger if exists trg_trava_privilegio_insert on public.profiles;
create trigger trg_trava_privilegio_insert before insert on public.profiles
  for each row execute function public.trava_privilegio_profiles_insert();

-- ── 5. Eventos ────────────────────────────────────────────────────────────────
alter policy ins on public.events with check (public.is_admin() or public.tem_permissao('menu_admin','editar'));
alter policy del on public.events using (public.is_admin() or public.tem_permissao('menu_admin','editar'));
alter policy upd on public.events using (public.is_approved()) with check (public.is_approved());

-- ── 6. Ajustes do "Security Advisor" do Supabase ──────────────────────────────
alter function public.cron_inicio_relogio_servidor() set search_path to 'public';
alter function public.adocao_status(uuid) set search_path to 'public';
-- funções de gatilho não precisam ser chamáveis pela API
revoke execute on function public.trava_privilegio_profiles_insert() from public, anon, authenticated;
revoke execute on function public.cron_inicio_relogio_servidor() from public, anon, authenticated;
