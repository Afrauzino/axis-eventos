-- ============================================================
-- ENCONTRO COM DEUS — SCHEMA COMPLETO SUPABASE
-- ============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  church TEXT,
  role_status TEXT NOT NULL DEFAULT 'pending' CHECK (role_status IN ('pending', 'approved', 'rejected')),
  is_admin BOOLEAN NOT NULL DEFAULT false,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ============================================================
-- EVENTS
-- ============================================================
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'finished')),
  start_date DATE,
  end_date DATE,
  location TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PEOPLE
-- ============================================================
CREATE TABLE people (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  photo_url TEXT,
  phone TEXT NOT NULL,
  church TEXT NOT NULL,
  role_type TEXT NOT NULL CHECK (role_type IN ('encounterer', 'worker')),
  team_id UUID, -- FK added after teams table
  notes TEXT,
  birth_date DATE,
  email TEXT,
  -- Hard identity link: when a system user (auth.users) is also a participant
  -- in this event (e.g. a worker who has an account), their auth UUID goes here.
  -- Nullable: encounterers and workers without accounts have user_id = NULL.
  -- No global UNIQUE: same auth user can appear in people across multiple events.
  -- Per-event UNIQUE enforced via constraint below.
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Prevent same auth user from being registered twice in the same event
  UNIQUE NULLS NOT DISTINCT (event_id, user_id)
);

-- ============================================================
-- TEAMS
-- ============================================================
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  leader_id UUID REFERENCES people(id),
  co_leader_id UUID REFERENCES people(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add FK from people to teams
ALTER TABLE people ADD CONSTRAINT fk_people_team
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL;

-- ============================================================
-- SCHEDULES (Cronograma)
-- ============================================================
CREATE TABLE schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('ministry', 'theater', 'break', 'meal', 'activity', 'prayer', 'worship')),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  description TEXT,
  location TEXT,
  minister_id UUID REFERENCES people(id),
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'done', 'canceled')),
  color TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- ============================================================
-- SCHEDULE ASSIGNMENTS (Escala)
-- ============================================================
CREATE TABLE schedule_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id),
  role TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(schedule_id, person_id)
);

-- Function to check schedule conflicts
CREATE OR REPLACE FUNCTION check_schedule_conflict(
  p_person_id UUID,
  p_schedule_id UUID,
  p_event_id UUID
) RETURNS TABLE(conflict_title TEXT, conflict_start TIMESTAMPTZ, conflict_end TIMESTAMPTZ) AS $$
DECLARE
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
BEGIN
  SELECT start_time, end_time INTO v_start, v_end
  FROM schedules WHERE id = p_schedule_id;

  RETURN QUERY
  SELECT s.title, s.start_time, s.end_time
  FROM schedule_assignments sa
  JOIN schedules s ON s.id = sa.schedule_id
  WHERE sa.person_id = p_person_id
    AND s.id != p_schedule_id
    AND s.event_id = p_event_id
    AND s.status != 'canceled'
    AND (
      (s.start_time < v_end AND s.end_time > v_start)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to prevent schedule conflicts
CREATE OR REPLACE FUNCTION prevent_schedule_conflict() RETURNS TRIGGER AS $$
DECLARE
  conflict_count INT;
  conflict_info TEXT;
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
  v_event_id UUID;
BEGIN
  SELECT start_time, end_time, event_id INTO v_start, v_end, v_event_id
  FROM schedules WHERE id = NEW.schedule_id;

  SELECT COUNT(*), STRING_AGG(s.title, ', ') INTO conflict_count, conflict_info
  FROM schedule_assignments sa
  JOIN schedules s ON s.id = sa.schedule_id
  WHERE sa.person_id = NEW.person_id
    AND s.id != NEW.schedule_id
    AND s.event_id = v_event_id
    AND s.status != 'canceled'
    AND (s.start_time < v_end AND s.end_time > v_start);

  IF conflict_count > 0 THEN
    RAISE EXCEPTION 'Conflito de horário detectado! Esta pessoa já está escalada em: %', conflict_info;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_schedule_conflict
  BEFORE INSERT OR UPDATE ON schedule_assignments
  FOR EACH ROW EXECUTE FUNCTION prevent_schedule_conflict();

-- ============================================================
-- THEATERS (Teatro)
-- ============================================================
CREATE TABLE theaters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  scheduled_time TIMESTAMPTZ,
  location TEXT,
  status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'rehearsal', 'ready', 'done')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- THEATER CAST
