-- sql/34 — Ordem manual das ministrações (subir/descer na lista)
-- Rodar no SQL Editor do Supabase. Seguro rodar mais de uma vez.

alter table public."ministrações" add column if not exists ordem int;
