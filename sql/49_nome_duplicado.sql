-- ============================================================================
-- 49_nome_duplicado.sql — Anti-duplicidade de NOME também na auto-inscrição
-- ----------------------------------------------------------------------------
-- A auto-inscrição roda ANTES do login (anônimo) e não pode ler a lista de pessoas.
-- Esta função responde só "esse nome já existe? sim/não" (sem devolver a lista),
-- rodando com privilégio (security definer). Normaliza acento/maiúscula/espaços.
-- Rode no Supabase (SQL Editor → Run).
-- ============================================================================

create or replace function public.nome_ja_existe(p_event uuid, p_nome text, p_exceto uuid default null)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.people
    where event_id = p_event
      and (p_exceto is null or id <> p_exceto)
      and regexp_replace(translate(lower(btrim(name)),  'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc'), '\s+', ' ', 'g')
        = regexp_replace(translate(lower(btrim(p_nome)), 'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc'), '\s+', ' ', 'g')
  );
$$;

grant execute on function public.nome_ja_existe(uuid, text, uuid) to anon, authenticated;
