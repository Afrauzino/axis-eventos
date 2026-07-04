-- ============================================================================
-- 29_med_janela.sql — período (início/fim) do controle de medicamentos.
-- Antes: uma "hora de corte" fixa + regra "hoje + 2 dias". Agora: o admin
-- define DATA E HORA inicial e final na tela Saúde → Configuração, e as doses
-- são calculadas dentro dessa janela.
-- Guardado como TEXTO no formato 'YYYY-MM-DDTHH:MM' (mesmo do resto do app,
-- lido com new Date(...) em horário local). Idempotente.
-- Rode no SQL Editor do Supabase.
-- ============================================================================

alter table public.events add column if not exists med_inicio text;
alter table public.events add column if not exists med_fim    text;

comment on column public.events.med_inicio is 'Início do período de doses (YYYY-MM-DDTHH:MM, hora local). Saúde → Configuração.';
comment on column public.events.med_fim    is 'Fim do período de doses (YYYY-MM-DDTHH:MM, hora local). Saúde → Configuração.';
