-- ============================================================================
-- 68_cadastro_cargo.sql — Campo "Cargo" no cadastro (configurável em Administração)
-- ----------------------------------------------------------------------------
-- 1) Coluna nova em people: cargo (texto livre, escolhido de uma lista que o
--    admin configura em Administração → Ficha de cadastro).
-- 2) Inclui 'cargo' na função de auto-cadastro (Perfil → editar meus dados),
--    mantendo a MESMA segurança (não mexe em papel/permissão).
--
-- A lista de cargos + obrigatório/ocultar ficam em `configuracoes` (chave/valor),
-- então NÃO precisa de schema pra isso. Só a coluna abaixo.
--
-- Rodar no Supabase (SQL Editor). Pode rodar de novo.
-- ============================================================================

alter table public.people add column if not exists cargo text;

-- Recria a função incluindo o cargo (resto idêntico ao sql/59).
create or replace function public.atualizar_meu_cadastro(p jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Sem usuário logado';
  end if;

  update public.people set
    name            = coalesce(nullif(p->>'name',''), name),
    phone           = coalesce(p->>'phone', phone),
    contact_phone   = nullif(p->>'contact_phone',''),
    church          = coalesce(p->>'church', church),
    ano_encontro    = nullif(p->>'ano_encontro','')::int,
    sexo            = nullif(p->>'sexo',''),
    birth_date      = nullif(p->>'birth_date','')::date,
    cpf             = nullif(p->>'cpf',''),
    rg              = nullif(p->>'rg',''),
    cidade          = nullif(p->>'cidade',''),
    estado          = nullif(p->>'estado',''),
    endereco        = nullif(p->>'endereco',''),
    bairro          = nullif(p->>'bairro',''),
    cep             = nullif(p->>'cep',''),
    cargo           = nullif(p->>'cargo',''),
    notes           = nullif(p->>'notes',''),
    photo_url       = coalesce(p->>'photo_url', photo_url)
  where user_id = uid;

  update public.profiles set
    name       = coalesce(nullif(p->>'name',''), name),
    phone      = coalesce(p->>'phone', phone),
    church     = coalesce(p->>'church', church),
    avatar_url = coalesce(p->>'photo_url', avatar_url)
  where user_id = uid;
end;
$$;

revoke all on function public.atualizar_meu_cadastro(jsonb) from public;
grant execute on function public.atualizar_meu_cadastro(jsonb) to authenticated;

notify pgrst, 'reload schema';
