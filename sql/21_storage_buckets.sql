-- ============================================================================
-- 21_storage_buckets.sql — cria/garante os buckets de Storage do app
-- Corrige #3a: "erro ao usar FOTO como ícone da equipe" (bucket team-photos
-- não existia / sem política). Idempotente: pode rodar quantas vezes quiser.
-- Rode no SQL Editor do Supabase.
-- ============================================================================

-- 1) Garante que todos os buckets usados pelo app existem e são públicos (leitura)
insert into storage.buckets (id, name, public)
values
  ('team-photos','team-photos', true),
  ('avatars','avatars', true),
  ('pessoas','pessoas', true),
  ('correio','correio', true),
  ('arquivos','arquivos', true),
  ('alertas','alertas', true),
  ('locais','locais', true),
  ('personagens','personagens', true),
  ('objetos','objetos', true)
on conflict (id) do update set public = true;

-- 2) Políticas de acesso (leitura pública; escrita só logado)
--    Uma policy por operação, cobrindo TODOS os buckets acima.
do $$
declare
  buckets text[] := array['team-photos','avatars','pessoas','correio','arquivos','alertas','locais','personagens','objetos'];
begin
  -- Limpa policies antigas com o mesmo nome (pra poder rodar de novo)
  drop policy if exists "app_storage_read"   on storage.objects;
  drop policy if exists "app_storage_insert" on storage.objects;
  drop policy if exists "app_storage_update" on storage.objects;
  drop policy if exists "app_storage_delete" on storage.objects;

  -- Leitura pública (anon + authenticated) nos buckets do app
  execute format($p$
    create policy "app_storage_read" on storage.objects for select
    using ( bucket_id = any (%L::text[]) )
  $p$, buckets);

  -- Enviar/atualizar/apagar: só usuário logado
  execute format($p$
    create policy "app_storage_insert" on storage.objects for insert to authenticated
    with check ( bucket_id = any (%L::text[]) )
  $p$, buckets);

  execute format($p$
    create policy "app_storage_update" on storage.objects for update to authenticated
    using ( bucket_id = any (%L::text[]) )
  $p$, buckets);

  execute format($p$
    create policy "app_storage_delete" on storage.objects for delete to authenticated
    using ( bucket_id = any (%L::text[]) )
  $p$, buckets);
end $$;

-- Conferência: lista os buckets
select id, public from storage.buckets order by id;
