-- ============================================================================
-- 98 — RLS por MÓDULO (o banco passa a seguir as mesmas liberações do app) — 2026-10-20
-- Idempotente (pode rodar de novo). Depende do sql/96 (is_approved nas escritas).
--
-- PROBLEMAS que ainda sobravam depois do 96:
--   1. LEITURA: quase toda tabela tinha "select = true" → uma conta PENDENTE (recém
--      criada, ainda não aprovada) lia todos os cadastros (CPF, RG, endereço), fichas
--      de saúde, remédios, financeiro, doações e até a tabela de permissões.
--   2. ESCRITA: qualquer APROVADO mexia em tudo pela API (financeiro, saúde, equipes,
--      cadastros, evento, menus, ministrações, teatro…), mesmo sem a liberação no app.
--      Entrar numa equipe (people_teams) dava as permissões daquela equipe.
--   3. AUTO-PROMOÇÃO: a pessoa criava/alterava o PRÓPRIO cadastro como 'worker'
--      (encontreiro) e ganhava as liberações fixas de encontreiro; também podia
--      marcar o próprio valor_pago, status, equipe…
--
-- REGRA NOVA:
--   • Pendente/recusado/bloqueado: só lê o que é DELE (perfil, cadastro, ficha de saúde,
--     remédios), o evento ativo e as configurações (tema/cadastro). Nada mais.
--   • Aprovado: lê como antes; MAS saúde/remédios, financeiro e doações só com a
--     liberação do módulo (a mesma do menu/tela no app).
--   • Escrita nas tabelas de risco exige a liberação "editar" do módulo (ou admin,
--     ou "Administração: editar", que é quem abre as telas /admin).
--   • Cadastro próprio: nasce encontrista; 'worker' só pra quem a liderança já aprovou
--     como encontreiro (igual ao Perfil) ou enquanto a conta está PENDENTE (o admin
--     confere o tipo na aprovação). Campos de controle (pago, status, equipe, evento)
--     não são alterados pela própria pessoa.
-- ============================================================================

-- ── 0. Funções de apoio ───────────────────────────────────────────────────────
-- is_admin / is_approved leem "profiles". Como a leitura de profiles agora depende
-- de is_approved(), elas precisam rodar como DONO (security definer) — senão a regra
-- chama a si mesma (recursão infinita). STABLE = calcula uma vez por consulta.
alter function public.is_admin()    security definer stable;
alter function public.is_approved() security definer stable;
alter function public.pode_editar_pessoas(uuid) set search_path to 'public';

-- pode_algum(['modulo:acao', ...]) — TRUE se o usuário tem QUALQUER uma das liberações.
-- Mesmo modelo do app (hooks/usePermissao.ts): admin tem tudo; senão soma
-- individual (qualquer cadastro desta conta) + equipe (membro/líder/co-líder no EVENTO
-- ATIVO) + tipo fixo (encontreiro/encontrista no EVENTO ATIVO). "editar" implica "ver".
-- NOVO: só vale para conta APROVADA (pendente não tem liberação nenhuma, como no app).
create or replace function public.pode_algum(p_perms text[])
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  with ev as (
    select id from public.events where status = 'active' order by created_at desc limit 1
  ),
  eu as (
    select pe.id, pe.role_type, pe.event_id from public.people pe where pe.user_id = auth.uid()
  ),
  eu_ev as (
    select * from eu where event_id = (select id from ev)
  ),
  minhas_equipes as (
    select pt.team_id from public.people_teams pt where pt.person_id in (select id from eu_ev)
    union
    select t.id from public.teams t
     where t.leader_id in (select id from eu_ev) or t.co_leader_id in (select id from eu_ev)
  ),
  meu_tipo as (
    select case role_type when 'worker' then 'encontreiro' when 'encounterer' then 'encontrista' end as r
      from eu_ev
  ),
  pedidos as (
    select split_part(x, ':', 1) as modulo, split_part(x, ':', 2) as acao from unnest(p_perms) x
  )
  select coalesce(public.is_admin(), false) or (
    public.is_approved() and exists (
      select 1
        from public.permissoes pm
        join pedidos pd on pd.modulo = pm.modulo
                       and (pm.acao = pd.acao or (pd.acao = 'ver' and pm.acao = 'editar'))
       where pm.permitido = true
         and (   pm.person_id in (select id from eu)
              or pm.team_id   in (select team_id from minhas_equipes)
              or pm.role      in (select r from meu_tipo where r is not null))
    )
  );
