-- ============================================================================
-- LIMPAR_STORAGE.sql — APAGA FOTOS E ARQUIVOS (Storage) (rode no Supabase)
-- ----------------------------------------------------------------------------
-- ⚠️  APAGA TODOS os arquivos enviados: fotos de pessoas, avatares, fotos de
--     equipes/locais/personagens/objetos, crachás, arquivos de correio,
--     anexos de alertas, mídias/imagens de ministração/teatro, carrossel
--     e a LOGO do sistema.
--
-- >>> IRREVERSÍVEL. Rode junto com o LIMPAR_TUDO.sql para começar 100% limpo. <<<
--
-- Observação: como a LOGO fica no bucket `arquivos` (em sistema/logo_...), ela
-- também será apagada — depois é só reenviar em Admin → Aparência. As
-- boas-vindas (texto/GPS/contatos) NÃO têm arquivo, então continuam.
-- ============================================================================

delete from storage.objects
where bucket_id in (
  'correio', 'arquivos', 'alertas', 'avatars',
  'pessoas', 'team-photos', 'locais', 'personagens', 'objetos'
);

-- Conferência (deve ficar vazio ou zerado nesses buckets)
select bucket_id, count(*) as arquivos
from storage.objects
group by bucket_id
order by bucket_id;

-- ----------------------------------------------------------------------------
-- Se der "permission denied for table objects": faça pelo painel do Supabase →
-- Storage → abra cada bucket → selecionar tudo → Delete. Buckets do app:
-- correio, arquivos, alertas, avatars, pessoas, team-photos, locais,
-- personagens, objetos.
-- ----------------------------------------------------------------------------
