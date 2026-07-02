-- ============================================================
-- LIMPAR_MEDS_TESTE.sql — apaga medicamentos e doses de TESTE do evento ativo.
-- ⚠️ Destrutivo: remove TODOS os medicamentos contínuos e doses do evento ativo.
-- Use só pra testar limpo. Cole no SQL Editor e RUN.
-- ============================================================
DELETE FROM med_agenda      WHERE event_id = (SELECT id FROM events WHERE status='active' ORDER BY created_at DESC LIMIT 1);
DELETE FROM med_controlados WHERE event_id = (SELECT id FROM events WHERE status='active' ORDER BY created_at DESC LIMIT 1);
-- (opcional) zera a flag "toma controlado" das fichas do evento ativo:
-- UPDATE saude_fichas SET toma_controlado = false WHERE event_id = (SELECT id FROM events WHERE status='active' ORDER BY created_at DESC LIMIT 1);
