-- ============================================================================
-- 51_excluir_conta.sql — Excluir uma conta DE VERDADE, do banco
-- ----------------------------------------------------------------------------
-- PROBLEMA 1: o app apagava a pessoa com ~10 `delete` soltos do navegador.
--   Um `delete` barrado pela RLS NÃO dá erro: ele "funciona" apagando 0 linhas.
--   Resultado: sobrava sujeira e ninguém era avisado.
--
-- PROBLEMA 2: apagar o login dependia de uma Edge Function que hoje responde
--   403 ("Apenas administradores"). Sem apagar auth.users, o email continua
--   ocupado e a pessoa não consegue se inscrever de novo.
--
-- SOLUÇÃO: uma função no próprio banco (SECURITY DEFINER) que faz tudo de uma
--   vez, numa transação só, com as mesmas travas de segurança:
--     • só admin chama;
--     • ninguém apaga a si mesmo;
--     • admin não apaga outro admin.
--   Se qualquer parte falhar, NADA é apagado — e o app recebe o erro.
--
-- Pode rodar mais de uma vez. Rode no Supabase: SQL Editor -> cole tudo -> Run.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1) As amarras (foreign keys) que apontam para `people`, `profiles` e o login
-- ────────────────────────────────────────────────────────────────────────────
-- Mesma regra do sql/45 (que já cuidou de auth.users):
--   coluna que pode ficar vazia  -> ON DELETE SET NULL (o conteúdo fica, só
--                                   esquece de quem era)
--   coluna obrigatória           -> ON DELETE CASCADE  (some junto)
--
-- Assim, apagar a pessoa limpa escalas, equipes, saúde, teatro, ranking… sem o
-- app precisar saber a lista de tabelas (as futuras entram sozinhas).
--
-- ATENÇÃO — dado órfão: o banco já tem linhas apontando para gente que não
-- existe mais (ex.: teams.leader_id de 9 equipes). O Postgres se recusa a criar
-- a amarra enquanto houver órfão. Então, antes de criar:
--   • coluna opcional   -> zera o ponteiro quebrado (SET NULL). Não some nada:
--                          na tela essas equipes JÁ apareciam sem líder.
--   • coluna obrigatória -> a linha inteira seria lixo, mas NÃO apagamos nada
--                          por conta própria: a amarra entra como NÃO VALIDADA
--                          (vale dali pra frente) e o script avisa no fim.

do $$
declare
  r record;
  n int;
  destino text;
begin
  for r in
    select
      con.conname                  as conname,
      con.conrelid::regclass::text as tbl,
      att.attname                  as col,
      att.attnotnull               as notnull,
      refns.nspname                as ref_schema,
      ref.relname                  as ref_tab
    from pg_constraint con
    join pg_class     ref   on ref.oid   = con.confrelid
    join pg_namespace refns on refns.oid = ref.relnamespace
    join pg_attribute att   on att.attrelid = con.conrelid
                           and att.attnum   = con.conkey[1]
    where con.contype = 'f'
      and (
        (refns.nspname = 'public' and ref.relname in ('people','profiles'))
        or (refns.nspname = 'auth' and ref.relname = 'users')
      )
      and array_length(con.conkey, 1) = 1     -- só FK de coluna única
      and con.confdeltype not in ('c','n')    -- ainda NÃO é cascade/set null
  loop
    destino := format('%I.%I(id)', r.ref_schema, r.ref_tab);

    if r.notnull then
      -- Obrigatória: não mexemos nos dados. Cria sem validar o passado.
      execute format('alter table %s drop constraint %I', r.tbl, r.conname);
      execute format('alter table %s add constraint %I foreign key (%I) references %s on delete cascade not valid',
                     r.tbl, r.conname, r.col, destino);
      -- Tenta validar; se houver órfão, deixa como está e segue.
      begin
        execute format('alter table %s validate constraint %I', r.tbl, r.conname);
      exception when others then
        raise notice 'ATENCAO: %.% tem linhas orfas — amarra % ficou NAO VALIDADA (vale so daqui pra frente).', r.tbl, r.col, r.conname;
      end;

    else
      -- Opcional: zera os ponteiros quebrados e cria a amarra validada.
      execute format(
        'update %s t set %I = null where t.%I is not null and not exists (select 1 from %I.%I x where x.id = t.%I)',
        r.tbl, r.col, r.col, r.ref_schema, r.ref_tab, r.col);
      get diagnostics n = row_count;
      if n > 0 then
        raise notice 'limpou % ponteiro(s) quebrado(s) em %.%', n, r.tbl, r.col;
      end if;

      execute format('alter table %s drop constraint %I', r.tbl, r.conname);
      execute format('alter table %s add constraint %I foreign key (%I) references %s on delete set null',
                     r.tbl, r.conname, r.col, destino);
    end if;

    raise notice 'ajustado: % em %(%) -> %', r.conname, r.tbl, r.col, destino;
  end loop;
