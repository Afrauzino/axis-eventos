-- ============================================================================
-- 104 — PALCO ↔ MESA: BOTÕES DIFERENTES POR PEDAL (por pessoa) — 2026-11-23
-- Idempotente. Depende do 100–103.
--
-- Cada pedal usa os botões PADRÃO do palco ou tem os SEUS botões (ex.: baterista
-- com "+Click/+Baixo", vocal com "+Mic/+Playback"). Ao ativar "botões próprios" o
-- pedal recebe uma CÓPIA dos botões padrão pra editar. "Voltar ao padrão" apaga a
-- cópia. O histórico de recados não muda (cada chamado guarda nome/recado/cor).
--
-- Tabela: palco_botoes.pedal_id NULL = botão padrão do palco; preenchido = botão
-- próprio daquele pedal. Unicidade: 1 botão por posição no padrão e por pedal.
-- ============================================================================

alter table public.palco_botoes add column if not exists pedal_id uuid references public.palco_pedais(id) on delete cascade;
alter table public.palco_pedais add column if not exists botoes_proprios boolean not null default false;

alter table public.palco_botoes drop constraint if exists palco_botoes_canal_id_posicao_key;
create unique index if not exists palco_botoes_padrao_uk on public.palco_botoes(canal_id, posicao) where pedal_id is null;
create unique index if not exists palco_botoes_pedal_uk  on public.palco_botoes(pedal_id, posicao) where pedal_id is not null;

-- botões padrão ao criar um palco (conflito agora usa o índice parcial do padrão)
create or replace function public.palco_canal_padrao()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
begin
  insert into public.palco_botoes (canal_id, posicao, nome, mensagem, cor) values
    (new.id, 1, '+Mic',        'Aumenta o microfone no retorno',     '#2F855A'),
    (new.id, 2, '+Playback',   'Falta playback no retorno',          '#2B6CB0'),
    (new.id, 3, '−Back',       'Back vocal muito alto no retorno',   '#D69E2E'),
    (new.id, 4, '−Instrumento','Instrumento muito alto no retorno',  '#E8821A'),
    (new.id, 5, 'Mic falhando','Microfone falhando / sem som',       '#C53030'),
    (new.id, 6, 'Técnico',     'Preciso do técnico no palco',        '#6B46C1')
  on conflict (canal_id, posicao) where pedal_id is null do nothing;
  insert into public.palco_pedais (canal_id, nome) values (new.id, 'Pedal 1');
  return new;
end;
$function$;
revoke all on function public.palco_canal_padrao() from public, anon, authenticated;

-- botões que UM pedal enxerga (próprios ou padrão). p_pedal null = padrão.
create or replace function public.palco__botoes_do_pedal(p_canal uuid, p_pedal uuid)
returns setof public.palco_botoes language sql stable security definer set search_path to 'public'
as $function$
  select b.* from public.palco_botoes b
   where b.canal_id = p_canal
     and case when exists (select 1 from public.palco_pedais p where p.id = p_pedal and p.canal_id = p_canal and p.botoes_proprios)
              then b.pedal_id = p_pedal
              else b.pedal_id is null end;
$function$;
revoke all on function public.palco__botoes_do_pedal(uuid, uuid) from public, anon, authenticated;

-- (assinatura antiga só por canal continua existindo = botões padrão)
create or replace function public.palco__botoes_json(p_canal uuid)
returns jsonb language sql stable security definer set search_path to 'public'
as $function$
  select coalesce(jsonb_agg(jsonb_build_object('posicao', b.posicao, 'nome', b.nome, 'mensagem', b.mensagem,
                                               'cor', b.cor, 'etapas', b.etapas) order by b.posicao), '[]'::jsonb)
    from public.palco_botoes b where b.canal_id = p_canal and b.pedal_id is null and b.ativo;
$function$;

