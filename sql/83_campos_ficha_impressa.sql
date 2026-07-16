-- ============================================================================
-- 83_campos_ficha_impressa.sql — os campos que a ficha de papel tem e o app não
-- ----------------------------------------------------------------------------
-- A ficha impressa (modelo do Anderson) pede coisas que o cadastro online ainda
-- não coletava. Agora que a pessoa se inscreve online e alguém só IMPRIME e colhe
-- a assinatura, esses campos precisam sair prontos no papel.
--
--   estado_civil          -> "Estado civil: ______"
--   phone2                -> "Tel. p/ contato: (__)____ ou (__)____"  (o 2º)
--   contact_phone_dono    -> "(__)____ pertence à: ______"            (1º recado)
--   contact_phone2        -> 2º telefone de recado/emergência
--   contact_phone2_dono   -> "pertence à:" do 2º
--   rede_outra            -> "Outra que desejar: ______"
--
-- Todos OPCIONAIS (text, sem NOT NULL) — cadastro antigo não quebra, e cada um
-- pode ser ocultado/obrigado em Administração → Ficha de cadastro.
-- Rode: SQL Editor -> Run. Idempotente.
-- ============================================================================

alter table public.people add column if not exists estado_civil        text;
alter table public.people add column if not exists phone2              text;
alter table public.people add column if not exists contact_phone_dono  text;
alter table public.people add column if not exists contact_phone2      text;
alter table public.people add column if not exists contact_phone2_dono text;
alter table public.people add column if not exists rede_outra          text;

-- ---------------------------------------------------------------------------
-- A RPC do "completar meu cadastro" (tela Pending) também precisa conhecer os
-- campos novos — senão a pessoa preenche e o dado é DESCARTADO em silêncio,
-- que é exatamente o tipo de perda que já mordeu este app antes.
-- Mantém tudo que a versão do sql/68 fazia; só acrescenta os campos.
-- ---------------------------------------------------------------------------
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
    photo_url       = coalesce(p->>'photo_url', photo_url),
    -- novos (sql/81 e este arquivo)
    instagram           = nullif(p->>'instagram',''),
    facebook            = nullif(p->>'facebook',''),
    rede_outra          = nullif(p->>'rede_outra',''),
    estado_civil        = nullif(p->>'estado_civil',''),
    phone2              = nullif(p->>'phone2',''),
    contact_phone_dono  = nullif(p->>'contact_phone_dono',''),
    contact_phone2      = nullif(p->>'contact_phone2',''),
    contact_phone2_dono = nullif(p->>'contact_phone2_dono','')
  where user_id = uid;

  update public.profiles set
    name       = coalesce(nullif(p->>'name',''), name),
    phone      = coalesce(p->>'phone', phone),
    church     = coalesce(p->>'church', church),
    avatar_url = coalesce(p->>'photo_url', avatar_url)
  where user_id = uid;
end;
$$;

notify pgrst, 'reload schema';

-- ============================================================================
-- CONFERÊNCIA — uma query só (o SQL Editor mostra apenas o último resultado)
-- ============================================================================
select
  c.coluna,
  case when x.column_name is null then 'FALTANDO' else 'OK' end as situacao
from (values
  ('estado_civil'),('phone2'),('contact_phone_dono'),
  ('contact_phone2'),('contact_phone2_dono'),('rede_outra')
) as c(coluna)
left join information_schema.columns x
  on x.table_schema = 'public' and x.table_name = 'people' and x.column_name = c.coluna
order by c.coluna;
