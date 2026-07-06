-- sql/32 — Teatro: capa/foto do teatro + cenas em BLOCOS + vários personagens/objetos por cena
-- Rodar no SQL Editor do Supabase. Seguro rodar mais de uma vez (IF NOT EXISTS).

-- 1) Capa e foto do teatro (além de cor + emoji, que já existem)
alter table public.theaters add column if not exists foto_url text;   -- foto no lugar do emoji
alter table public.theaters add column if not exists capa_url text;   -- imagem de fundo (capa/banner)

-- 2) Cena em BLOCOS tipados (Fala / Deixa / Ação / Trilha / Observação / Foto...)
--    Guardado como JSON: [{ "tipo": "fala", "conteudo": "<html com cor/negrito>" }, ...]
alter table public.teatro_cenas add column if not exists blocos jsonb default '[]'::jsonb;

-- 3) Vários PERSONAGENS por cena: [{ "personagem_id": "...", "person_ids": ["...","..."] }]
alter table public.teatro_cenas add column if not exists personagens jsonb default '[]'::jsonb;

-- 4) Vários OBJETOS por cena: ["objeto_id_1", "objeto_id_2", ...]
alter table public.teatro_cenas add column if not exists objetos jsonb default '[]'::jsonb;
