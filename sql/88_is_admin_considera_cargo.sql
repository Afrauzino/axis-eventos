-- ============================================================================
-- 88_is_admin_considera_cargo.sql
-- REGRA MÁXIMA: dar admin a alguém = MESMO acesso do dono, sem restrições.
--
-- Bug: a função is_admin() (usada por TODAS as 23 políticas RLS e por funções
-- como admin_emails, excluir_evento_completo, definir_responsavel…) olhava SÓ a
-- flag profiles.is_admin. Mas "dar admin" no app seta user_role='admin' (não a
-- flag). Logo, um admin PROMOVIDO tinha acesso no frontend (pode() considera o
-- cargo) mas NÃO no banco — não escrevia permissões, não apagava medicação, não
-- mexia em adoções, não excluía evento, etc.
--
-- Correção: is_admin() passa a considerar CARGO e flag, igual ao frontend
-- (isAdmin() = user_role in ('admin','pastor')) e às outras funções que já faziam
-- isso (_exige_admin, trava_privilegio_profiles). Um só conserto arruma as 23
-- políticas de uma vez. JÁ RODADO no banco (2026-07-20).
-- ============================================================================
create or replace function public.is_admin()
returns boolean
language sql
set search_path to 'public'
as $function$
  select coalesce(
    (select (is_admin = true or user_role in ('admin','pastor'))
       from public.profiles where user_id = auth.uid()),
    false
  );
$function$;
