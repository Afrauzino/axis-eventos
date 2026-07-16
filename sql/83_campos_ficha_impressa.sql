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
