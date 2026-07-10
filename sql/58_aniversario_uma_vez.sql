-- ============================================================================
-- 58_aniversario_uma_vez.sql — Parabéns de aniversário aparece UMA VEZ SÓ
-- ----------------------------------------------------------------------------
-- Hoje a trava é só no aparelho (localStorage): mostra 1x/dia NAQUELE celular.
-- Se a pessoa abrir em outro aparelho, ou reinstalar, a tela aparece de novo —
-- e os líderes recebem o aviso "Aniversário hoje!" mais de uma vez.
--
-- Esta tabela guarda, no servidor, que a pessoa X já foi parabenizada no ano Y.
-- Assim a tela cheia e o aviso aos líderes acontecem UMA vez por aniversário,
-- não importa em quantos aparelhos ela abra o app.
--
-- Cada pessoa só enxerga/grava a PRÓPRIA marca (RLS). É seguro rodar de novo.
-- ============================================================================

create table if not exists public.aniversario_comemorado (
  user_id   uuid not null references auth.users(id) on delete cascade,
  ano       int  not null,
  criado_em timestamptz not null default now(),
  primary key (user_id, ano)
);

alter table public.aniversario_comemorado enable row level security;

-- Cada um só vê e grava as próprias linhas.
drop policy if exists niver_sel on public.aniversario_comemorado;
create policy niver_sel on public.aniversario_comemorado
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists niver_ins on public.aniversario_comemorado;
create policy niver_ins on public.aniversario_comemorado
  for insert to authenticated with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
