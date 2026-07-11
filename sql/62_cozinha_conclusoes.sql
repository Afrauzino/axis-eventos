-- ============================================================================
-- 62_cozinha_conclusoes.sql — "Concluído" por pessoa em cada cardápio
-- ----------------------------------------------------------------------------
-- Cada membro (liderado) da equipe da cozinha marca CADA cardápio como feito.
-- O líder vê quem concluiu, a % de cada um, e pode marcar POR eles.
--
-- 1 linha = 1 pessoa concluiu 1 cardápio. Progresso da pessoa = feitos / total.
-- Progresso do líder = feitos de todos / (liderados × cardápios).
--
-- Rode no Supabase (SQL Editor). Pode rodar de novo sem problema.
-- ============================================================================

create table if not exists public.cozinha_conclusoes (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid references public.events(id) on delete cascade,
  cardapio_id  uuid not null references public.cozinha_cardapios(id) on delete cascade,
  person_id    uuid not null references public.people(id) on delete cascade,
  feito        boolean not null default true,
  updated_at   timestamptz not null default now(),
  unique (cardapio_id, person_id)
);

create index if not exists idx_cozinha_conclusoes_pessoa on public.cozinha_conclusoes(person_id);
create index if not exists idx_cozinha_conclusoes_card   on public.cozinha_conclusoes(cardapio_id);

alter table public.cozinha_conclusoes enable row level security;

-- Permissivo: todo mundo aprovado vê; quem está logado grava. O APP controla
-- quem pode marcar (o próprio membro marca o seu; líder/admin marca pelos liderados).
drop policy if exists cozc_sel on public.cozinha_conclusoes;
create policy cozc_sel on public.cozinha_conclusoes for select using (true);
drop policy if exists cozc_ins on public.cozinha_conclusoes;
create policy cozc_ins on public.cozinha_conclusoes for insert to authenticated with check (auth.uid() is not null);
drop policy if exists cozc_upd on public.cozinha_conclusoes;
create policy cozc_upd on public.cozinha_conclusoes for update to authenticated using (auth.uid() is not null);
drop policy if exists cozc_del on public.cozinha_conclusoes;
create policy cozc_del on public.cozinha_conclusoes for delete to authenticated using (auth.uid() is not null);

-- Realtime (opcional): o líder vê a marcação do membro na hora.
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='cozinha_conclusoes') then
    alter publication supabase_realtime add table public.cozinha_conclusoes;
  end if;
end $$;

notify pgrst, 'reload schema';
