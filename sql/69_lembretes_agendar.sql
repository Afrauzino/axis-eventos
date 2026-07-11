-- ============================================================================
-- 69_lembretes_agendar.sql — Robô de lembretes do CRONOGRAMA e ESCALAS
-- ----------------------------------------------------------------------------
-- Avisa "começa em breve" (~10 min antes) usando os horários que já existem no
-- cronograma (hora_inicio) e nas escalas (start_time). Respeita as REGRAS de
-- notificação (Administração → Notificações): só dispara o que estiver ligado.
--
-- PASSOS (uma vez só):
--   1) Rode este SQL (cria as colunas push_em).
--   2) Publique a Edge Function `lembretes` no Supabase (cole o index.ts inteiro).
--   3) O secret CRON_SECRET já existe (o mesmo do robô de remédios). Se não tiver,
--      crie em Edge Functions → Secrets.
--   4) Rode a PARTE 2 (agendamento) TROCANDO 'MINHA_SENHA_DO_ROBO' pela sua
--      CRON_SECRET (a MESMA senha do robô de remédios).
--
-- Pode rodar de novo sem problema.
-- ============================================================================

-- PARTE 1 — colunas de controle (marca que já avisou, pra não repetir)
alter table public.cronograma_eventos add column if not exists push_em timestamptz;
alter table public.escalas            add column if not exists push_em timestamptz;
create index if not exists idx_cron_push on public.cronograma_eventos(push_em, hora_inicio);
create index if not exists idx_escala_push on public.escalas(push_em, start_time);

notify pgrst, 'reload schema';

-- ============================================================================
-- PARTE 2 — AGENDAMENTO (rode DEPOIS de publicar a função `lembretes`)
-- TROQUE 'MINHA_SENHA_DO_ROBO' pela sua CRON_SECRET (a mesma dos remédios).
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'lembretes-cronograma';
exception when others then null;
end $$;

select cron.schedule(
  'lembretes-cronograma',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://vxhowdmzssvvmgonwoud.supabase.co/functions/v1/lembretes',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'MINHA_SENHA_DO_ROBO'),
    body := '{}'::jsonb
  );
  $$
);
