-- ============================================================================
-- 81_redes_email_recuperacao.sql
-- Três coisas que o Anderson pediu, num arquivo só. Rode: SQL Editor -> Run.
--   1) Instagram e Facebook na ficha de cadastro
--   2) Admin poder VER o email cadastrado de cada usuário
--   3) Pedido de recuperação de senha aparecer pro admin (sino + push)
-- Idempotente: pode rodar de novo sem quebrar nada.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) REDES SOCIAIS na ficha
-- Guardamos o @ / nome do perfil (não a URL inteira). Campo comum, sem segredo:
-- quem já enxerga a pessoa enxerga a rede social — não mexe em RLS.
-- ---------------------------------------------------------------------------
alter table public.people add column if not exists instagram text;
alter table public.people add column if not exists facebook  text;


-- ---------------------------------------------------------------------------
-- 2) EMAIL DE CADA USUÁRIO (só admin)
-- O email mora em auth.users, que o app NÃO acessa direto (e nem deve). Esta
-- função é SECURITY DEFINER e só devolve linha se quem chamou for admin —
-- se um encontreiro chamar, volta VAZIO (não dá erro, só não vê nada).
-- ---------------------------------------------------------------------------
create or replace function public.admin_emails()
returns table(user_id uuid, email text)
language sql
security definer
set search_path = public
stable
as $$
  select u.id, u.email::text
  from auth.users u
  where public.is_admin();
$$;

revoke all on function public.admin_emails() from public, anon;
grant execute on function public.admin_emails() to authenticated;


-- ---------------------------------------------------------------------------
-- 3) PEDIDOS DE RECUPERAÇÃO DE SENHA
-- A pessoa clica "Esqueci minha senha" -> cai uma linha aqui -> o admin vê no
-- sino e recebe push. Depois ele gera a senha nova e marca como atendido.
-- ---------------------------------------------------------------------------
create table if not exists public.senha_solicitacoes (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  nome        text,
  telefone    text,
  status      text not null default 'pendente',   -- pendente | atendido
  atendido_por uuid,
  atendido_em timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists idx_senha_solic_status on public.senha_solicitacoes(status, created_at desc);

alter table public.senha_solicitacoes enable row level security;

drop policy if exists "senha_solic_insert" on public.senha_solicitacoes;
drop policy if exists "senha_solic_select" on public.senha_solicitacoes;
drop policy if exists "senha_solic_update" on public.senha_solicitacoes;

-- Quem esqueceu a senha está DESLOGADO — então o insert tem que ser liberado pra
-- anon. Não vaza nada: a pessoa só escreve, nunca lê. E o email já é o dela.
create policy "senha_solic_insert" on public.senha_solicitacoes
  for insert to anon, authenticated with check (true);

-- Ler o pedido (tem email de gente): SÓ admin.
create policy "senha_solic_select" on public.senha_solicitacoes
  for select to authenticated using (public.is_admin());

-- Marcar como atendido: só admin.
create policy "senha_solic_update" on public.senha_solicitacoes
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

notify pgrst, 'reload schema';

-- ============================================================================
-- RELATÓRIO — confira as 4 linhas depois do Run
-- ============================================================================
select '1) coluna people.instagram'::text as check,
       case when exists (select 1 from information_schema.columns
                         where table_schema='public' and table_name='people' and column_name='instagram')
            then 'OK' else 'FALTANDO' end as resultado;

select '2) coluna people.facebook'::text as check,
       case when exists (select 1 from information_schema.columns
                         where table_schema='public' and table_name='people' and column_name='facebook')
            then 'OK' else 'FALTANDO' end as resultado;

select '3) função admin_emails'::text as check,
       case when exists (select 1 from pg_proc where proname='admin_emails')
            then 'OK — veja seu email abaixo' else 'FALTANDO' end as resultado;

select '4) tabela senha_solicitacoes'::text as check,
       case when exists (select 1 from information_schema.tables
                         where table_schema='public' and table_name='senha_solicitacoes')
            then 'OK' else 'FALTANDO' end as resultado;
