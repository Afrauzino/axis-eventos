-- ============================================================================
-- 61_unificar_pessoas.sql — Unificar dois cadastros duplicados
-- ----------------------------------------------------------------------------
-- O admin identifica que duas pessoas (ex.: "Renato José" pré-cadastro e
-- "Renato Silva" inscrição) são a MESMA. Esta função funde as duas:
--   • MANTÉM p_manter (nome, foto, dados e login dele prevalecem).
--   • MIGRA pra ele TUDO do p_remover: equipes, escalas, teatro/elenco,
--     ministração, liberações, saúde, remédios, doações, referências…
--   • APAGA o p_remover por completo (cadastro + login → libera email/código).
--
-- Roda tudo numa transação: se algo falhar, NADA é alterado.
-- Só admin. Rode no Supabase (SQL Editor). Pode rodar de novo sem problema.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.unificar_pessoas(p_manter uuid, p_remover uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_remover uuid;
  v_email text;
  r record;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Apenas administradores podem unificar contas.'; END IF;
  IF p_manter IS NULL OR p_remover IS NULL OR p_manter = p_remover THEN
    RAISE EXCEPTION 'Escolha duas pessoas diferentes.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM people WHERE id = p_manter) OR NOT EXISTS (SELECT 1 FROM people WHERE id = p_remover) THEN
    RAISE EXCEPTION 'Cadastro não encontrado.';
  END IF;

  -- Login do removido (pra apagar no fim e liberar o email)
  SELECT user_id INTO v_user_remover FROM people WHERE id = p_remover;
  IF v_user_remover IS NOT NULL THEN SELECT email INTO v_email FROM auth.users WHERE id = v_user_remover; END IF;

  -- ── Tabelas com regra de unicidade: apaga a duplicata do removido, move o resto ──
  DELETE FROM people_teams a WHERE a.person_id = p_remover
    AND EXISTS (SELECT 1 FROM people_teams b WHERE b.person_id = p_manter AND b.team_id = a.team_id);
  UPDATE people_teams SET person_id = p_manter WHERE person_id = p_remover;

  DELETE FROM teatro_elenco a WHERE a.person_id = p_remover
    AND EXISTS (SELECT 1 FROM teatro_elenco b WHERE b.person_id = p_manter AND b.theater_id = a.theater_id
                AND COALESCE(b.personagem_id::text,'') = COALESCE(a.personagem_id::text,''));
  UPDATE teatro_elenco SET person_id = p_manter WHERE person_id = p_remover;

  -- Ficha de saúde: a do que prevalece manda; só migra se ele ainda não tiver
  DELETE FROM saude_fichas WHERE person_id = p_remover
    AND EXISTS (SELECT 1 FROM saude_fichas b WHERE b.person_id = p_manter);
  UPDATE saude_fichas SET person_id = p_manter WHERE person_id = p_remover;

  -- Liberações individuais: une (tira as repetidas do removido)
  BEGIN
    DELETE FROM permissoes a WHERE a.person_id = p_remover
      AND EXISTS (SELECT 1 FROM permissoes b WHERE b.person_id = p_manter AND b.modulo = a.modulo AND b.acao = a.acao);
    UPDATE permissoes SET person_id = p_manter WHERE person_id = p_remover;
  EXCEPTION WHEN undefined_table THEN NULL; END;

  -- ── Referências (quem conhece quem) ──
  BEGIN UPDATE people SET referencia_id = p_manter WHERE referencia_id = p_remover; EXCEPTION WHEN undefined_column THEN NULL; END;
  BEGIN UPDATE saude_fichas SET conhecido_por_id = p_manter WHERE conhecido_por_id = p_remover; EXCEPTION WHEN undefined_column THEN NULL; END;

  -- ── Tabelas simples (move direto). Cada uma protegida caso não exista ──
  BEGIN UPDATE escalas SET person_id = p_manter WHERE person_id = p_remover; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN UPDATE ranking_votos SET votado_id = p_manter WHERE votado_id = p_remover; EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;
  BEGIN UPDATE "ministrações" SET ministrante_id = p_manter WHERE ministrante_id = p_remover; EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;
  BEGIN UPDATE teams SET leader_id = p_manter WHERE leader_id = p_remover; EXCEPTION WHEN undefined_column THEN NULL; END;
  BEGIN UPDATE teams SET co_leader_id = p_manter WHERE co_leader_id = p_remover; EXCEPTION WHEN undefined_column THEN NULL; END;
  BEGIN UPDATE financeiro SET person_id = p_manter WHERE person_id = p_remover; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN UPDATE doacoes SET person_id = p_manter WHERE person_id = p_remover; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN UPDATE med_agenda SET person_id = p_manter WHERE person_id = p_remover; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN UPDATE med_controlados SET person_id = p_manter WHERE person_id = p_remover; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN UPDATE medicamento_entregas SET person_id = p_manter WHERE person_id = p_remover; EXCEPTION WHEN undefined_table THEN NULL; END;

  -- ── Rede: qualquer OUTRA amarra pra people(id) que não foi tratada acima ──
  FOR r IN
    SELECT con.conrelid::regclass::text AS tbl, att.attname AS col
    FROM pg_constraint con
    JOIN pg_class ref ON ref.oid = con.confrelid
    JOIN pg_namespace n ON n.oid = ref.relnamespace
    JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
    WHERE con.contype = 'f' AND n.nspname = 'public' AND ref.relname = 'people'
      AND con.conrelid::regclass::text NOT IN ('people_teams','teatro_elenco','saude_fichas','permissoes')
  LOOP
    EXECUTE format('UPDATE %s SET %I = $1 WHERE %I = $2', r.tbl, r.col, r.col) USING p_manter, p_remover;
  END LOOP;

  -- Evita o que prevalece apontar pra si mesmo
  BEGIN UPDATE people SET referencia_id = NULL WHERE id = p_manter AND referencia_id = p_manter; EXCEPTION WHEN undefined_column THEN NULL; END;

  -- ── Apaga o removido por completo ──
  DELETE FROM people WHERE id = p_remover;
  IF v_user_remover IS NOT NULL THEN
    DELETE FROM profiles WHERE user_id = v_user_remover;
    DELETE FROM auth.users WHERE id = v_user_remover;
  END IF;

  RETURN jsonb_build_object('ok', true, 'email_liberado', v_email);
END;
$$;

REVOKE ALL ON FUNCTION public.unificar_pessoas(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.unificar_pessoas(uuid, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
