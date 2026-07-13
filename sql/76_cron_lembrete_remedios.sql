-- ============================================================================
-- 76_cron_lembrete_remedios.sql — LIGA o lembrete de remédio ("Hora do remédio")
-- ----------------------------------------------------------------------------
-- AUDITORIA (13/07/2026, Claude): só existe 1 cron agendado — o `lembretes`
-- (jobid=1, a cada 5 min). O robô do remédio (`lembrete-remedios`) NUNCA foi
-- agendado, então o aviso "Hora do remédio" nunca dispara.
--
-- Este script cria o cron do remédio COPIANDO o mesmo comando do `lembretes`
-- (mesma URL + mesmo segredo CRON_SECRET) e só troca o nome da função. Assim
-- não precisa colar o segredo à mão.
--
-- PRÉ-REQUISITO: a Edge Function `lembrete-remedios` precisa estar PUBLICADA
-- (Supabase → Edge Functions → lembrete-remedios → Deploy). Se ela nunca foi
-- publicada, publique ANTES de rodar isto (senão o cron chama uma função que
-- não existe e não envia nada).
--
-- Rodar no Supabase → SQL Editor. Idempotente: se já existir, reassina.
-- ============================================================================

select cron.schedule(
  'lembrete-remedios',
  '*/5 * * * *',
  replace(
    (select command from cron.job where jobid = 1),
    'functions/v1/lembretes',
    'functions/v1/lembrete-remedios'
  )
);

-- Conferir que ficou agendado (deve listar 2 crons: lembretes + lembrete-remedios):
-- select jobid, jobname, schedule, active from cron.job order by jobid;