-- ============================================================
CREATE TABLE theater_cast (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  theater_id UUID NOT NULL REFERENCES theaters(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  character_name TEXT NOT NULL,
  props JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(theater_id, person_id)
);

-- ============================================================
-- THEATER CAST — CROSS-EVENT ISOLATION TRIGGER
-- Prevents a person from Event A being added to a theater from Event B.
-- The FK (theater_id → theaters, person_id → people) does not enforce same event,
-- so we validate here explicitly.
-- ============================================================
CREATE OR REPLACE FUNCTION validate_theater_cast_event()
RETURNS TRIGGER AS $$
DECLARE
  v_theater_event_id UUID;
  v_person_event_id  UUID;
BEGIN
  SELECT event_id INTO v_theater_event_id
  FROM theaters WHERE id = NEW.theater_id;

  SELECT event_id INTO v_person_event_id
  FROM people WHERE id = NEW.person_id;

  IF v_theater_event_id IS DISTINCT FROM v_person_event_id THEN
    RAISE EXCEPTION
      'Isolamento de evento violado: a pessoa (event_id=%) não pertence ao mesmo evento do teatro (event_id=%)',
      v_person_event_id, v_theater_event_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_theater_cast_event
  BEFORE INSERT OR UPDATE ON theater_cast
  FOR EACH ROW EXECUTE FUNCTION validate_theater_cast_event();

-- ============================================================
-- MEDICATIONS (Saúde)
-- ============================================================
CREATE TABLE medications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  medicine_name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  reason TEXT,
  scheduled_times TEXT[], -- array of times like ['08:00', '20:00']
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  administered_by UUID NOT NULL REFERENCES auth.users(id),
  administered_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- NEVER DELETE - audit trail
);

-- ============================================================
-- ALERTS
-- ============================================================
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'info' CHECK (priority IN ('info', 'important', 'urgent')),
  target_type TEXT NOT NULL DEFAULT 'all' CHECK (target_type IN ('all', 'team', 'multiple')),
  target_team_ids UUID[] DEFAULT '{}',
  requires_read BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Alert read tracking
CREATE TABLE alert_reads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_id UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(alert_id, user_id)
);

-- ============================================================
-- OCCURRENCES
-- ============================================================
CREATE TABLE occurrences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PERMISSIONS (Granular RBAC)
-- ============================================================
-- ARCHITECTURE RULE: permissions are ALWAYS scoped to a specific event.
-- event_id is NOT NULL — there are no global/cross-event permissions.
-- A user who works across multiple events gets one permission row per event.
-- This ensures RBAC is fully isolated and auditable per event.
CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE, -- always explicit, never NULL
  resource TEXT NOT NULL, -- 'schedules', 'people', 'medications', etc.
  action TEXT NOT NULL,   -- 'create', 'edit', 'delete', 'view'
  allowed BOOLEAN NOT NULL DEFAULT false,
  granted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One row per (user, event, resource, action) — fully deterministic, no ambiguity
  UNIQUE(user_id, event_id, resource, action)
);

