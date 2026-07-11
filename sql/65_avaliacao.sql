-- ============================================================
-- 65_avaliacao.sql
-- Avaliação pós-evento dos ENCONTRISTAS. Admin libera por evento; o encontrista
-- responde 1x; só admin vê as respostas (confidencial).
-- Rodar inteiro no SQL Editor do Supabase. Pode rodar mais de uma vez.
-- ============================================================

-- Liberação por evento
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS avaliacao_liberada boolean DEFAULT false;

-- Respostas (1 por pessoa/evento)
CREATE TABLE IF NOT EXISTS public.avaliacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nota_recepcao    int,
  nota_alimentacao int,
  nota_organizacao int,
  nota_alojamento  int,
  nota_equipe      int,
  nota_geral       int,
  marcou   text,
  melhorar text,
  servir       boolean,
  pos_encontro boolean,
  created_at timestamptz DEFAULT now(),
  UNIQUE (event_id, user_id)
);

ALTER TABLE public.avaliacoes ENABLE ROW LEVEL SECURITY;

-- Dono: insere / edita / vê a PRÓPRIA resposta
DROP POLICY IF EXISTS "aval_own" ON public.avaliacoes;
CREATE POLICY "aval_own" ON public.avaliacoes FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admin: vê TODAS (confidencial — só admin)
DROP POLICY IF EXISTS "aval_admin_select" ON public.avaliacoes;
CREATE POLICY "aval_admin_select" ON public.avaliacoes FOR SELECT TO authenticated
  USING (is_admin());

NOTIFY pgrst, 'reload schema';
