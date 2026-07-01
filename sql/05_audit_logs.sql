-- ============================================================
-- 05_audit_logs.sql — Registro de Ações (Logs / Auditoria)
-- Cole no SQL Editor do Supabase e clique RUN.
-- Auditoria imutável: registros nunca são editados nem apagados.
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id    UUID REFERENCES events(id) ON DELETE SET NULL,
  user_id     UUID REFERENCES auth.users(id),
  actor_name  TEXT,                    -- nome de quem fez (snapshot no momento)
  action      TEXT NOT NULL,           -- create | update | delete | approve | reject | payment | medication | login | export | other
  entity      TEXT NOT NULL,           -- módulo/tabela afetada (people, financeiro, ministrações, ...)
  entity_id   UUID,                    -- id do registro afetado (quando houver)
  description TEXT,                    -- texto legível: "Aprovou o usuário João Silva"
  metadata    JSONB,                   -- detalhes extras (valores antigos/novos, etc.)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_event   ON audit_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity  ON audit_logs(entity, entity_id);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Qualquer usuário autenticado pode gravar suas próprias ações
DROP POLICY IF EXISTS "audit_insert_authenticated" ON audit_logs;
CREATE POLICY "audit_insert_authenticated" ON audit_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Somente admin lê os logs
DROP POLICY IF EXISTS "audit_select_admin" ON audit_logs;
CREATE POLICY "audit_select_admin" ON audit_logs
  FOR SELECT USING (is_admin());

-- Sem policies de UPDATE/DELETE de propósito: auditoria é imutável.
