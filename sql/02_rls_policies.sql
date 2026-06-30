-- ============================================================
-- ENCONTRO COM DEUS — RLS POLICIES COMPLETAS
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE theaters ENABLE ROW LEVEL SECURITY;
ALTER TABLE theater_cast ENABLE ROW LEVEL SECURITY;
ALTER TABLE medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PROFILES
-- ============================================================
-- Users can read their own profile
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (user_id = auth.uid());

-- Admins can read all profiles
CREATE POLICY "profiles_select_admin" ON profiles
  FOR SELECT USING (is_admin());

-- Users can update their own profile
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (user_id = auth.uid());

-- Admins can update any profile
CREATE POLICY "profiles_update_admin" ON profiles
  FOR UPDATE USING (is_admin());

-- Profiles created via trigger (no direct insert policy needed for users)
-- Admins can insert profiles manually
CREATE POLICY "profiles_insert_admin" ON profiles
  FOR INSERT WITH CHECK (is_admin());

-- ============================================================
-- EVENTS
-- ============================================================
-- Approved users can view events
CREATE POLICY "events_select_approved" ON events
  FOR SELECT USING (is_approved());

-- Only admins can create/edit/delete events
CREATE POLICY "events_insert_admin" ON events
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "events_update_admin" ON events
  FOR UPDATE USING (is_admin());

CREATE POLICY "events_delete_admin" ON events
  FOR DELETE USING (is_admin());

-- ============================================================
-- PEOPLE
-- ============================================================
-- Approved users can view people (for schedules, photos)
CREATE POLICY "people_select_approved" ON people
  FOR SELECT USING (is_approved());

-- Users with permission can create people (scoped to the event being inserted into)
CREATE POLICY "people_insert_permitted" ON people
  FOR INSERT WITH CHECK (
    is_admin() OR has_permission('people', 'create', event_id)
  );

-- Users with permission can edit people
CREATE POLICY "people_update_permitted" ON people
  FOR UPDATE USING (
    is_admin() OR has_permission('people', 'edit', event_id)
  );

-- Only admins can delete people
CREATE POLICY "people_delete_admin" ON people
  FOR DELETE USING (is_admin());

-- ============================================================
-- TEAMS
-- ============================================================
-- Approved users can view teams
CREATE POLICY "teams_select_approved" ON teams
  FOR SELECT USING (is_approved());

-- Admins and permitted users can manage teams
CREATE POLICY "teams_insert_permitted" ON teams
  FOR INSERT WITH CHECK (
    is_admin() OR has_permission('teams', 'create', event_id)
  );

CREATE POLICY "teams_update_permitted" ON teams
  FOR UPDATE USING (
    is_admin() OR has_permission('teams', 'edit', event_id)
  );

CREATE POLICY "teams_delete_admin" ON teams
  FOR DELETE USING (is_admin());

-- ============================================================
-- SCHEDULES
-- ============================================================
-- All approved users can view schedules
CREATE POLICY "schedules_select_approved" ON schedules
  FOR SELECT USING (is_approved());

-- Permitted users can create schedules
CREATE POLICY "schedules_insert_permitted" ON schedules
  FOR INSERT WITH CHECK (
    is_admin() OR has_permission('schedules', 'create', event_id)
  );

-- Permitted users can update schedules
CREATE POLICY "schedules_update_permitted" ON schedules
  FOR UPDATE USING (
    is_admin() OR has_permission('schedules', 'edit', event_id)
  );

-- Only admins can delete schedules
CREATE POLICY "schedules_delete_admin" ON schedules
  FOR DELETE USING (
    is_admin() OR has_permission('schedules', 'delete', event_id)
  );

-- ============================================================
-- SCHEDULE ASSIGNMENTS
-- ============================================================
-- schedule_assignments has no event_id column — it inherits via schedule_id.
-- ARCHITECTURE RULE: never pass NULL to has_permission.
-- Instead, resolve event_id via a correlated subquery on schedules.
-- The conflict trigger enforces event isolation independently.
CREATE POLICY "assignments_select_approved" ON schedule_assignments
  FOR SELECT USING (is_approved());

-- Permitted users can create assignments (resolve event_id via schedule)
CREATE POLICY "assignments_insert_permitted" ON schedule_assignments
  FOR INSERT WITH CHECK (
    is_admin() OR has_permission(
      'schedules', 'edit',
      (SELECT event_id FROM schedules WHERE id = schedule_id)
    )
  );

-- Permitted users can update assignments
CREATE POLICY "assignments_update_permitted" ON schedule_assignments
  FOR UPDATE USING (
    is_admin() OR has_permission(
      'schedules', 'edit',
      (SELECT event_id FROM schedules WHERE id = schedule_id)
    )
  );

-- Permitted users can delete assignments
CREATE POLICY "assignments_delete_admin" ON schedule_assignments
  FOR DELETE USING (
    is_admin() OR has_permission(
      'schedules', 'delete',
      (SELECT event_id FROM schedules WHERE id = schedule_id)
    )
  );

-- ============================================================
-- THEATERS
-- ============================================================
-- Approved users can view theaters
CREATE POLICY "theaters_select_approved" ON theaters
  FOR SELECT USING (is_approved());

-- Permitted users can manage theaters
CREATE POLICY "theaters_insert_permitted" ON theaters
  FOR INSERT WITH CHECK (
    is_admin() OR has_permission('theaters', 'create', event_id)
  );

CREATE POLICY "theaters_update_permitted" ON theaters
  FOR UPDATE USING (
    is_admin() OR has_permission('theaters', 'edit', event_id)
  );

CREATE POLICY "theaters_delete_admin" ON theaters
  FOR DELETE USING (
    is_admin() OR has_permission('theaters', 'delete', event_id)
  );

