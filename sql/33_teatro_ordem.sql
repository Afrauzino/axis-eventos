-- sql/33 — Ordem manual dos teatros (arrastar/subir/descer na lista)
-- Rodar no SQL Editor do Supabase. Seguro rodar mais de uma vez.

alter table public.theaters add column if not exists ordem int;
