-- ============================================================================
-- 78_adocao_encontrista.sql — "Adotar essa pessoa"
-- Um encontreiro (worker) assume o compromisso de orar + escrever uma carta
-- à mão para um encontrista. Cada encontrista só pode ter 1 responsável.
--
-- PRIVACIDADE:
--   - TODO mundo logado precisa saber quais encontristas JÁ estão adotados
--     (pra bloquear o botão), mas NÃO quem adotou.
--   - Só veem QUEM é o responsável (nome/foto): o próprio que adotou, o admin,
--     e quem tiver a permissão individual correio/adocoes ("líder do correio").
--
-- Estratégia:
--   - SELECT na tabela = restrito (dono / admin / permissão) -> protege os nomes.
--   - Função adocao_status(evento) = SECURITY DEFINER, devolve só
--     (encontrista_id, mine) pra todo mundo bloquear o botão sem ver nomes.
-- Rode no SQL Editor do Supabase.
-- ============================================================================

create table if not exists public.encontrista_adocao (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid,
  encontrista_id uuid not null references public.people(id) on delete cascade,
  worker_user_id uuid,                        -- conta do encontreiro que adotou
  worker_name    text,
  worker_photo   text,
  worker_phone   text,
  created_at     timestamptz not null default now(),
  unique (encontrista_id)                     -- 1 responsável por encontrista
);

create index if not exists idx_adocao_encontrista on public.encontrista_adocao(encontrista_id);
create index if not exists idx_adocao_worker      on public.encontrista_adocao(worker_user_id);

alter table public.encontrista_adocao enable row level security;

drop policy if exists "adocao_select" on public.encontrista_adocao;
drop policy if exists "adocao_insert" on public.encontrista_adocao;
drop policy if exists "adocao_delete" on public.encontrista_adocao;

-- Ver os NOMES: só o dono, o admin, ou quem tem a permissão correio/adocoes.
create policy "adocao_select" on public.encontrista_adocao
  for select to authenticated using (
    worker_user_id = auth.uid()
    or is_admin()
    or exists (
      select 1 from public.permissoes pm
      join public.people pe on pe.id = pm.person_id
      where pe.user_id = auth.uid()
        and pm.modulo = 'correio' and pm.acao = 'adocoes' and pm.permitido = true
    )
  );

-- Adotar: só na própria conta. O unique(encontrista_id) impede adotar quem já tem dono.
create policy "adocao_insert" on public.encontrista_adocao
  for insert to authenticated with check (worker_user_id = auth.uid());

-- Tirar adoção: quem adotou, OU admin, OU líder do correio (permissão correio/adocoes).
create policy "adocao_delete" on public.encontrista_adocao
  for delete to authenticated using (
    worker_user_id = auth.uid()
    or is_admin()
    or exists (
      select 1 from public.permissoes pm
      join public.people pe on pe.id = pm.person_id
      where pe.user_id = auth.uid()
        and pm.modulo = 'correio' and pm.acao = 'adocoes' and pm.permitido = true
    )
  );

-- Quais encontristas do evento já estão adotados (sem revelar quem adotou).
-- Devolve também 'mine' = true se a conta atual for a responsável.
create or replace function public.adocao_status(p_event uuid)
returns table(encontrista_id uuid, mine boolean)
language sql security definer stable as $$
  select encontrista_id, (worker_user_id = auth.uid()) as mine
  from public.encontrista_adocao
  where event_id = p_event;
$$;

grant execute on function public.adocao_status(uuid) to authenticated;