$function$;
revoke all on function public.pode_algum(text[]) from public, anon;
grant execute on function public.pode_algum(text[]) to authenticated, service_role;

-- tem_permissao (já usada em events, encontrista_adocao, definir_responsavel) passa a
-- usar a mesma lógica — e portanto também exige conta aprovada.
create or replace function public.tem_permissao(p_modulo text, p_acao text)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select public.pode_algum(array[p_modulo || ':' || p_acao]);
$function$;

-- Ids de TODOS os cadastros (1 por evento) da conta logada.
create or replace function public.meus_person_ids()
returns setof uuid
language sql
stable security definer
set search_path to 'public'
as $function$
  select id from public.people where user_id = auth.uid();
$function$;
revoke all on function public.meus_person_ids() from public, anon;
grant execute on function public.meus_person_ids() to authenticated, service_role;

-- ── 1. LEITURA genérica: "true" → só APROVADO ─────────────────────────────────
-- (as tabelas sensíveis e as que o Login/Pendente precisam são tratadas abaixo)
do $$
declare r record;
begin
  for r in
    select tablename, policyname from pg_policies
     where schemaname = 'public' and cmd = 'SELECT'
       and coalesce(qual, '') in ('true', '(auth.uid() IS NOT NULL)')
       and tablename not in ('configuracoes','events','people','profiles',
                             'saude_fichas','med_controlados','med_agenda','medications','medicamento_entregas',
                             'financeiro','doacoes')
  loop
    execute format('alter policy %I on public.%I to authenticated using ((select public.is_approved()))',
                   r.policyname, r.tablename);
  end loop;
end $$;

-- ── 2. ESCRITAS que o 96 deixou passar ("auth.uid() IS NOT NULL" sem o SELECT) ──
do $$
declare r record; cond text := '(select public.is_approved())';
begin
  for r in
    select tablename, policyname, cmd from pg_policies
     where schemaname = 'public' and cmd in ('INSERT','UPDATE','DELETE')
       and tablename <> 'audit_logs'
       and (coalesce(qual,'') = '(auth.uid() IS NOT NULL)' or coalesce(with_check,'') = '(auth.uid() IS NOT NULL)')
  loop
    if r.cmd = 'INSERT' then
      execute format('alter policy %I on public.%I with check (%s)', r.policyname, r.tablename, cond);
    elsif r.cmd = 'DELETE' then
      execute format('alter policy %I on public.%I using (%s)', r.policyname, r.tablename, cond);
    else
      execute format('alter policy %I on public.%I using (%s) with check (%s)', r.policyname, r.tablename, cond, cond);
    end if;
  end loop;
end $$;

-- Carrossel de fotos: a regra era "grupo = fotos" sem exigir login nem liberação.
alter policy home_write on public.home_midias to authenticated
  using      ((select public.is_admin()) or (grupo = 'fotos' and (select public.tem_permissao('carrossel_fotos','editar'))))
  with check ((select public.is_admin()) or (grupo = 'fotos' and (select public.tem_permissao('carrossel_fotos','editar'))));

-- ── 3. Perfis, eventos, configurações (o que o Login / tela Pendente usa) ──────
alter policy sel on public.profiles
  using ((select public.is_approved()) or user_id = (select auth.uid()));

alter policy sel on public.events
  using ((select public.is_approved()) or status = 'active');
alter policy upd on public.events
  using      ((select public.pode_algum(array['menu_admin:editar'])))
  with check ((select public.pode_algum(array['menu_admin:editar'])));

