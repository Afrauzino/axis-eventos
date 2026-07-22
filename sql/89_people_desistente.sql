-- ============================================================================
-- 89_people_desistente.sql
-- Desistência: a pessoa PERDE o acesso e SAI do Financeiro (sem pagamentos a
-- fazer), mas o cadastro FICA no histórico (nada é apagado).
--
-- Flag por PESSOA (cobre inclusive quem não tem conta / só pré-cadastro).
-- Quem TEM conta também recebe profiles.role_status='desistente' (isso barra o
-- acesso — o app faz os dois). Reversível. JÁ RODADO no banco (2026-07-20).
-- ============================================================================
alter table public.people add column if not exists desistente boolean not null default false;
create index if not exists idx_people_desistente on public.people(event_id, desistente);
