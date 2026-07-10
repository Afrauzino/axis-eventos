-- ============================================================
-- 59_meu_cadastro.sql
-- Deixa CADA usuário editar o PRÓPRIO cadastro (dados pessoais) mesmo sem
-- permissão de admin. Roda com permissão do dono (SECURITY DEFINER) e só
-- mexe na linha do próprio usuário logado.
--
-- SEGURANÇA: NÃO altera papel/permissão/aprovação (role_type, user_role,
-- role_status, status, referencia_id, invite_code, is_admin). Isso continua
-- só com o admin.
--
-- Rodar inteiro no SQL Editor do Supabase. Pode rodar mais de uma vez.
-- ============================================================

CREATE OR REPLACE FUNCTION public.atualizar_meu_cadastro(p jsonb)
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

  UPDATE public.people SET
    name            = COALESCE(NULLIF(p->>'name',''), name),
    phone           = COALESCE(p->>'phone', phone),
    contact_phone   = NULLIF(p->>'contact_phone',''),
    church          = COALESCE(p->>'church', church),
    ano_encontro    = NULLIF(p->>'ano_encontro','')::int,
    sexo            = NULLIF(p->>'sexo',''),
    birth_date      = NULLIF(p->>'birth_date','')::date,
    cpf             = NULLIF(p->>'cpf',''),
    rg              = NULLIF(p->>'rg',''),
    cidade          = NULLIF(p->>'cidade',''),
    estado          = NULLIF(p->>'estado',''),
    endereco        = NULLIF(p->>'endereco',''),
    bairro          = NULLIF(p->>'bairro',''),
    cep             = NULLIF(p->>'cep',''),
    notes           = NULLIF(p->>'notes',''),
    photo_url       = COALESCE(p->>'photo_url', photo_url)
  WHERE user_id = uid;

  -- Espelha na conta (profiles) o que aparece em outras telas
  UPDATE public.profiles SET
    name       = COALESCE(NULLIF(p->>'name',''), name),
    phone      = COALESCE(p->>'phone', phone),
    church     = COALESCE(p->>'church', church),
    avatar_url = COALESCE(p->>'photo_url', avatar_url)
  WHERE user_id = uid;
END;
$$;

REVOKE ALL ON FUNCTION public.atualizar_meu_cadastro(jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.atualizar_meu_cadastro(jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
