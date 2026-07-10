-- ============================================================
-- 57_remedios_agendar.sql
-- Agenda o robô que avisa remédio (roda a cada 5 min e chama a função
-- lembrete-remedios). Rode DEPOIS de: (1) rodar o 56, (2) publicar a função
-- lembrete-remedios, (3) cadastrar o secret CRON_SECRET.
--
-- >>> TROQUE 'MINHA_SENHA_DO_ROBO' pela MESMA senha que você pôs no
--     secret CRON_SECRET (invente um texto, ex.: axis-remedio-2026). <<<
--
-- Pode rodar de novo sem problema (ele re-agenda).
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove agendamento anterior (se existir), pra não duplicar
do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'lembrete-remedios';
exception when others then null;
end $$;

-- Agenda a cada 5 minutos
select cron.schedule(
  'lembrete-remedios',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://vxhowdmzssvvmgonwoud.supabase.co/functions/v1/lembrete-remedios',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'MINHA_SENHA_DO_ROBO'),
    body := '{}'::jsonb
  );
  $$
);
