-- ============================================================================
-- 28_conhecido_por.sql — encontreiro que CONHECE o encontrista (escolhido no
-- pré-cadastro). Diferente do "Conheço esta pessoa" (sql/23), que é o próprio
-- encontreiro logado se marcando. Aqui, quem cadastra escolhe UM encontreiro
-- da lista que conhece aquele encontrista.
-- Idempotente. Rode no SQL Editor do Supabase.
-- ============================================================================

alter table public.people
  add column if not exists conhecido_por_id uuid
  references public.people(id) on delete set null;

comment on column public.people.conhecido_por_id is
  'Encontreiro (people.id, role_type=worker) que conhece este encontrista — escolhido no pré-cadastro.';

create index if not exists idx_people_conhecido_por on public.people(conhecido_por_id);
