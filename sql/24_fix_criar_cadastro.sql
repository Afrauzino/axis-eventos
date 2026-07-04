-- ============================================================================
-- 24_fix_criar_cadastro.sql — corrige "consegue editar mas não consegue CRIAR"
-- Problema: o RLS de INSERT em `people` exigia permissão 'create', mas o app só
-- concede 'editar' quando você marca "Criar/editar". Resultado: editar funciona,
-- criar dá erro de permissão.
-- Solução: adiciona uma política de INSERT PERMISSIVA (soma com as existentes,
-- não remove nada) que libera criar pra: admin/pastor/secretaria OU quem tem a
-- permissão individual/equipe "ver e editar" em Cadastros/Encontristas.
-- Rode no SQL Editor do Supabase. Idempotente (pode rodar de novo).
-- ============================================================================

create or replace function public.pode_editar_pessoas(p_event_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select
    -- cargos que sempre podem
    exists (select 1 from public.profiles pf
            where pf.user_id = auth.uid() and pf.user_role in ('admin','pastor','secretaria'))
    -- permissão INDIVIDUAL "editar" em cadastros/encontristas
    or exists (
      select 1 from public.permissoes pr
      join public.people pe on pe.id = pr.person_id
      where pe.user_id = auth.uid()
        and pr.permitido and pr.acao = 'editar'
        and pr.modulo in ('cadastros','encontristas')
    )
    -- permissão via EQUIPE (membro, líder ou co-líder)
    or exists (
      select 1 from public.permissoes pr
      where pr.team_id is not null
        and pr.permitido and pr.acao = 'editar'
        and pr.modulo in ('cadastros','encontristas')
        and (
          pr.team_id in (
            select pt.team_id from public.people_teams pt
            join public.people pe on pe.id = pt.person_id
            where pe.user_id = auth.uid()
          )
          or pr.team_id in (
            select t.id from public.teams t
            join public.people pe on (pe.id = t.leader_id or pe.id = t.co_leader_id)
            where pe.user_id = auth.uid()
          )
        )
    );
$$;

-- Política de INSERT adicional (permissiva: RLS soma as políticas com OR)
drop policy if exists "people_insert_editores" on public.people;
create policy "people_insert_editores" on public.people
  for insert to authenticated
  with check ( public.pode_editar_pessoas(event_id) );

-- (opcional) garante que editar continue funcionando pelo mesmo critério
drop policy if exists "people_update_editores" on public.people;
create policy "people_update_editores" on public.people
  for update to authenticated
  using ( public.pode_editar_pessoas(event_id) );
