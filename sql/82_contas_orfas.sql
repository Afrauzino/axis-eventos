-- ============================================================================
-- 82_contas_orfas.sql — acha as contas que ficaram SEM FICHA
-- ----------------------------------------------------------------------------
-- O QUE ACONTECEU: entre o deploy que passou a gravar instagram/facebook e o
-- momento em que o sql/81 rodou, a inscrição fazia:
--   1. auth.signUp  -> cria a CONTA
--   2. trg_handle_new_user (sql/01_schema.sql:393) -> cria o PROFILE com o nome
--   3. insert em people -> ESTOUROU ("column instagram does not exist")
-- Resultado: login existe, ficha não. No Admin aparece como
-- "Conta — sem cadastro no evento", sem foto. Os dados que a pessoa digitou
-- (foto, CPF, telefone...) estavam só no navegador dela e SE PERDERAM — não dá
-- pra recuperar por SQL. O que dá é achar QUEM é, pra chamar de volta.
--
-- Já corrigido no app (commit a1371c6): a validação agora roda ANTES do signUp e
-- o insert regrava sem as redes se a coluna não existir. Não nasce órfã nova.
--
-- Rode: SQL Editor -> Run. É SÓ LEITURA — não altera nada.
-- ============================================================================

-- 1) AS ÓRFÃS: tem conta e perfil, mas nenhuma ficha no evento ATIVO.
--    Ligue pra cada uma. A recuperação é: você exclui a conta dela
--    (Administração -> a pessoa -> Excluir) e ela se inscreve de novo — agora
--    o cadastro grava certo. Sem excluir, ela toma "email já cadastrado".
select
  p.name                                  as nome,
  u.email                                 as email,
  p.role_status                           as situacao,
  to_char(u.created_at, 'DD/MM HH24:MI')  as inscreveu_em,
  case when u.last_sign_in_at is null then 'nunca entrou' else 'já entrou' end as acesso
from public.profiles p
join auth.users u on u.id = p.user_id
where not exists (
  select 1 from public.people pe
  where pe.user_id = p.user_id
    and pe.event_id = (select id from public.events where status = 'active' limit 1)
)
-- não lista quem é da casa (admin/pastor não tem ficha de encontrista mesmo)
and coalesce(p.user_role,'') not in ('admin','pastor','coordenador','financeiro')
and coalesce(p.is_admin,false) = false
order by u.created_at desc;


-- 2) CONTAGEM: quantas órfãs, e quantas nasceram DEPOIS do deploy problemático
--    (15/07/2026 22:17). As de antes têm outra causa — me mostre se aparecer.
select
  count(*)                                                              as orfas_total,
  count(*) filter (where u.created_at >= timestamptz '2026-07-15 22:17-03') as orfas_pos_deploy
from public.profiles p
join auth.users u on u.id = p.user_id
where not exists (
  select 1 from public.people pe
  where pe.user_id = p.user_id
    and pe.event_id = (select id from public.events where status = 'active' limit 1)
)
and coalesce(p.user_role,'') not in ('admin','pastor','coordenador','financeiro')
and coalesce(p.is_admin,false) = false;


-- 3) SANIDADE: as colunas do sql/81 existem mesmo? (se 'FALTANDO', o insert
--    ainda estava quebrando até você rodar o 81)
select 'people.instagram'::text as coluna,
       case when exists (select 1 from information_schema.columns
                         where table_schema='public' and table_name='people' and column_name='instagram')
            then 'OK' else 'FALTANDO' end as situacao
union all
select 'people.facebook',
       case when exists (select 1 from information_schema.columns
                         where table_schema='public' and table_name='people' and column_name='facebook')
            then 'OK' else 'FALTANDO' end;


-- 4) FICHAS SEM FOTO no evento ativo (o outro jeito de "vir sem foto"):
--    se aparecer gente aqui, o problema NÃO é conta órfã — é o upload da foto.
select p.name as nome, p.church as igreja,
       to_char(p.created_at, 'DD/MM HH24:MI') as cadastrou_em
from public.people p
where p.event_id = (select id from public.events where status = 'active' limit 1)
  and (p.photo_url is null or p.photo_url = '')
order by p.created_at desc
limit 20;