-- configuracoes: leitura continua pública (tema/logo/campos do cadastro aparecem no
-- Login antes de entrar). Escrita: admin ou "Administração: editar" (telas /admin).
drop policy if exists configuracoes_write_admin on public.configuracoes;
drop policy if exists config_write_admin on public.configuracoes;
drop policy if exists config_write on public.configuracoes;
create policy config_write on public.configuracoes for all to authenticated
  using      ((select public.pode_algum(array['menu_admin:editar'])))
  with check ((select public.pode_algum(array['menu_admin:editar'])));

alter policy ins on public.menu_config with check ((select public.pode_algum(array['menu_admin:editar'])));
alter policy upd on public.menu_config using ((select public.pode_algum(array['menu_admin:editar'])))
                                       with check ((select public.pode_algum(array['menu_admin:editar'])));
alter policy del on public.menu_config using ((select public.pode_algum(array['menu_admin:editar'])));

-- ── 4. Cadastros (people) ─────────────────────────────────────────────────────
-- Leitura: aprovado vê todos (como antes); pendente só o PRÓPRIO.
-- (+ cadastros com código de convite ainda não assumidos: o 1º acesso por código faz
--  UPDATE nessa linha e o Postgres exige enxergá-la. Sai quando o 1º acesso virar RPC.)
alter policy sel_auth on public.people
  using (   (select public.is_approved())
         or user_id = (select auth.uid())
         or (user_id is null and invite_code is not null));

-- Criar/alterar/apagar cadastro de OUTROS: só quem edita Cadastros/Encontristas
-- (ou Administração: editar). O próprio cadastro segue pelas regras *_self + gatilho.
alter policy ins on public.people
  with check ((select public.pode_algum(array['cadastros:editar','encontristas:editar','menu_admin:editar']))
              or public.pode_editar_pessoas(event_id));
alter policy upd on public.people
  using      ((select public.pode_algum(array['cadastros:editar','encontristas:editar','menu_admin:editar']))
              or public.pode_editar_pessoas(event_id))
  with check ((select public.pode_algum(array['cadastros:editar','encontristas:editar','menu_admin:editar']))
              or public.pode_editar_pessoas(event_id));
alter policy del on public.people
  using ((select public.pode_algum(array['cadastros:editar','encontristas:editar','menu_admin:editar']))
         or public.pode_editar_pessoas(event_id));

-- Gatilho: quem NÃO edita cadastros (inscrição, 1º acesso, Perfil) não se promove.
create or replace function public.trava_people_self()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_lider boolean;
begin
  -- servidor (service role / cron) ou quem edita cadastros: passa direto
  if auth.uid() is null then return new; end if;
  if public.pode_editar_pessoas(new.event_id)
     or public.pode_algum(array['cadastros:editar','encontristas:editar','menu_admin:editar']) then
    return new;
  end if;

  -- Campos de controle da liderança: a própria pessoa não define nem altera.
  if tg_op = 'INSERT' then
    new.valor_pago  := 0;
    new.valor_total := 0;
    new.desistente  := false;
    new.team_id     := null;
    new.invite_code := null;
    new.status      := 'inscrito';
  else
    new.valor_pago  := old.valor_pago;
    new.valor_total := old.valor_total;
    new.desistente  := old.desistente;
    new.team_id     := old.team_id;
    new.status      := old.status;
    new.event_id    := old.event_id;
  end if;

  -- Encontreiro ('worker'): só quem o admin já aprovou como encontreiro ou acima
  -- (mesma regra do Perfil: hasRole(user_role,'encontreiro')). Conta ainda PENDENTE
  -- pode se declarar encontreiro na inscrição — o admin confere ao aprovar.
  if new.role_type = 'worker' and (tg_op = 'INSERT' or old.role_type is distinct from 'worker') then
    select coalesce(bool_or(p.is_admin
                            or p.user_role like 'lider%'
                            or p.user_role = any(array['encontreiro','financeiro','secretaria','coordenador','pastor','admin'])), false)
      into v_lider
      from public.profiles p where p.user_id = auth.uid();
    if public.is_approved() and not v_lider then
      raise exception 'Só a liderança pode cadastrar você como encontreiro(a).' using errcode = '42501';
    end if;
  end if;
  return new;
