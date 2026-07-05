-- ============================================================================
-- 31_evento_card_visual.sql — personalizar a caixa "Evento atual" da tela
-- inicial: cor de fundo e/ou imagem de fundo (por evento).
-- Idempotente. Rode no SQL Editor do Supabase.
-- ============================================================================

alter table public.events add column if not exists home_cor    text;   -- cor de fundo da caixa (hex)
alter table public.events add column if not exists home_bg_url text;    -- imagem de fundo (URL)

comment on column public.events.home_cor    is 'Cor de fundo da caixa "Evento atual" na tela inicial.';
comment on column public.events.home_bg_url is 'Imagem de fundo da caixa "Evento atual" na tela inicial.';
