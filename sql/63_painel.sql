-- ============================================================================
-- 63_painel.sql — Painel de análises (Administração)
-- ----------------------------------------------------------------------------
-- 1) last_seen: marca o último acesso de cada pessoa (pra "online agora" e
--    "acessaram hoje"). O app atualiza ao abrir. Cada um só atualiza o SEU.
-- 2) Acesso ao Painel: usa a tabela `permissoes` que já existe, com
--    modulo='painel', acao='ver'. Escolhido DENTRO do Painel (admin sempre entra).
--
-- Rode no Supabase (SQL Editor). Pode rodar de novo.
-- ============================================================================

alter table public.profiles add column if not exists last_seen timestamptz;
create index if not exists idx_profiles_last_seen on public.profiles(last_seen);

-- Cada um pode gravar o próprio last_seen (self-update do profiles).
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_self_lastseen') then
    create policy profiles_self_lastseen on public.profiles
      for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

notify pgrst, 'reload schema';