end $function$;
revoke execute on function public.trava_people_self() from public, anon, authenticated;
drop trigger if exists trg_trava_people_self on public.people;
create trigger trg_trava_people_self before insert or update on public.people
  for each row execute function public.trava_people_self();

-- ── 5. Equipes (entrar numa equipe = ganhar as liberações dela) ───────────────
do $$
declare t text; c text := '(select public.pode_algum(array[''equipes:editar'',''menu_admin:editar'']))';
begin
  foreach t in array array['teams','people_teams'] loop
    execute format('alter policy ins on public.%I with check (%s)', t, c);
    execute format('alter policy upd on public.%I using (%s) with check (%s)', t, c, c);
    execute format('alter policy del on public.%I using (%s)', t, c);
  end loop;
end $$;

-- ── 6. Saúde e remédios ───────────────────────────────────────────────────────
-- Leitura: a própria pessoa OU quem trabalha com saúde. Quem lê (pelo código):
--   Saúde/Fichas/Medicamentos (menu_saude), Logística (gera relatório e abre a ficha
--   no check-in), Cozinha (restrição alimentar) e Painel (contagens).
-- Escrita: a própria pessoa OU Saúde/Medicamentos editar OU Logística checklist
--   (a ficha é editada no check-in da Logística) OU Administração: editar.
do $$
declare
  t text;
  dono  text := 'person_id in (select public.meus_person_ids())';
  ler   text := '(select public.pode_algum(array[''saude:ver'',''menu_saude:ver'',''medicamentos:ver'',''logistica:ver'',''logistica:checklist'',''menu_logistica:ver'',''cozinha:ver'',''menu_cozinha:ver'',''painel:ver'']))';
  ler_ag text := '(select public.pode_algum(array[''saude:ver'',''menu_saude:ver'',''medicamentos:ver'',''logistica:ver'',''logistica:checklist'',''menu_logistica:ver'',''painel:ver'']))';
  esc   text := '(select public.pode_algum(array[''saude:editar'',''medicamentos:editar'',''logistica:checklist'',''menu_admin:editar'']))';
begin
  foreach t in array array['saude_fichas','med_controlados','med_agenda'] loop
    execute format('alter policy sel on public.%I using (%s or %s)', t, dono, case when t = 'med_agenda' then ler_ag else ler end);
    execute format('alter policy ins on public.%I with check (%s or %s)', t, dono, esc);
    execute format('alter policy upd on public.%I using (%s or %s) with check (%s or %s)', t, dono, esc, dono, esc);
    execute format('alter policy del on public.%I using (%s or %s)', t, dono, esc);
  end loop;
end $$;

-- Atendimentos da Saúde (medications) e entregas de remédio
alter policy sel on public.medications using ((select public.pode_algum(array['saude:ver','menu_saude:ver'])));
alter policy ins on public.medications with check ((select public.pode_algum(array['saude:editar','menu_admin:editar'])));
alter policy upd on public.medications using ((select public.pode_algum(array['saude:editar','menu_admin:editar'])))
                                       with check ((select public.pode_algum(array['saude:editar','menu_admin:editar'])));
alter policy del on public.medications using ((select public.pode_algum(array['saude:editar','menu_admin:editar'])));

alter policy sel on public.medicamento_entregas using ((select public.pode_algum(array['saude:ver','menu_saude:ver','medicamentos:ver'])));
alter policy ins on public.medicamento_entregas with check ((select public.pode_algum(array['saude:editar','medicamentos:editar'])));
alter policy upd on public.medicamento_entregas using ((select public.pode_algum(array['saude:editar','medicamentos:editar'])))
                                                with check ((select public.pode_algum(array['saude:editar','medicamentos:editar'])));

-- ── 7. Financeiro e Doações ───────────────────────────────────────────────────
-- Leitura: Financeiro/Doações (menu_financeiro), Painel e Relatórios (/relatorios abre
-- com menu_admin). Escrita: "Registrar pagamento"/"Registrar" (editar) ou
-- Administração: editar (restaurar backup em /admin).
alter policy sel on public.financeiro
  using ((select public.pode_algum(array['financeiro:ver','menu_financeiro:ver','painel:ver','relatorios:ver','menu_admin:ver'])));
