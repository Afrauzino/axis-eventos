-- ============================================================================
-- 45_fk_auth_delete_ok.sql — Permite excluir um login (auth.users) sem erro
-- ----------------------------------------------------------------------------
-- PROBLEMA: várias tabelas apontam para auth.users (created_by, user_id, etc.)
-- SEM regra de "o que fazer quando o login some". Isso trava a exclusão do
-- login no painel do Supabase e na Edge Function (erro "Database error deleting
-- user").
--
-- SOLUÇÃO: para CADA amarra dessas, define a soltura automática:
--   - coluna que pode ficar vazia  -> ON DELETE SET NULL (mantém o conteúdo,
--                                     só esquece quem criou)
--   - coluna obrigatória           -> ON DELETE CASCADE  (apaga junto)
--
-- É seguro rodar mais de uma vez (só mexe no que ainda não está ajustado).
-- Rode no Supabase: SQL Editor -> cole tudo -> Run.
-- ============================================================================

do $$
declare
  r record;
begin
  for r in
    select
      con.conname                       as conname,
      con.conrelid::regclass::text      as tbl,
      att.attname                       as col,
      att.attnotnull                    as notnull
    from pg_constraint con
    join pg_class     ref   on ref.oid   = con.confrelid
    join pg_namespace refns on refns.oid = ref.relnamespace
    join pg_attribute att   on att.attrelid = con.conrelid
                           and att.attnum   = con.conkey[1]
    where con.contype = 'f'
      and refns.nspname = 'auth'
      and ref.relname   = 'users'
      and array_length(con.conkey, 1) = 1        -- só FK de coluna única
      and con.confdeltype not in ('c','n')       -- ainda NÃO é cascade/set null
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    if r.notnull then
      execute format(
        'alter table %s add constraint %I foreign key (%I) references auth.users(id) on delete cascade',
        r.tbl, r.conname, r.col);
    else
      execute format(
        'alter table %s add constraint %I foreign key (%I) references auth.users(id) on delete set null',
        r.tbl, r.conname, r.col);
    end if;
    raise notice 'ajustado: % (%.%)', r.conname, r.tbl, r.col;
  end loop;
end $$;
