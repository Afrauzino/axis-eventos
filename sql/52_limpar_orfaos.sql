-- ============================================================================
-- 52_limpar_orfaos.sql — Remove restos de EVENTOS APAGADOS e valida as amarras
-- ----------------------------------------------------------------------------
-- Consentido: apagar equipes/ministrações "fantasmas" — as que apontam para um
-- evento que NÃO existe mais. Elas são invisíveis no app (a tela filtra pelo
-- evento ativo) e nada aponta para elas.
-- Também zera ponteiros quebrados (líder/co-líder/ministrante que não existe
-- mais) em linhas REAIS — nada some, aquelas equipes já apareciam sem líder.
-- Rode DEPOIS do sql/51. Pode rodar mais de uma vez.
-- ============================================================================

-- 1) Equipes fantasmas (evento não existe mais)
delete from public.teams t
where not exists (select 1 from public.events e where e.id = t.event_id);

-- 2) Ministrações fantasmas
delete from public."ministrações" m
where not exists (select 1 from public.events e where e.id = m.event_id);

-- 3) Ponteiros quebrados em linhas reais -> zera (não apaga a linha)
do $$
begin
  begin update public.teams set leader_id = null
    where leader_id is not null and not exists (select 1 from public.people p where p.id = teams.leader_id);
  exception when others then raise notice 'teams.leader_id: %', sqlerrm; end;

  begin update public.teams set co_leader_id = null
    where co_leader_id is not null and not exists (select 1 from public.people p where p.id = teams.co_leader_id);
  exception when others then raise notice 'teams.co_leader_id: %', sqlerrm; end;

  begin update public."ministrações" set ministrante_id = null
    where ministrante_id is not null and not exists (select 1 from public.people p where p.id = "ministrações".ministrante_id);
  exception when others then raise notice 'ministrações.ministrante_id: %', sqlerrm; end;
end $$;

-- 4) Agora tenta VALIDAR as amarras que estavam pendentes
do $$
declare r record;
begin
  for r in select conrelid::regclass::text as tbl, conname
           from pg_constraint where contype='f' and not convalidated
  loop
    begin
      execute format('alter table %s validate constraint %I', r.tbl, r.conname);
      raise notice 'validada: % . %', r.tbl, r.conname;
    exception when others then
      raise notice 'ainda com orfao: % . % (%)', r.tbl, r.conname, sqlerrm;
    end;
  end loop;
end $$;

-- 5) Relatório final — lista vazia = tudo limpo e validado
select conrelid::regclass::text as tabela, conname as amarra, 'ainda nao validada' as situacao
from pg_constraint where contype='f' and not convalidated order by 1,2;