end $$;


-- ────────────────────────────────────────────────────────────────────────────
-- 2) A função de exclusão
-- ────────────────────────────────────────────────────────────────────────────
-- Aceita o id da PESSOA (people.id) e/ou o id da CONTA (auth.users.id).
-- Devolve um resumo do que apagou. Levanta erro (que o app mostra) se não puder.

CREATE OR REPLACE FUNCTION public.excluir_conta_completa(
  p_person_id uuid DEFAULT NULL,
  p_user_id   uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_chamador   uuid := auth.uid();
  v_user       uuid := p_user_id;
  v_alvo_admin boolean;
  v_pessoas    int  := 0;
  v_n          int;
  v_email      text;
BEGIN
  IF v_chamador IS NULL THEN
    RAISE EXCEPTION 'Sem usuário logado.';
  END IF;
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem excluir contas.';
  END IF;

  -- Descobre a conta a partir da pessoa, se não veio
  IF v_user IS NULL AND p_person_id IS NOT NULL THEN
    SELECT user_id INTO v_user FROM public.people WHERE id = p_person_id;
  END IF;

  IF v_user IS NOT NULL THEN
    IF v_user = v_chamador THEN
      RAISE EXCEPTION 'Você não pode excluir a própria conta.';
    END IF;

    SELECT (COALESCE(is_admin, false) OR user_role IN ('admin','pastor'))
      INTO v_alvo_admin FROM public.profiles WHERE user_id = v_user;
    IF COALESCE(v_alvo_admin, false) THEN
      RAISE EXCEPTION 'Administradores não podem ser excluídos. Rebaixe o cargo antes.';
    END IF;

    SELECT email INTO v_email FROM auth.users WHERE id = v_user;
  END IF;

  -- 1) O cadastro da pessoa em TODOS os eventos (o cascade limpa o resto)
  IF v_user IS NOT NULL THEN
    DELETE FROM public.people WHERE user_id = v_user;
    GET DIAGNOSTICS v_pessoas = ROW_COUNT;
  END IF;

  -- 2) A pessoa avulsa (pré-cadastro, ainda sem login)
  IF p_person_id IS NOT NULL THEN
    DELETE FROM public.people WHERE id = p_person_id;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_pessoas := v_pessoas + v_n;
  END IF;

  -- 3) O perfil e o LOGIN — é isso que libera o email pra nova inscrição
  IF v_user IS NOT NULL THEN
    DELETE FROM public.profiles WHERE user_id = v_user;
    DELETE FROM auth.users      WHERE id      = v_user;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'pessoas_removidas', v_pessoas,
    'conta_removida', v_user IS NOT NULL,
    'email_liberado', v_email
  );
END;
$$;

REVOKE ALL ON FUNCTION public.excluir_conta_completa(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.excluir_conta_completa(uuid, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';


-- ────────────────────────────────────────────────────────────────────────────
-- 3) Relatório final
-- ────────────────────────────────────────────────────────────────────────────
-- Se aparecer alguma linha aqui, aquela tabela tem dado órfão de antes e a
-- amarra vale só daqui pra frente. Nada foi apagado. Me mostre o resultado.
-- Lista vazia = está tudo limpo.

select
  conrelid::regclass::text as tabela,
  conname                  as amarra,
  'tem linha orfa antiga'  as situacao
from pg_constraint
where contype = 'f' and not convalidated
order by 1, 2;
