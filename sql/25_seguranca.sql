-- ============================================================================
-- 25_seguranca.sql — corrige os avisos de segurança IMPORTANTES do Supabase
-- SEM afetar o funcionamento do app. Rode no SQL Editor. Idempotente.
--
-- O que faz:
--  1) `configuracoes`: leitura continua PÚBLICA (login lê cor/logo), mas ESCRITA
--     passa a ser só de admin/pastor (antes qualquer um podia gravar).
--  2) Tira do público a permissão de CHAMAR direto as funções de gatilho
--     (fn_audit, handle_new_user, set_valor_pessoa). Os gatilhos continuam
--     funcionando normal — só bloqueia chamada manual via API.
--
-- NÃO mexe nos buckets de Storage de propósito: o app LISTA o bucket `avatars`
-- (foto de perfil), então trancar a listagem quebraria isso. O risco lá é baixo
-- (os arquivos já são públicos por URL).
-- ============================================================================

-- 1) configuracoes: leitura pública, escrita só admin ---------------------------
alter table public.configuracoes enable row level security;

drop policy if exists "config_all" on public.configuracoes;
drop policy if exists "configuracoes_select_public" on public.configuracoes;
drop policy if exists "configuracoes_write_admin" on public.configuracoes;

-- leitura para todos (anon + logado) — necessário p/ cor/logo no login
create policy "configuracoes_select_public" on public.configuracoes
  for select using (true);

-- escrita (insert/update/delete) só admin/pastor
create policy "configuracoes_write_admin" on public.configuracoes
  for all to authenticated
  using      (exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.user_role in ('admin','pastor')))
  with check (exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.user_role in ('admin','pastor')));

-- 2) tira do público a execução das funções de gatilho --------------------------
do $$
begin
  begin revoke execute on function public.fn_audit()        from public, anon, authenticated; exception when undefined_function then null; end;
  begin revoke execute on function public.handle_new_user() from public, anon, authenticated; exception when undefined_function then null; end;
  begin revoke execute on function public.set_valor_pessoa() from public, anon, authenticated; exception when undefined_function then null; end;
end $$;

-- Conferência das políticas de configuracoes
select policyname, cmd from pg_policies where schemaname='public' and tablename='configuracoes' order by policyname;