create or replace function public.palco__botoes_json(p_canal uuid, p_pedal uuid)
returns jsonb language sql stable security definer set search_path to 'public'
as $function$
  select coalesce(jsonb_agg(jsonb_build_object('posicao', b.posicao, 'nome', b.nome, 'mensagem', b.mensagem,
                                               'cor', b.cor, 'etapas', b.etapas) order by b.posicao), '[]'::jsonb)
    from public.palco__botoes_do_pedal(p_canal, p_pedal) b where b.ativo;
$function$;
revoke all on function public.palco__botoes_json(uuid) from public, anon, authenticated;
revoke all on function public.palco__botoes_json(uuid, uuid) from public, anon, authenticated;

-- registrar aperto: o botão vem do conjunto DAQUELE pedal
create or replace function public.palco__registrar(p_pedal uuid, p_posicao integer, p_escolhas text[])
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_pedal public.palco_pedais; v_botao public.palco_botoes; v_atual public.palco_chamados;
  v_qtd integer; v_n integer; v_detalhe text; i integer;
begin
  select p.* into v_pedal from public.palco_pedais p
    join public.palco_canais c on c.id = p.canal_id and c.ativo
   where p.id = p_pedal and p.ativo
   for update of p;
  if not found then raise exception 'pedal_invalido'; end if;
  select * into v_botao from public.palco__botoes_do_pedal(v_pedal.canal_id, v_pedal.id) b where b.posicao = p_posicao and b.ativo;
  if not found then raise exception 'botao_inativo'; end if;
  v_n := jsonb_array_length(v_botao.etapas);
  if coalesce(array_length(p_escolhas, 1), 0) <> v_n then raise exception 'escolha_invalida'; end if;
  for i in 0 .. v_n - 1 loop
    if p_escolhas[i + 1] is null or not ((v_botao.etapas -> i -> 'opcoes') ? p_escolhas[i + 1]) then
      raise exception 'escolha_invalida';
    end if;
  end loop;
  v_detalhe := coalesce(array_to_string(p_escolhas, ' · '), '');
  select count(*) into v_qtd from public.palco_chamados where pedal_id = v_pedal.id and atualizado_em > now() - interval '1 minute';
  if v_qtd >= 40 then raise exception 'limite_apertos'; end if;
  select * into v_atual from public.palco_chamados
   where pedal_id = v_pedal.id and posicao = p_posicao and detalhe = v_detalhe and status in ('aberto','visto')
   order by criado_em desc limit 1;
  if found then
    if v_atual.atualizado_em > now() - interval '1500 milliseconds' then
      return jsonb_build_object('id', v_atual.id, 'status', v_atual.status, 'repeticoes', v_atual.repeticoes, 'ignorado', true);
    end if;
    update public.palco_chamados set repeticoes = repeticoes + 1, status = 'aberto', visto_em = null, atualizado_em = now()
     where id = v_atual.id returning * into v_atual;
  else
    insert into public.palco_chamados (canal_id, pedal_id, pedal_nome, posicao, nome, mensagem, cor, detalhe)
    values (v_pedal.canal_id, v_pedal.id, v_pedal.nome, v_botao.posicao, v_botao.nome, v_botao.mensagem, v_botao.cor, v_detalhe)
    returning * into v_atual;
  end if;
  update public.palco_pedais set visto_em = now() where id = v_pedal.id;
  return jsonb_build_object('id', v_atual.id, 'status', v_atual.status, 'repeticoes', v_atual.repeticoes, 'ignorado', false);
end;
$function$;

-- pedal recebe os SEUS botões
create or replace function public.palco_pedal_estado(p_token text)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_pedal public.palco_pedais; v_canal public.palco_canais;
begin
  if p_token is null or char_length(p_token) <> 32 then return null; end if;
  select * into v_pedal from public.palco_pedais where token = p_token and ativo;
  if not found then return null; end if;
  select * into v_canal from public.palco_canais where id = v_pedal.canal_id and ativo;
  if not found then return null; end if;
  if v_pedal.visto_em is null or v_pedal.visto_em < now() - interval '15 seconds' then
    update public.palco_pedais set visto_em = now() where id = v_pedal.id;
  end if;
  return jsonb_build_object(
    'pedal', jsonb_build_object('id', v_pedal.id, 'nome', v_pedal.nome),
    'canal', jsonb_build_object('nome', v_canal.nome, 'sinal', v_canal.sinal),
    'botoes', public.palco__botoes_json(v_canal.id, v_pedal.id),
    'chamados', public.palco__meus_json(v_pedal.id),
    'avisos', public.palco__avisos_json(v_pedal.id),
    'agora', now());
