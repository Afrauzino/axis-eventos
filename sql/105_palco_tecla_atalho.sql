-- ============================================================================
-- 105 — PALCO ↔ MESA: TECLA DE ATALHO CONFIGURÁVEL POR BOTÃO — 2026-11-23
-- Idempotente. Depende do 100–104.
--
-- Cada botão pode ter a SUA tecla (teclado do PC ou pedal USB/Bluetooth), ex.:
-- "1" = +Mic, "f1" = Back, "q" = Técnico. Guardada como KeyboardEvent.key em
-- minúsculas ("1", "a", "f1", "arrowup", " "). Vazio = tecla automática pela
-- posição (1–9, 0 = 10, A–L = 1–12).
-- ============================================================================

alter table public.palco_botoes add column if not exists tecla text;
alter table public.palco_botoes drop constraint if exists palco_botoes_tecla_chk;
alter table public.palco_botoes add constraint palco_botoes_tecla_chk check (tecla is null or char_length(tecla) between 1 and 20);

-- botões pro palco agora levam a tecla
create or replace function public.palco__botoes_json(p_canal uuid)
returns jsonb language sql stable security definer set search_path to 'public'
as $function$
  select coalesce(jsonb_agg(jsonb_build_object('posicao', b.posicao, 'nome', b.nome, 'mensagem', b.mensagem,
                                               'cor', b.cor, 'etapas', b.etapas, 'tecla', b.tecla) order by b.posicao), '[]'::jsonb)
    from public.palco_botoes b where b.canal_id = p_canal and b.pedal_id is null and b.ativo;
$function$;
create or replace function public.palco__botoes_json(p_canal uuid, p_pedal uuid)
returns jsonb language sql stable security definer set search_path to 'public'
as $function$
  select coalesce(jsonb_agg(jsonb_build_object('posicao', b.posicao, 'nome', b.nome, 'mensagem', b.mensagem,
                                               'cor', b.cor, 'etapas', b.etapas, 'tecla', b.tecla) order by b.posicao), '[]'::jsonb)
    from public.palco__botoes_do_pedal(p_canal, p_pedal) b where b.ativo;
$function$;
revoke all on function public.palco__botoes_json(uuid) from public, anon, authenticated;
revoke all on function public.palco__botoes_json(uuid, uuid) from public, anon, authenticated;

create or replace function public.palco_mesa_config(p_token text)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_canal uuid := public.palco__canal_operador(p_token);
begin
  if v_canal is null then return null; end if;
  return jsonb_build_object(
    'canal', (select jsonb_build_object('nome', c.nome, 'recados_mesa', c.recados_mesa) from public.palco_canais c where c.id = v_canal),
    'botoes', coalesce((select jsonb_agg(jsonb_build_object('posicao', b.posicao, 'nome', b.nome, 'mensagem', b.mensagem,
                                         'cor', b.cor, 'ativo', b.ativo, 'etapas', b.etapas, 'tecla', b.tecla) order by b.posicao)
                          from public.palco_botoes b where b.canal_id = v_canal and b.pedal_id is null), '[]'::jsonb),
    'pedais', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.nome, 'ativo', p.ativo, 'token', p.token,
                                         'botoes_proprios', p.botoes_proprios,
                                         'botoes', coalesce((select jsonb_agg(jsonb_build_object('posicao', b.posicao, 'nome', b.nome, 'mensagem', b.mensagem,
                                                               'cor', b.cor, 'ativo', b.ativo, 'etapas', b.etapas, 'tecla', b.tecla) order by b.posicao)
                                                             from public.palco_botoes b where b.pedal_id = p.id), '[]'::jsonb),
                                         'online', coalesce(p.visto_em > now() - interval '45 seconds', false)) order by p.created_at)
                          from public.palco_pedais p where p.canal_id = v_canal), '[]'::jsonb)
  );
end;
$function$;

drop function if exists public.palco_mesa_salvar_botao(text, integer, text, text, text, boolean, jsonb, uuid);
create or replace function public.palco_mesa_salvar_botao(
  p_token text, p_posicao integer, p_nome text, p_mensagem text, p_cor text, p_ativo boolean,
  p_etapas jsonb default '[]'::jsonb, p_pedal uuid default null, p_tecla text default null)
