-- ============================================================
-- 50_alertas_mural_foto.sql
--
-- 1) ALERTAS: admin pode mandar só para Encontreiros ou só para Encontristas
-- 2) MURAL: admin pode apagar post/comentário de qualquer pessoa
-- 3) FOTO DE PERFIL: ao trocar, propaga na hora para tudo que a pessoa
--    está relacionada (people, posts e comentários do mural)
--
-- Rodar inteiro no SQL Editor do Supabase. Pode rodar mais de uma vez.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1) ALERTAS — novo destino: 'worker' (encontreiros) e 'encounterer' (encontristas)
-- ────────────────────────────────────────────────────────────

-- O CHECK antigo só aceitava 'all', 'team' e 'multiple'.
-- Removemos QUALQUER check de target_type (o nome pode variar de banco pra banco),
-- senão sobraria uma regra velha barrando 'worker'/'encounterer'.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class t ON t.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND t.relname = 'alerts' AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%target_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.alerts DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.alerts ADD CONSTRAINT alerts_target_type_check
  CHECK (target_type IN ('all', 'team', 'multiple', 'worker', 'encounterer'));

-- Quem enxerga o alerta. Acrescenta a regra por tipo de pessoa:
-- o alerta com target_type = 'worker' aparece só para quem tem
-- people.role_type = 'worker' naquele evento (idem 'encounterer').
--
-- OBS: nem todo banco tem a função has_permission(text,text,uuid).
-- Só incluímos essa linha na política se a função realmente existir.
DO $$
DECLARE
  tem_has_permission boolean;
  linha_permissao    text := '';
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'has_permission'
  ) INTO tem_has_permission;

  IF tem_has_permission THEN
    linha_permissao := 'OR has_permission(''alerts'', ''view'', event_id)';
  END IF;

  DROP POLICY IF EXISTS alerts_select_approved ON public.alerts;

  EXECUTE format($f$
    CREATE POLICY "alerts_select_approved" ON public.alerts
      FOR SELECT USING (
        is_approved()
        AND (
          target_type = 'all'
          OR is_admin()
          %s

          -- Por tipo de pessoa: encontreiro (worker) ou encontrista (encounterer)
          OR EXISTS (
            SELECT 1 FROM public.people p
            WHERE p.user_id   = auth.uid()
              AND p.event_id  = alerts.event_id
              AND p.role_type = alerts.target_type
          )

          -- Por equipe (regra antiga, intacta)
          OR EXISTS (
            SELECT 1 FROM public.people p
            WHERE p.user_id  = auth.uid()
              AND p.event_id = alerts.event_id
              AND p.team_id  = ANY(alerts.target_team_ids)
          )
        )
      )
  $f$, linha_permissao);
END $$;


-- ────────────────────────────────────────────────────────────
-- 2) MURAL — admin apaga de qualquer pessoa
-- ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "mural_del" ON public.mural_posts;
CREATE POLICY "mural_del" ON public.mural_posts
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR is_admin());

DROP POLICY IF EXISTS "mcom_del" ON public.mural_comentarios;
CREATE POLICY "mcom_del" ON public.mural_comentarios
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR is_admin());

-- Curtidas somem junto com o post (ON DELETE CASCADE já existe),
-- mas o admin também pode tirar curtida solta de post apagado à mão.
DROP POLICY IF EXISTS "mcurt_del" ON public.mural_curtidas;
CREATE POLICY "mcurt_del" ON public.mural_curtidas
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR is_admin());


-- ────────────────────────────────────────────────────────────
-- 3) FOTO / NOME — propagação imediata
-- ────────────────────────────────────────────────────────────
-- A pessoa comum NÃO pode dar UPDATE em `people` (política people_update_permitted
-- exige admin ou permissão). Por isso a foto do perfil nunca chegava em
-- people.photo_url, e as telas (Equipes, Escalas, Crachá, Impressão…) seguiam
-- mostrando a foto velha.
--
-- Em vez de afrouxar a política, esta função roda com permissão do dono
-- (SECURITY DEFINER) e só mexe nas linhas do PRÓPRIO usuário logado.

CREATE OR REPLACE FUNCTION public.sincronizar_meu_perfil(p_foto text DEFAULT NULL, p_nome text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Sem usuário logado';
  END IF;

  -- Cadastro da pessoa em TODOS os eventos em que ela participa
  UPDATE public.people
     SET photo_url = COALESCE(p_foto, photo_url),
         name      = COALESCE(p_nome, name)
   WHERE user_id = uid;

  -- Cópias "congeladas" no mural (o post guarda nome e foto do autor)
  UPDATE public.mural_posts
     SET autor_foto = COALESCE(p_foto, autor_foto),
         autor_nome = COALESCE(p_nome, autor_nome)
   WHERE user_id = uid;

  UPDATE public.mural_comentarios
     SET autor_foto = COALESCE(p_foto, autor_foto),
         autor_nome = COALESCE(p_nome, autor_nome)
   WHERE user_id = uid;
END;
$$;

REVOKE ALL ON FUNCTION public.sincronizar_meu_perfil(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.sincronizar_meu_perfil(text, text) TO authenticated;


-- Realtime: para as telas abertas perceberem a troca de foto na hora.
-- REPLICA IDENTITY FULL faz o Supabase mandar também os valores ANTIGOS,
-- assim o app só recarrega quando a FOTO mudou (e não a cada salvamento).
ALTER TABLE public.people    REPLICA IDENTITY FULL;
ALTER TABLE public.profiles  REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'people'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.people;
  END IF;
END $$;


-- Faz o Supabase enxergar a função nova na hora (sem esperar o cache).
NOTIFY pgrst, 'reload schema';
