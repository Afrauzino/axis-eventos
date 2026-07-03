-- ============================================================================
-- LIMPAR_TESTE_MANTER_3.sql — limpeza pontual (UMA VEZ), rode no SQL Editor.
-- MANTÉM só 3 contas; apaga TODAS as outras (perfil + login).
--   Mantém: Anderson (admin), Glaucia, Kauã
-- ⚠️ IRREVERSÍVEL. Confira os 3 emails abaixo antes de rodar.
-- ============================================================================

-- Lista de quem FICA (edite aqui se precisar):
--   afrauzino@gmail.com               (Anderson / admin)
--   glauciafernanda.freitas@gmail.com (Glaucia)
--   kauadosreis26@gmail.com           (Kauã)

-- 1) Apaga os PERFIS de todos, menos os 3
delete from public.profiles
where user_id in (
  select id from auth.users
  where email not in (
    'afrauzino@gmail.com',
    'glauciafernanda.freitas@gmail.com',
    'kauadosreis26@gmail.com'
  )
);

-- 2) Apaga os LOGINS de todos, menos os 3
delete from auth.users
where email not in (
  'afrauzino@gmail.com',
  'glauciafernanda.freitas@gmail.com',
  'kauadosreis26@gmail.com'
);

-- 3) Conferência (deve sobrar só os 3 emails)
select email from auth.users order by email;
