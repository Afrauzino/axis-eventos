-- ============================================================
-- MIGRAÇÃO: PADRONIZAÇÃO FINAL DE SEGURANÇA
-- Aplique este script em projetos Supabase já existentes
-- (onde 01_schema.sql e 02_rls_policies.sql já foram executados)
-- ============================================================

-- ── 1. RBAC SEM NULL EVENT ─────────────────────────────────────────────────
-- Remove a coluna nullable e recria como NOT NULL
-- ATENÇÃO: apaga todas as permission rows existentes com event_id NULL

-- Remover constraint antiga
ALTER TABLE permissions
  DROP CONSTRAINT IF EXISTS permissions_user_id_event_id_resource_action_key;

-- Remover linhas com event_id NULL (permissões globais — não existem mais)
DELETE FROM permissions WHERE event_id IS NULL;

-- Tornar event_id NOT NULL
ALTER TABLE permissions
  ALTER COLUMN event_id SET NOT NULL;

-- Recriar constraint sem NULLS NOT DISTINCT
ALTER TABLE permissions
  ADD CONSTRAINT permissions_user_id_event_id_resource_action_key
  UNIQUE (user_id, event_id, resource, action);

-- Atualizar has_permission: remover DEFAULT NULL e global fallback
CREATE OR REPLACE FUNCTION has_permission(
  p_resource TEXT,
  p_action   TEXT,
  p_event_id UUID          -- REQUIRED: always explicit, never NULL
)
RETURNS BOOLEAN AS $$
  SELECT
    CASE
      WHEN is_admin() THEN true
      ELSE COALESCE(
        (SELECT allowed
         FROM permissions
         WHERE user_id  = auth.uid()
           AND event_id = p_event_id
           AND resource = p_resource
           AND action   = p_action
         LIMIT 1),
        false
      )
    END;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── 2. AUDIT LOGS SERVER ONLY ──────────────────────────────────────────────
-- Remove policy de INSERT de clientes — somente service role pode inserir
DROP POLICY IF EXISTS audit_logs_insert_approved ON audit_logs;
-- Nenhuma nova INSERT policy é criada: inserts via service role bypass RLS

-- ── 3. IDENTIDADE ÚNICA VIA people.user_id ────────────────────────────────
-- Re-aplicar políticas de alertas sem name-matching (já foram corrigidas em
-- 02_rls_policies.sql — este bloco só confirma a situação para migrações manuais)

-- Dropar e recriar alerts_select_approved com hard link
DROP POLICY IF EXISTS alerts_select_approved ON alerts;
CREATE POLICY "alerts_select_approved" ON alerts
  FOR SELECT USING (
    is_approved()
    AND (
      target_type = 'all'
      OR is_admin()
      OR has_permission('alerts', 'view', event_id)
      OR EXISTS (
        SELECT 1
        FROM people p
        WHERE p.user_id  = auth.uid()
          AND p.event_id = alerts.event_id
          AND p.team_id  = ANY(alerts.target_team_ids)
      )
    )
  );

-- Dropar e recriar schedule_assignments sem NULL
DROP POLICY IF EXISTS assignments_insert_permitted ON schedule_assignments;
DROP POLICY IF EXISTS assignments_update_permitted ON schedule_assignments;
DROP POLICY IF EXISTS assignments_delete_admin ON schedule_assignments;

CREATE POLICY "assignments_insert_permitted" ON schedule_assignments
  FOR INSERT WITH CHECK (
    is_admin() OR has_permission(
      'schedules', 'edit',
      (SELECT event_id FROM schedules WHERE id = schedule_id)
    )
  );

CREATE POLICY "assignments_update_permitted" ON schedule_assignments
  FOR UPDATE USING (
    is_admin() OR has_permission(
      'schedules', 'edit',
      (SELECT event_id FROM schedules WHERE id = schedule_id)
    )
  );

CREATE POLICY "assignments_delete_admin" ON schedule_assignments
  FOR DELETE USING (
    is_admin() OR has_permission(
      'schedules', 'delete',
      (SELECT event_id FROM schedules WHERE id = schedule_id)
    )
  );

-- Dropar e recriar theater_cast sem NULL
DROP POLICY IF EXISTS theater_cast_insert_permitted ON theater_cast;
DROP POLICY IF EXISTS theater_cast_update_permitted ON theater_cast;
DROP POLICY IF EXISTS theater_cast_delete_admin ON theater_cast;

CREATE POLICY "theater_cast_insert_permitted" ON theater_cast
  FOR INSERT WITH CHECK (
    is_admin() OR has_permission(
      'theaters', 'edit',
      (SELECT event_id FROM theaters WHERE id = theater_id)
    )
  );

CREATE POLICY "theater_cast_update_permitted" ON theater_cast
  FOR UPDATE USING (
    is_admin() OR has_permission(
      'theaters', 'edit',
      (SELECT event_id FROM theaters WHERE id = theater_id)
    )
  );

CREATE POLICY "theater_cast_delete_admin" ON theater_cast
  FOR DELETE USING (
    is_admin() OR has_permission(
      'theaters', 'delete',
      (SELECT event_id FROM theaters WHERE id = theater_id)
    )
  );

-- ── 4. ÍNDICE DE PERFORMANCE ───────────────────────────────────────────────
-- Índice composto para a subquery de membership em alertas RLS
-- e filtros combinados (event_id, user_id, team_id)
CREATE INDEX IF NOT EXISTS idx_people_event_user_team
  ON people(event_id, user_id, team_id);

-- ── VERIFICAÇÃO ────────────────────────────────────────────────────────────
-- Execute após a migração para confirmar:
--
-- SELECT COUNT(*) FROM permissions WHERE event_id IS NULL;   -- deve ser 0
-- SELECT COUNT(*) FROM audit_logs;                           -- não deve mudar
-- \d permissions                                             -- event_id NOT NULL
