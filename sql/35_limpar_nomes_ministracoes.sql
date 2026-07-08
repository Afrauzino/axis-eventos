-- ============================================================================
-- 35_limpar_nomes_ministracoes.sql — tira espaços do começo/fim dos nomes
-- e mostra possíveis duplicados (ex.: duas "Batismo"). Rode no SQL Editor.
-- OBS: a tabela tem ACENTO no nome → public."ministrações".
-- ============================================================================

-- 1) Remove espaços no início/fim (ex.: " Ampliamos...", " Cura interior")
update public."ministrações"
set titulo = btrim(titulo)
where titulo is distinct from btrim(titulo);

-- 2) Lista nomes duplicados (NÃO apaga nada — só pra você ver e decidir).
--    Se quiser juntar/apagar uma delas, me diga QUAL manter (por causa dos
--    vínculos com cronograma/teatro) que eu faço com segurança.
select titulo, count(*) as qtd
from public."ministrações"
group by titulo
having count(*) > 1
order by titulo;
