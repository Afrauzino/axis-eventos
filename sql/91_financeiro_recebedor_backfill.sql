-- ============================================================================
-- 91_financeiro_recebedor_backfill.sql  (JÁ RODADO no banco 2026-07-20)
-- Preenche financeiro.created_by (quem recebeu) dos pagamentos ANTIGOS a partir
-- do audit_logs (que registrou quem fez a ação). 11 de 12 recuperados; 1 era
-- registro "Teste" sem usuário.
-- ============================================================================
with a as (
  select entity_id, user_id, row_number() over (partition by entity_id order by created_at) rn
  from public.audit_logs where entity='financeiro' and user_id is not null
)
update public.financeiro f set created_by = a.user_id
from a where a.entity_id = f.id and a.rn = 1 and f.created_by is null;
