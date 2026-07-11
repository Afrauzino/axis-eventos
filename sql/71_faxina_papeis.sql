-- ============================================================================
-- 71_faxina_papeis.sql — Deixa os DADOS ATUAIS coerentes com as regras
-- ----------------------------------------------------------------------------
-- O app já passou a garantir isso daqui pra frente. Este SQL arruma o que ficou
-- pendurado ANTES (ex.: alguém virou encontrista mas continuou em equipe/líder,
-- ou ficou com cargo 'lider' sem liderar nenhuma equipe).
--
-- SEGURO: não apaga pessoas nem contas; só desfaz vínculos/cargos incoerentes.
-- Rodar no Supabase (SQL Editor). Pode rodar de novo.
-- ============================================================================

-- 1) Encontrista NÃO fica em equipe → remove os vínculos
delete from public.people_teams pt
using public.people p
where pt.person_id = p.id and p.role_type = 'encounterer';

-- 2) Encontrista NÃO é líder → tira da liderança
update public.teams t set leader_id = null
from public.people p
where t.leader_id = p.id and p.role_type = 'encounterer';

update public.teams t set co_leader_id = null
from public.people p
where t.co_leader_id = p.id and p.role_type = 'encounterer';

-- 3) Cargo 'lider' que NÃO lidera nenhuma equipe → volta pra base
--    (encontreiro se é worker; aprovado caso contrário)
update public.profiles pr
set user_role = case
  when exists (select 1 from public.people p where p.user_id = pr.user_id and p.role_type = 'worker') then 'encontreiro'
  else 'aprovado'
end
where pr.user_role = 'lider'
  and not exists (
    select 1 from public.teams t
    join public.people p on (p.id = t.leader_id or p.id = t.co_leader_id)
    where p.user_id = pr.user_id
  );

notify pgrst, 'reload schema';