-- ============================================================
-- THEATER CAST
-- ============================================================
-- theater_cast has no event_id column — it inherits via theater_id.
-- ARCHITECTURE RULE: never pass NULL to has_permission.
-- Resolve event_id via a correlated subquery on theaters.
-- Cross-event integrity is also enforced by trg_validate_theater_cast_event.
CREATE POLICY "theater_cast_select_approved" ON theater_cast
  FOR SELECT USING (is_approved());

-- Permitted users can manage cast (resolve event_id via theater)
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

-- ============================================================
-- MEDICATIONS
-- ============================================================
-- Health team and admins can view medications
CREATE POLICY "medications_select_permitted" ON medications
  FOR SELECT USING (
    is_admin() OR has_permission('medications', 'view', event_id)
  );

-- Health team can register medications
CREATE POLICY "medications_insert_permitted" ON medications
  FOR INSERT WITH CHECK (
    is_admin() OR has_permission('medications', 'create', event_id)
  );

-- Health team can update (but not delete - audit trail)
CREATE POLICY "medications_update_permitted" ON medications
  FOR UPDATE USING (
    is_admin() OR has_permission('medications', 'edit', event_id)
  );

-- NO DELETE policy for medications - audit trail must be preserved

-- ============================================================
-- ALERTS
-- ============================================================
-- Team-targeted alerts use people.user_id (hard link) for membership check.
-- Segmentation rules:
--   • target_type = 'all'             → visible to all approved users
--   • target_type IN ('team','multiple') → visible to:
--       - admins
--       - users with 'alerts.view' permission for this event
--       - users whose people record (people.user_id = auth.uid())
--         has a team_id that is in the alert's target_team_ids array,
--         scoped to the same event as the alert (hard link, no name matching)

CREATE POLICY "alerts_select_approved" ON alerts
  FOR SELECT USING (
    is_approved()
    AND (
      -- Broadcast: visible to all approved users
      target_type = 'all'

      -- Admins see everything
      OR is_admin()

      -- Users with explicit view permission for this event (or global)
      OR has_permission('alerts', 'view', event_id)

      -- Hard team-membership check via people.user_id
      -- The current auth user must have a person record in this event
      -- whose team is listed in target_team_ids
      OR EXISTS (
        SELECT 1
        FROM people p
        WHERE p.user_id   = auth.uid()          -- hard identity link
          AND p.event_id  = alerts.event_id     -- same event as the alert
          AND p.team_id   = ANY(alerts.target_team_ids)  -- member of a target team
      )
    )
  );

-- Permitted users can create alerts (scoped to the alert's event)
CREATE POLICY "alerts_insert_permitted" ON alerts
  FOR INSERT WITH CHECK (
    is_admin() OR has_permission('alerts', 'create', event_id)
  );

-- Only admins can delete alerts
CREATE POLICY "alerts_delete_admin" ON alerts
  FOR DELETE USING (is_admin());

-- ============================================================
-- ALERT READS
-- ============================================================
-- Users can see their own reads
CREATE POLICY "alert_reads_select_own" ON alert_reads
  FOR SELECT USING (user_id = auth.uid() OR is_admin());

-- Users can mark alerts as read
CREATE POLICY "alert_reads_insert_own" ON alert_reads
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ============================================================
-- OCCURRENCES
-- ============================================================
-- Approved users can view occurrences
CREATE POLICY "occurrences_select_approved" ON occurrences
  FOR SELECT USING (
    is_admin() OR has_permission('occurrences', 'view', event_id)
  );

-- Permitted users can create occurrences
CREATE POLICY "occurrences_insert_permitted" ON occurrences
  FOR INSERT WITH CHECK (
    is_approved() AND (is_admin() OR has_permission('occurrences', 'create', event_id))
  );

-- Permitted users can update occurrences
CREATE POLICY "occurrences_update_permitted" ON occurrences
  FOR UPDATE USING (
    is_admin() OR has_permission('occurrences', 'edit', event_id)
  );

-- Only admins can delete
CREATE POLICY "occurrences_delete_admin" ON occurrences
  FOR DELETE USING (is_admin());

-- ============================================================
-- PERMISSIONS
-- ============================================================
-- Users can view their own permissions
CREATE POLICY "permissions_select_own" ON permissions
  FOR SELECT USING (user_id = auth.uid() OR is_admin());

-- Only admins can manage permissions
CREATE POLICY "permissions_insert_admin" ON permissions
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "permissions_update_admin" ON permissions
  FOR UPDATE USING (is_admin());

CREATE POLICY "permissions_delete_admin" ON permissions
  FOR DELETE USING (is_admin());

-- ============================================================
-- AUDIT LOGS
-- ============================================================
-- SECURITY RULE: audit_logs are write-only from the server (service role).
-- No client-side INSERT is permitted — clients cannot write their own audit trail.
-- The service role bypasses RLS by design; application code in services/index.ts
-- writes audit entries server-side. If migrating to Edge Functions, use service role key.
--
-- Reads: admins only.
-- Writes: service role only (no INSERT policy — RLS blocks all anon/authenticated inserts).
-- Updates/Deletes: never (no policies → always blocked).
CREATE POLICY "audit_logs_select_admin" ON audit_logs
  FOR SELECT USING (is_admin());

-- DROP IF EXISTS is in the migration script; no INSERT policy is created here.
-- audit_logs_insert_approved is intentionally absent.

-- ============================================================
-- REALTIME SUBSCRIPTIONS
-- Enable realtime for critical tables
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE alert_reads;
ALTER PUBLICATION supabase_realtime ADD TABLE schedules;
ALTER PUBLICATION supabase_realtime ADD TABLE occurrences;
ALTER PUBLICATION supabase_realtime ADD TABLE medications;
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