end;
$function$;

-- celular: botões do pedal escolhido (sem pedal escolhido = padrão)
create or replace function public.palco_cel_estado(p_token text, p_pedal uuid default null)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_canal uuid; v_pedal public.palco_pedais; v_meus jsonb := '[]'::jsonb; v_avisos jsonb := '[]'::jsonb; v_pid uuid;
begin
  if p_token is null or char_length(p_token) <> 32 then return null; end if;
  select id into v_canal from public.palco_canais where token_celular = p_token and ativo;
  if v_canal is null then return null; end if;
  if p_pedal is not null then
    select * into v_pedal from public.palco_pedais where id = p_pedal and canal_id = v_canal and ativo;
    if found then
      v_pid := v_pedal.id;
      if v_pedal.visto_em is null or v_pedal.visto_em < now() - interval '15 seconds' then
        update public.palco_pedais set visto_em = now() where id = v_pedal.id;
      end if;
      v_meus := public.palco__meus_json(v_pedal.id);
      v_avisos := public.palco__avisos_json(v_pedal.id);
    end if;
  end if;
  return public.palco__mesa_json(v_canal)
      || jsonb_build_object('botoes', public.palco__botoes_json(v_canal, v_pid), 'meus', v_meus, 'meus_avisos', v_avisos);
end;
$function$;

-- painel ⚙️: botões padrão + cada pedal com flag e os seus botões
create or replace function public.palco_mesa_config(p_token text)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_canal uuid := public.palco__canal_operador(p_token);
begin
  if v_canal is null then return null; end if;
  return jsonb_build_object(
    'canal', (select jsonb_build_object('nome', c.nome, 'recados_mesa', c.recados_mesa) from public.palco_canais c where c.id = v_canal),
    'botoes', coalesce((select jsonb_agg(jsonb_build_object('posicao', b.posicao, 'nome', b.nome, 'mensagem', b.mensagem,
                                         'cor', b.cor, 'ativo', b.ativo, 'etapas', b.etapas) order by b.posicao)
                          from public.palco_botoes b where b.canal_id = v_canal and b.pedal_id is null), '[]'::jsonb),
    'pedais', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.nome, 'ativo', p.ativo, 'token', p.token,
                                         'botoes_proprios', p.botoes_proprios,
                                         'botoes', coalesce((select jsonb_agg(jsonb_build_object('posicao', b.posicao, 'nome', b.nome, 'mensagem', b.mensagem,
                                                               'cor', b.cor, 'ativo', b.ativo, 'etapas', b.etapas) order by b.posicao)
                                                             from public.palco_botoes b where b.pedal_id = p.id), '[]'::jsonb),
                                         'online', coalesce(p.visto_em > now() - interval '45 seconds', false)) order by p.created_at)
                          from public.palco_pedais p where p.canal_id = v_canal), '[]'::jsonb)
  );
end;
$function$;

-- salvar botão: p_pedal null = padrão; preenchido = botão próprio daquele pedal
drop function if exists public.palco_mesa_salvar_botao(text, integer, text, text, text, boolean, jsonb);
create or replace function public.palco_mesa_salvar_botao(
  p_token text, p_posicao integer, p_nome text, p_mensagem text, p_cor text, p_ativo boolean,
  p_etapas jsonb default '[]'::jsonb, p_pedal uuid default null)
