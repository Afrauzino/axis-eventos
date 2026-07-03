-- ============================================================================
-- 22_realtime_cronograma.sql — liga o Realtime do cronograma (#12)
-- Faz o cronômetro/tempo aparecer em TODOS os celulares em ~1-2s, sem recarregar.
-- Rode UMA vez no SQL Editor do Supabase.
-- ============================================================================

-- Adiciona a tabela à publicação de realtime (idempotente)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'cronograma_eventos'
  ) then
    alter publication supabase_realtime add table public.cronograma_eventos;
  end if;
end $$;

-- Garante que o UPDATE mande a linha completa (necessário p/ o app receber os campos do cronômetro)
alter table public.cronograma_eventos replica identity full;

-- Conferência
select tablename from pg_publication_tables
where pubname='supabase_realtime' and schemaname='public' and tablename='cronograma_eventos';
