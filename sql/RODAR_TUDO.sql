-- ============================================================
-- RODAR_TUDO.sql — cole TODO este arquivo no SQL Editor do Supabase e clique RUN.
-- Junta as migracoes 05 a 13 (todas idempotentes/seguras).
-- ============================================================


-- >>> 05_audit_logs.sql <<<
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

-- >>> 06_teatro_midias.sql <<<
-- ============================================================
-- 06_teatro_midias.sql — Mídia e sons do Teatro (por LINK de nuvem)
-- Cole no SQL Editor do Supabase e clique RUN.
-- As mídias NÃO ficam no Supabase: guardamos só o link (Google Drive, Mega, YouTube, etc.).
-- ============================================================

CREATE TABLE IF NOT EXISTS teatro_midias (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  theater_id  UUID NOT NULL REFERENCES theaters(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL CHECK (tipo IN ('foto','audio','video')),
  titulo      TEXT,
  url         TEXT NOT NULL,
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teatro_midias_theater ON teatro_midias(theater_id);

ALTER TABLE teatro_midias ENABLE ROW LEVEL SECURITY;

-- Qualquer usuário aprovado pode ver as mídias
DROP POLICY IF EXISTS "teatro_midias_select" ON teatro_midias;
CREATE POLICY "teatro_midias_select" ON teatro_midias
  FOR SELECT USING (is_approved());

-- Admin cria/edita/exclui
DROP POLICY IF EXISTS "teatro_midias_insert" ON teatro_midias;
CREATE POLICY "teatro_midias_insert" ON teatro_midias
  FOR INSERT WITH CHECK (is_admin());

DROP POLICY IF EXISTS "teatro_midias_delete" ON teatro_midias;
CREATE POLICY "teatro_midias_delete" ON teatro_midias
  FOR DELETE USING (is_admin());

-- >>> 07_logistica.sql <<<
-- ============================================================
-- 07_logistica.sql — Módulo Logística (checklist de iniciação por encontrista)
-- Cole no SQL Editor do Supabase e clique RUN.
-- ============================================================

-- Itens do checklist da Logística (configurável, como o do Correio)
CREATE TABLE IF NOT EXISTS logistica_checklist_itens (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id   UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  texto      TEXT NOT NULL,
  ordem      INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_logistica_itens_event ON logistica_checklist_itens(event_id);

-- Marcação do checklist por encontrista x item
CREATE TABLE IF NOT EXISTS logistica_checklist_status (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id       UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  encontrista_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  item_id        UUID NOT NULL REFERENCES logistica_checklist_itens(id) ON DELETE CASCADE,
  marcado        BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (encontrista_id, item_id)
);
CREATE INDEX IF NOT EXISTS idx_logistica_status_event ON logistica_checklist_status(event_id);

-- Info de medicamento contínuo por encontrista (dentro da Logística)
CREATE TABLE IF NOT EXISTS logistica_pessoa (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id       UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  encontrista_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  toma_controlado BOOLEAN NOT NULL DEFAULT false,
  ultima_dose    TIMESTAMPTZ,
  observacoes    TEXT,
  concluido      BOOLEAN NOT NULL DEFAULT false,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, encontrista_id)
);

ALTER TABLE logistica_checklist_itens  ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistica_checklist_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistica_pessoa           ENABLE ROW LEVEL SECURITY;

-- Usuários aprovados podem ver e preencher a logística
DO $$
BEGIN
  -- itens
  DROP POLICY IF EXISTS "logistica_itens_all" ON logistica_checklist_itens;
  CREATE POLICY "logistica_itens_all" ON logistica_checklist_itens
    FOR ALL USING (is_approved()) WITH CHECK (is_approved());
  -- status
  DROP POLICY IF EXISTS "logistica_status_all" ON logistica_checklist_status;
  CREATE POLICY "logistica_status_all" ON logistica_checklist_status
    FOR ALL USING (is_approved()) WITH CHECK (is_approved());
  -- pessoa
  DROP POLICY IF EXISTS "logistica_pessoa_all" ON logistica_pessoa;
  CREATE POLICY "logistica_pessoa_all" ON logistica_pessoa
    FOR ALL USING (is_approved()) WITH CHECK (is_approved());
END $$;

-- >>> 08_midias.sql <<<
-- ============================================================
-- 08_midias.sql — Menu Mídia (fotos/áudios/vídeos por link de nuvem, nível evento)
-- Cole no SQL Editor do Supabase e clique RUN.
-- Igual ao Teatro > Mídia, mas geral do evento. Guarda só o link (não ocupa disco).
-- ============================================================

CREATE TABLE IF NOT EXISTS midias (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL CHECK (tipo IN ('foto','audio','video')),
  titulo      TEXT,
  url         TEXT NOT NULL,
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_midias_event ON midias(event_id);

ALTER TABLE midias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "midias_select" ON midias;
CREATE POLICY "midias_select" ON midias FOR SELECT USING (is_approved());

DROP POLICY IF EXISTS "midias_insert" ON midias;
CREATE POLICY "midias_insert" ON midias FOR INSERT WITH CHECK (is_approved());

DROP POLICY IF EXISTS "midias_delete" ON midias;
CREATE POLICY "midias_delete" ON midias FOR DELETE USING (is_admin());

-- >>> 09_theaters_emoji.sql <<<
-- ============================================================
-- 09_theaters_emoji.sql — Emoji do teatro
-- Cole no SQL Editor do Supabase e clique RUN.
-- ============================================================
ALTER TABLE theaters ADD COLUMN IF NOT EXISTS emoji TEXT;

-- >>> 10_refeicao_tipos_emoji.sql <<<
-- ============================================================
-- 10_refeicao_tipos_emoji.sql — Emoji do tipo de refeição (Cozinha)
-- Cole no SQL Editor do Supabase e clique RUN.
-- ============================================================
ALTER TABLE refeicao_tipos ADD COLUMN IF NOT EXISTS emoji TEXT;

-- >>> 11_ficha_medica.sql <<<
-- ============================================================
-- 11_ficha_medica.sql — Ficha Médica simplificada (fonte única)
-- Cole no SQL Editor do Supabase e clique RUN.
-- Campos Sim/Não; os textos reusam colunas existentes (restricoes_alimentares, alergias).
-- ============================================================
ALTER TABLE saude_fichas ADD COLUMN IF NOT EXISTS restricao_alimentar BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE saude_fichas ADD COLUMN IF NOT EXISTS alergia_medicamentos BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE saude_fichas ADD COLUMN IF NOT EXISTS toma_controlado BOOLEAN NOT NULL DEFAULT false;

-- >>> 12_med_ultima_dose.sql <<<
-- ============================================================
-- 12_med_ultima_dose.sql — Última dose tomada (medicamento contínuo)
-- Cole no SQL Editor do Supabase e clique RUN.
-- Reusa as tabelas existentes med_controlados e med_agenda.
-- ============================================================
ALTER TABLE med_controlados ADD COLUMN IF NOT EXISTS ultima_dose TIMESTAMPTZ;

-- >>> 13_med_agenda_entrega.sql <<<
-- ============================================================
-- 13_med_agenda_entrega.sql — Registro de entrega das doses
-- Cole no SQL Editor do Supabase e clique RUN.
-- ============================================================
ALTER TABLE med_agenda ADD COLUMN IF NOT EXISTS entregue_por UUID REFERENCES people(id);
ALTER TABLE med_agenda ADD COLUMN IF NOT EXISTS entregue_em  TIMESTAMPTZ;