alter policy ins on public.financeiro with check ((select public.pode_algum(array['financeiro:editar','menu_admin:editar'])));
alter policy upd on public.financeiro using ((select public.pode_algum(array['financeiro:editar','menu_admin:editar'])))
                                      with check ((select public.pode_algum(array['financeiro:editar','menu_admin:editar'])));
alter policy del on public.financeiro using ((select public.pode_algum(array['financeiro:editar','menu_admin:editar'])));

alter policy sel on public.doacoes
  using ((select public.pode_algum(array['doacoes:ver','menu_financeiro:ver','painel:ver','relatorios:ver','menu_admin:ver'])));
alter policy ins on public.doacoes with check ((select public.pode_algum(array['doacoes:editar','menu_admin:editar'])));
alter policy upd on public.doacoes using ((select public.pode_algum(array['doacoes:editar','menu_admin:editar'])))
                                   with check ((select public.pode_algum(array['doacoes:editar','menu_admin:editar'])));
alter policy del on public.doacoes using ((select public.pode_algum(array['doacoes:editar','menu_admin:editar'])));

-- ── 8. Conteúdo com HTML / cadastros-base do evento ───────────────────────────
-- Ministrações: criar/apagar = Ministrações editar. Alterar = isso OU o PRÓPRIO
-- ministrante (edita a dele) OU quem controla o cronograma/cronômetro (marca
-- concluído) OU Teatro editar (desvincula teatro).
alter policy ins on public."ministrações"
  with check ((select public.pode_algum(array['ministracoes:editar','menu_admin:editar'])));
alter policy upd on public."ministrações"
  using      ((select public.pode_algum(array['ministracoes:editar','cronograma:editar','cronograma_inteligente:ver','teatro:editar','menu_admin:editar']))
              or ministrante_id in (select public.meus_person_ids()))
  with check ((select public.pode_algum(array['ministracoes:editar','cronograma:editar','cronograma_inteligente:ver','teatro:editar','menu_admin:editar']))
              or ministrante_id in (select public.meus_person_ids()));
alter policy del on public."ministrações"
  using ((select public.pode_algum(array['ministracoes:editar','menu_admin:editar'])));

-- Cenas do teatro (roteiro em HTML): Teatro editar.
alter policy ins on public.teatro_cenas with check ((select public.pode_algum(array['teatro:editar','menu_admin:editar'])));
alter policy upd on public.teatro_cenas using ((select public.pode_algum(array['teatro:editar','menu_admin:editar'])))
                                        with check ((select public.pode_algum(array['teatro:editar','menu_admin:editar'])));
alter policy del on public.teatro_cenas using ((select public.pode_algum(array['teatro:editar','menu_admin:editar'])));

-- Locais: Locais editar (ou Admin, que cria os locais padrão de um evento novo).
alter policy ins on public.locais with check ((select public.pode_algum(array['locais:editar','menu_admin:editar'])));
alter policy upd on public.locais using ((select public.pode_algum(array['locais:editar','menu_admin:editar'])))
                                  with check ((select public.pode_algum(array['locais:editar','menu_admin:editar'])));
alter policy del on public.locais using ((select public.pode_algum(array['locais:editar','menu_admin:editar'])));

-- Tipos de atividade do cronograma (só a Administração cria/edita).
alter policy ins on public.cronograma_tipos with check ((select public.pode_algum(array['menu_admin:editar','cronograma:editar'])));
alter policy upd on public.cronograma_tipos using ((select public.pode_algum(array['menu_admin:editar','cronograma:editar'])))
                                            with check ((select public.pode_algum(array['menu_admin:editar','cronograma:editar'])));
alter policy del on public.cronograma_tipos using ((select public.pode_algum(array['menu_admin:editar','cronograma:editar'])));

-- (permissoes: escrita já era só admin — permissoes_insert/update/delete_admin.
--  A leitura, que era pública até para visitante sem login, caiu no passo 1.)
