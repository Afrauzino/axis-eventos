-- ============================================================================
-- 47_carrossel_interacoes.sql — Curtidas e comentários do Carrossel de fotos
-- ----------------------------------------------------------------------------
-- Deixa o carrossel de fotos "estilo Instagram": cada foto pode ser curtida e
-- comentada. Rode no Supabase (SQL Editor → Run). Depende do sql/46.
-- ============================================================================

-- Curtidas (uma por pessoa por foto)
create table if not exists public.home_midias_curtidas (
  midia_id   uuid not null references public.home_midias(id) on delete cascade,
  user_id    uuid not null,
  created_at timestamptz not null default now(),
  primary key (midia_id, user_id)
);

-- Comentários
create table if not exists public.home_midias_comentarios (
  id         uuid primary key default gen_random_uuid(),
  midia_id   uuid not null references public.home_midias(id) on delete cascade,
  user_id    uuid,
  autor_nome text,
  autor_foto text,
  texto      text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_home_coment_midia on public.home_midias_comentarios(midia_id, created_at);

-- RLS: todo autenticado vê; curte/comenta em nome próprio; remove o que é seu.
alter table public.home_midias_curtidas   enable row level security;
alter table public.home_midias_comentarios enable row level security;

drop policy if exists "hmc_sel" on public.home_midias_curtidas;
drop policy if exists "hmc_ins" on public.home_midias_curtidas;
drop policy if exists "hmc_del" on public.home_midias_curtidas;
create policy "hmc_sel" on public.home_midias_curtidas for select using (auth.uid() is not null);
create policy "hmc_ins" on public.home_midias_curtidas for insert to authenticated with check (auth.uid() = user_id);
create policy "hmc_del" on public.home_midias_curtidas for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "hmco_sel" on public.home_midias_comentarios;
drop policy if exists "hmco_ins" on public.home_midias_comentarios;
drop policy if exists "hmco_del" on public.home_midias_comentarios;
create policy "hmco_sel" on public.home_midias_comentarios for select using (auth.uid() is not null);
create policy "hmco_ins" on public.home_midias_comentarios for insert to authenticated with check (auth.uid() = user_id);
create policy "hmco_del" on public.home_midias_comentarios for delete to authenticated using (auth.uid() = user_id or is_admin());