returns boolean language plpgsql security definer set search_path to 'public'
as $function$
declare v_canal uuid := public.palco__canal_operador(p_token);
begin
  if v_canal is null then raise exception 'mesa_invalida'; end if;
  if p_posicao is null or p_posicao not between 1 and 12 then raise exception 'posicao_invalida'; end if;
  if p_pedal is null then
    insert into public.palco_botoes (canal_id, posicao, nome, mensagem, cor, ativo, etapas)
    values (v_canal, p_posicao, btrim(p_nome), btrim(coalesce(p_mensagem, '')), p_cor, coalesce(p_ativo, true), coalesce(p_etapas, '[]'::jsonb))
    on conflict (canal_id, posicao) where pedal_id is null do update
       set nome = excluded.nome, mensagem = excluded.mensagem, cor = excluded.cor, ativo = excluded.ativo, etapas = excluded.etapas;
  else
    if not exists (select 1 from public.palco_pedais where id = p_pedal and canal_id = v_canal and botoes_proprios) then
      raise exception 'pedal_sem_botoes_proprios';
    end if;
    insert into public.palco_botoes (canal_id, pedal_id, posicao, nome, mensagem, cor, ativo, etapas)
    values (v_canal, p_pedal, p_posicao, btrim(p_nome), btrim(coalesce(p_mensagem, '')), p_cor, coalesce(p_ativo, true), coalesce(p_etapas, '[]'::jsonb))
    on conflict (pedal_id, posicao) where pedal_id is not null do update
       set nome = excluded.nome, mensagem = excluded.mensagem, cor = excluded.cor, ativo = excluded.ativo, etapas = excluded.etapas;
  end if;
  return true;
end;
$function$;

-- pedais: + botoes_proprios (copia o padrão) / botoes_padrao (apaga a cópia)
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
    insert into public.palco_botoes (canal_id, pedal_id, posicao, nome, mensagem, cor, ativo, etapas)
    select v_canal, p_id, b.posicao, b.nome, b.mensagem, b.cor, b.ativo, b.etapas
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

revoke all on function public.palco_mesa_salvar_botao(text, integer, text, text, text, boolean, jsonb, uuid) from public;
grant execute on function public.palco_mesa_salvar_botao(text, integer, text, text, text, boolean, jsonb, uuid) to anon, authenticated;
grant execute on function public.palco_mesa_pedal(text, text, uuid, text) to anon, authenticated;
grant execute on function public.palco_mesa_config(text) to anon, authenticated;
grant execute on function public.palco_pedal_estado(text) to anon, authenticated;
grant execute on function public.palco_cel_estado(text, uuid) to anon, authenticated;

-- ── ATÉ 12 BOTÕES + EXCLUIR BOTÃO ───────────────────────────────────────────
-- Posição = tecla do pedal físico (1–9, 0 = 10; letras A–L = 1–12). Excluir deixa
-- a posição livre (as outras teclas não mudam de lugar).
alter table public.palco_botoes   drop constraint if exists palco_botoes_posicao_check;
alter table public.palco_botoes   add  constraint palco_botoes_posicao_check   check (posicao between 1 and 12);
alter table public.palco_chamados drop constraint if exists palco_chamados_posicao_check;
alter table public.palco_chamados add  constraint palco_chamados_posicao_check check (posicao between 1 and 12);

create or replace function public.palco_mesa_excluir_botao(p_token text, p_posicao integer, p_pedal uuid default null)
returns boolean language plpgsql security definer set search_path to 'public'
as $function$
declare v_canal uuid := public.palco__canal_operador(p_token);
begin
  if v_canal is null then raise exception 'mesa_invalida'; end if;
  if p_pedal is null then
    delete from public.palco_botoes where canal_id = v_canal and pedal_id is null and posicao = p_posicao;
  else
    delete from public.palco_botoes b using public.palco_pedais p
     where p.id = p_pedal and p.canal_id = v_canal and b.pedal_id = p.id and b.posicao = p_posicao;
  end if;
  return true;
end;
$function$;
revoke all on function public.palco_mesa_excluir_botao(text, integer, uuid) from public;
grant execute on function public.palco_mesa_excluir_botao(text, integer, uuid) to anon, authenticated;