returns boolean language plpgsql security definer set search_path to 'public'
as $function$
declare v_canal uuid := public.palco__canal_operador(p_token); v_tecla text := nullif(lower(p_tecla), '');
begin
  if v_canal is null then raise exception 'mesa_invalida'; end if;
  if p_posicao is null or p_posicao not between 1 and 12 then raise exception 'posicao_invalida'; end if;
  if p_pedal is null then
    insert into public.palco_botoes (canal_id, posicao, nome, mensagem, cor, ativo, etapas, tecla)
    values (v_canal, p_posicao, btrim(p_nome), btrim(coalesce(p_mensagem, '')), p_cor, coalesce(p_ativo, true), coalesce(p_etapas, '[]'::jsonb), v_tecla)
    on conflict (canal_id, posicao) where pedal_id is null do update
       set nome = excluded.nome, mensagem = excluded.mensagem, cor = excluded.cor, ativo = excluded.ativo,
           etapas = excluded.etapas, tecla = excluded.tecla;
  else
    if not exists (select 1 from public.palco_pedais where id = p_pedal and canal_id = v_canal and botoes_proprios) then
      raise exception 'pedal_sem_botoes_proprios';
    end if;
    insert into public.palco_botoes (canal_id, pedal_id, posicao, nome, mensagem, cor, ativo, etapas, tecla)
    values (v_canal, p_pedal, p_posicao, btrim(p_nome), btrim(coalesce(p_mensagem, '')), p_cor, coalesce(p_ativo, true), coalesce(p_etapas, '[]'::jsonb), v_tecla)
    on conflict (pedal_id, posicao) where pedal_id is not null do update
       set nome = excluded.nome, mensagem = excluded.mensagem, cor = excluded.cor, ativo = excluded.ativo,
           etapas = excluded.etapas, tecla = excluded.tecla;
  end if;
  return true;
end;
$function$;
revoke all on function public.palco_mesa_salvar_botao(text, integer, text, text, text, boolean, jsonb, uuid, text) from public;
grant execute on function public.palco_mesa_salvar_botao(text, integer, text, text, text, boolean, jsonb, uuid, text) to anon, authenticated;

-- botões próprios copiam também a tecla
create or replace function public.palco_mesa_pedal(p_token text, p_acao text, p_id uuid default null, p_nome text default null)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_canal uuid := public.palco__canal_operador(p_token);
  v_qtd integer;
  v_ped public.palco_pedais;
begin
  if v_canal is null then raise exception 'mesa_invalida'; end if;
  if p_acao = 'criar' then
    select count(*) into v_qtd from public.palco_pedais where canal_id = v_canal;
    if v_qtd >= 30 then raise exception 'limite_pedais'; end if;
    insert into public.palco_pedais (canal_id, nome) values (v_canal, btrim(coalesce(p_nome, ''))) returning * into v_ped;
    return jsonb_build_object('id', v_ped.id, 'token', v_ped.token);
  end if;
  if p_id is null or not exists (select 1 from public.palco_pedais where id = p_id and canal_id = v_canal) then
    raise exception 'pedal_invalido';
  end if;
  if p_acao = 'renomear' then
    update public.palco_pedais set nome = btrim(coalesce(p_nome, '')) where id = p_id;
  elsif p_acao = 'ativar' then
    update public.palco_pedais set ativo = true where id = p_id;
  elsif p_acao = 'desativar' then
    update public.palco_pedais set ativo = false where id = p_id;
  elsif p_acao = 'excluir' then
    delete from public.palco_pedais where id = p_id;
  elsif p_acao = 'novo_link' then
    update public.palco_pedais set token = replace(gen_random_uuid()::text, '-', '') where id = p_id returning * into v_ped;
    return jsonb_build_object('id', v_ped.id, 'token', v_ped.token);
  elsif p_acao = 'botoes_proprios' then
    insert into public.palco_botoes (canal_id, pedal_id, posicao, nome, mensagem, cor, ativo, etapas, tecla)
    select v_canal, p_id, b.posicao, b.nome, b.mensagem, b.cor, b.ativo, b.etapas, b.tecla
      from public.palco_botoes b where b.canal_id = v_canal and b.pedal_id is null
    on conflict (pedal_id, posicao) where pedal_id is not null do nothing;
    update public.palco_pedais set botoes_proprios = true where id = p_id;
  elsif p_acao = 'botoes_padrao' then
    update public.palco_pedais set botoes_proprios = false where id = p_id;
    delete from public.palco_botoes where pedal_id = p_id;
  else
    raise exception 'acao_invalida';
  end if;
  return jsonb_build_object('id', p_id);
end;
$function$;
grant execute on function public.palco_mesa_pedal(text, text, uuid, text) to anon, authenticated;
grant execute on function public.palco_mesa_config(text) to anon, authenticated;