-- ============================================================
-- AUDIT LOG
-- ============================================================
-- event_id added so admins can filter the audit trail by event.
-- Nullable: some actions (user approval, global permission changes)
-- are not tied to a specific event.
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  event_id UUID REFERENCES events(id) ON DELETE SET NULL, -- NULL = global action
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  resource_id UUID,
  old_value JSONB,
  new_value JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- FUNCTIONS: updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all tables
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_events_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_people_updated_at BEFORE UPDATE ON people FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_teams_updated_at BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_schedules_updated_at BEFORE UPDATE ON schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_theaters_updated_at BEFORE UPDATE ON theaters FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_theater_cast_updated_at BEFORE UPDATE ON theater_cast FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_occurrences_updated_at BEFORE UPDATE ON occurrences FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_permissions_updated_at BEFORE UPDATE ON permissions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- FUNCTION: auto-create profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (user_id, name, phone, church, role_status, is_admin)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'church',
    'pending',
    false
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_handle_new_user
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM profiles WHERE user_id = auth.uid()),
    false
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if current user is approved
CREATE OR REPLACE FUNCTION is_approved()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT role_status = 'approved' FROM profiles WHERE user_id = auth.uid()),
    false
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if user has specific permission for a specific event.
-- ARCHITECTURE RULE: p_event_id must ALWAYS be provided explicitly — never NULL.
-- There are no global/NULL-event permissions in this system.
-- Every permission row has a non-null event_id.
-- Logic:
--   1. Admins bypass all checks → true.
--   2. Look for an exact (user_id, event_id, resource, action) row → use its `allowed` value.
--   3. No row found → false.
CREATE OR REPLACE FUNCTION has_permission(
  p_resource TEXT,
  p_action   TEXT,
  p_event_id UUID          -- REQUIRED: always pass the event UUID, never NULL
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

-- Get event progress percentage
CREATE OR REPLACE FUNCTION get_event_progress(p_event_id UUID)
RETURNS NUMERIC AS $$
  SELECT CASE
    WHEN COUNT(*) = 0 THEN 0
    ELSE ROUND(
      (COUNT(*) FILTER (WHERE status = 'done')::NUMERIC / COUNT(*)::NUMERIC) * 100, 1
    )
  END
  FROM schedules
  WHERE event_id = p_event_id AND status != 'canceled';
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Indexes for performance
CREATE INDEX idx_people_event_id ON people(event_id);
CREATE INDEX idx_teams_event_id ON teams(event_id);
CREATE INDEX idx_schedules_event_id ON schedules(event_id);
CREATE INDEX idx_schedules_start_time ON schedules(start_time);
CREATE INDEX idx_schedule_assignments_schedule_id ON schedule_assignments(schedule_id);
CREATE INDEX idx_schedule_assignments_person_id ON schedule_assignments(person_id);
CREATE INDEX idx_medications_event_id ON medications(event_id);
CREATE INDEX idx_medications_person_id ON medications(person_id);
CREATE INDEX idx_alerts_event_id ON alerts(event_id);
CREATE INDEX idx_alert_reads_user_id ON alert_reads(user_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource, resource_id);
CREATE INDEX idx_permissions_user_id ON permissions(user_id);

-- ============================================================
-- ADDITIONAL INDEXES (identified in audit — previously missing)
-- ============================================================

-- theaters.event_id: no index, listed queries always filter by event
CREATE INDEX idx_theaters_event_id ON theaters(event_id);

-- occurrences.event_id: no index, all queries filter by event
CREATE INDEX idx_occurrences_event_id ON occurrences(event_id);

-- theater_cast join columns: heavy join in theater listing
CREATE INDEX idx_theater_cast_theater_id ON theater_cast(theater_id);
CREATE INDEX idx_theater_cast_person_id  ON theater_cast(person_id);

-- alert_reads.alert_id: needed for the nested select in AlertService.list
CREATE INDEX idx_alert_reads_alert_id ON alert_reads(alert_id);

-- schedules(event_id, status): composite used by get_event_progress and status filters
CREATE INDEX idx_schedules_event_status ON schedules(event_id, status);

-- people.team_id: FK used in member-listing joins (no UNIQUE so no implicit index)
CREATE INDEX idx_people_team_id ON people(team_id);

-- people.user_id: new hard identity link — used in RLS and identity lookups
CREATE INDEX idx_people_user_id ON people(user_id);

-- PERFORMANCE: composite index for the alerts RLS team-membership subquery:
--   WHERE p.user_id = auth.uid() AND p.event_id = alerts.event_id AND p.team_id = ANY(...)
-- Also serves permission checks that filter (event_id, user_id, team_id) together.
CREATE INDEX idx_people_event_user_team ON people(event_id, user_id, team_id);

-- audit_logs.created_at: needed for DESC ordering on the audit page
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- audit_logs.event_id: new field — needed for per-event audit filtering
CREATE INDEX idx_audit_logs_event_id ON audit_logs(event_id);

-- alerts.created_at: needed for DESC ordering in AlertService.list
CREATE INDEX idx_alerts_created_at ON alerts(created_at DESC);

-- permissions.event_id: new field — needed for event-scoped permission lookups
CREATE INDEX idx_permissions_event_id ON permissions(event_id);
