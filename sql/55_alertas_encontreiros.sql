-- ============================================================
-- 55_alertas_encontreiros.sql
--
-- Deixa o ADMIN mandar alerta só para ENCONTREIROS ('worker') ou só para
-- ENCONTRISTAS ('encounterer'). É a parte de ALERTAS do sql/50, isolada aqui
-- pra rodar rapidinho caso o 50 não tenha rodado inteiro.
--
-- Rode inteiro no SQL Editor do Supabase. Pode rodar quantas vezes quiser.
-- ============================================================

-- 1) O CHECK antigo só aceitava 'all','team','multiple'. Removemos qualquer
--    check de target_type e recriamos aceitando também 'worker' e 'encounterer'.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class t ON t.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND t.relname = 'alerts' AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%target_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.alerts DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.alerts ADD CONSTRAINT alerts_target_type_check
  CHECK (target_type IN ('all', 'team', 'multiple', 'worker', 'encounterer'));

-- 2) Quem enxerga o alerta: 'all' (todos), admin (tudo), por TIPO de pessoa
--    (encontreiro/encontrista) e por equipe. (has_permission só entra se existir.)
DO $$
DECLARE
  tem_has_permission boolean;
  linha_permissao    text := '';
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'has_permission'
  ) INTO tem_has_permission;

  IF tem_has_permission THEN
    linha_permissao := 'OR has_permission(''alerts'', ''view'', event_id)';
  END IF;

  DROP POLICY IF EXISTS alerts_select_approved ON public.alerts;

  EXECUTE format($f$
    CREATE POLICY "alerts_select_approved" ON public.alerts
      FOR SELECT USING (
        is_approved()
        AND (
          target_type = 'all'
          OR is_admin()
          %s
          OR EXISTS (
            SELECT 1 FROM public.people p
            WHERE p.user_id   = auth.uid()
              AND p.event_id  = alerts.event_id
              AND p.role_type = alerts.target_type
          )
          OR EXISTS (
            SELECT 1 FROM public.people p
            WHERE p.user_id  = auth.uid()
              AND p.event_id = alerts.event_id
              AND p.team_id  = ANY(alerts.target_team_ids)
          )
        )
      )
  $f$, linha_permissao);
END $$;

NOTIFY pgrst, 'reload schema';
