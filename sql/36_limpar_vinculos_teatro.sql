-- ============================================================================
-- 36_limpar_vinculos_teatro.sql — remove os vínculos ANTIGOS teatro→ministração
-- Hoje o vínculo teatro↔ministração é feito SÓ pelo Cronograma. Ficaram uns
-- vínculos antigos direto na tabela theaters (coluna ministracao_id).
-- Este script limpa esses vínculos antigos.
--
-- ⚠️ IMPORTANTE: depois de rodar, um teatro só vai aparecer "vinculado" a uma
--    ministração se ele estiver colocado JUNTO no Cronograma. Se algum teatro
--    dependia só do vínculo antigo, adicione-o no Cronograma no item certo.
--
-- Rode no SQL Editor do Supabase.
-- ============================================================================

-- Confira antes quantos serão limpos:
-- select count(*) from public.theaters where ministracao_id is not null;

update public.theaters
set ministracao_id = null
where ministracao_id is not null;
