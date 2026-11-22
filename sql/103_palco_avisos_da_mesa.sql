-- ============================================================================
-- 103 — PALCO ↔ MESA: recados da MESA para o PALCO — 2026-11-22
-- Idempotente. Depende do 100, 101 e 102.
--
-- O técnico manda recado pro palco: um dos "recados rápidos" (configuráveis por
-- palco, ex.: "Afaste o microfone da boca") ou um texto escrito na hora. Vai pra
-- TODOS os pedais ou pra UM pedal. No palco aparece grande; quando a pessoa toca
-- "OK" a mesa vê "✓ lido por <pedal>". Recado vale por 10 minutos no palco.
-- ============================================================================

alter table public.palco_canais add column if not exists recados_mesa jsonb not null default
  '["Afaste o microfone da boca","Aproxime o microfone da boca","Cante mais forte","Ligue o microfone","Aguarde, estou resolvendo","Retorno ajustado ✓","Troque de microfone","Olhe para a mesa de som"]'::jsonb;

create or replace function public.palco_recados_validos(e jsonb)
returns boolean language plpgsql immutable set search_path to 'public'
as $function$
declare o jsonb;
begin
  if e is null or jsonb_typeof(e) <> 'array' or jsonb_array_length(e) > 12 then return false; end if;
  for o in select * from jsonb_array_elements(e) loop
    if jsonb_typeof(o) <> 'string' or char_length(btrim(o #>> '{}')) not between 1 and 80 then return false; end if;
  end loop;
  return true;
end;
$function$;
alter table public.palco_canais drop constraint if exists palco_canais_recados_chk;
alter table public.palco_canais add constraint palco_canais_recados_chk check (public.palco_recados_validos(recados_mesa));

create table if not exists public.palco_avisos (
  id         uuid primary key default gen_random_uuid(),
  canal_id   uuid not null references public.palco_canais(id) on delete cascade,
  pedal_id   uuid references public.palco_pedais(id) on delete cascade,   -- null = todos os pedais
  texto      text not null check (char_length(btrim(texto)) between 1 and 160),
  criado_em  timestamptz not null default now()
);
create index if not exists idx_palco_avisos_canal on public.palco_avisos(canal_id, criado_em desc);

create table if not exists public.palco_avisos_lidos (
  aviso_id  uuid not null references public.palco_avisos(id) on delete cascade,
  pedal_id  uuid not null references public.palco_pedais(id) on delete cascade,
  lido_em   timestamptz not null default now(),
  primary key (aviso_id, pedal_id)
);

alter table public.palco_avisos       enable row level security;
alter table public.palco_avisos_lidos enable row level security;
drop policy if exists palco_avisos_sel on public.palco_avisos;
create policy palco_avisos_sel on public.palco_avisos for select to authenticated using (public.pode_algum(array['palco:ver']));
drop policy if exists palco_avisos_lidos_sel on public.palco_avisos_lidos;
create policy palco_avisos_lidos_sel on public.palco_avisos_lidos for select to authenticated using (public.pode_algum(array['palco:ver']));
revoke all on public.palco_avisos, public.palco_avisos_lidos from anon;

-- avisos NÃO lidos por este pedal (últimos 10 min), mais antigo primeiro
create or replace function public.palco__avisos_json(p_pedal uuid)
returns jsonb language sql stable security definer set search_path to 'public'
as $function$
  select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'texto', a.texto, 'criado_em', a.criado_em,
                                               'so_meu', a.pedal_id is not null) order by a.criado_em), '[]'::jsonb)
    from public.palco_avisos a
    join public.palco_pedais p on p.id = p_pedal and p.canal_id = a.canal_id
   where (a.pedal_id is null or a.pedal_id = p_pedal)
     and a.criado_em > now() - interval '10 minutes'
     and not exists (select 1 from public.palco_avisos_lidos l where l.aviso_id = a.id and l.pedal_id = p_pedal);
$function$;
revoke all on function public.palco__avisos_json(uuid) from public, anon, authenticated;

-- estado da mesa agora traz também os avisos enviados (30 min) e quem já leu
create or replace function public.palco__mesa_json(p_canal uuid)
returns jsonb language sql stable security definer set search_path to 'public'
as $function$
  select jsonb_build_object(
    'canal', (select jsonb_build_object('id', c.id, 'nome', c.nome, 'sinal', c.sinal, 'recados_mesa', c.recados_mesa) from public.palco_canais c where c.id = p_canal),
    'pedais', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.nome,
                         'online', coalesce(p.visto_em > now() - interval '45 seconds', false)) order by p.nome)
                        from public.palco_pedais p where p.canal_id = p_canal and p.ativo), '[]'::jsonb),
    'abertos', coalesce((select jsonb_agg(to_jsonb(c) - 'canal_id' order by c.criado_em)
                         from public.palco_chamados c where c.canal_id = p_canal and c.status in ('aberto','visto')), '[]'::jsonb),
    'recentes', coalesce((select jsonb_agg(to_jsonb(r) - 'canal_id' order by r.atualizado_em desc) from (
                           select * from public.palco_chamados c
                            where c.canal_id = p_canal and c.status in ('resolvido','cancelado')
                              and c.atualizado_em > now() - interval '3 hours'
                            order by c.atualizado_em desc limit 15) r), '[]'::jsonb),
    'avisos', coalesce((select jsonb_agg(jsonb_build_object(
                           'id', a.id, 'texto', a.texto, 'criado_em', a.criado_em,
                           'para', coalesce((select p.nome from public.palco_pedais p where p.id = a.pedal_id), 'Todos'),
                           'lidos', coalesce((select jsonb_agg(p.nome order by l.lido_em) from public.palco_avisos_lidos l
                                                join public.palco_pedais p on p.id = l.pedal_id where l.aviso_id = a.id), '[]'::jsonb))
                         order by a.criado_em desc)
                        from (select * from public.palco_avisos where canal_id = p_canal and criado_em > now() - interval '30 minutes'
                              order by criado_em desc limit 10) a), '[]'::jsonb),
    'agora', now());
$function$;

-- MESA → PALCO: enviar recado (token da mesa ou do celular)
create or replace function public.palco_mesa_avisar(p_token text, p_pedal uuid, p_texto text)
returns uuid language plpgsql security definer set search_path to 'public'
as $function$
declare v_canal uuid := public.palco__canal_operador(p_token); v_qtd integer; v_id uuid;
begin
  if v_canal is null then raise exception 'mesa_invalida'; end if;
  if p_pedal is not null and not exists (select 1 from public.palco_pedais where id = p_pedal and canal_id = v_canal) then
    raise exception 'pedal_invalido';
  end if;
  select count(*) into v_qtd from public.palco_avisos where canal_id = v_canal and criado_em > now() - interval '1 minute';
  if v_qtd >= 30 then raise exception 'limite_avisos'; end if;
  insert into public.palco_avisos (canal_id, pedal_id, texto) values (v_canal, p_pedal, btrim(p_texto)) returning id into v_id;
  return v_id;
end;
$function$;

-- PALCO: "OK, entendi" (link do pedal)
create or replace function public.palco_aviso_ciente(p_token text, p_aviso uuid)
returns boolean language plpgsql security definer set search_path to 'public'
as $function$
declare v_pedal public.palco_pedais;
begin
  if p_token is null or char_length(p_token) <> 32 then return false; end if;
  select * into v_pedal from public.palco_pedais where token = p_token and ativo;
  if not found then return false; end if;
  insert into public.palco_avisos_lidos (aviso_id, pedal_id)
  select a.id, v_pedal.id from public.palco_avisos a
   where a.id = p_aviso and a.canal_id = v_pedal.canal_id and (a.pedal_id is null or a.pedal_id = v_pedal.id)
  on conflict do nothing;
  return true;
end;
$function$;

-- PALCO: "OK, entendi" (link do celular, como um dos pedais)
create or replace function public.palco_cel_aviso_ciente(p_token text, p_pedal uuid, p_aviso uuid)
returns boolean language plpgsql security definer set search_path to 'public'
as $function$
declare v_canal uuid;
begin
  if p_token is null or char_length(p_token) <> 32 then return false; end if;
  select id into v_canal from public.palco_canais where token_celular = p_token and ativo;
  if v_canal is null then return false; end if;
  insert into public.palco_avisos_lidos (aviso_id, pedal_id)
  select a.id, p.id from public.palco_avisos a join public.palco_pedais p on p.id = p_pedal and p.canal_id = v_canal and p.ativo
   where a.id = p_aviso and a.canal_id = v_canal and (a.pedal_id is null or a.pedal_id = p.id)
  on conflict do nothing;
  return true;
end;
$function$;

-- Recados rápidos (editar pelo painel ⚙️ da mesa)
create or replace function public.palco_mesa_salvar_recados(p_token text, p_recados jsonb)
returns boolean language plpgsql security definer set search_path to 'public'
as $function$
declare v_canal uuid := public.palco__canal_operador(p_token);
begin
  if v_canal is null then raise exception 'mesa_invalida'; end if;
  update public.palco_canais set recados_mesa = coalesce(p_recados, '[]'::jsonb) where id = v_canal;
  return true;
end;
$function$;

-- pedal e celular passam a receber os avisos
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
    'botoes', public.palco__botoes_json(v_canal.id),
    'chamados', public.palco__meus_json(v_pedal.id),
    'avisos', public.palco__avisos_json(v_pedal.id),
    'agora', now());
end;
$function$;

create or replace function public.palco_cel_estado(p_token text, p_pedal uuid default null)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_canal uuid; v_pedal public.palco_pedais; v_meus jsonb := '[]'::jsonb; v_avisos jsonb := '[]'::jsonb;
begin
  if p_token is null or char_length(p_token) <> 32 then return null; end if;
  select id into v_canal from public.palco_canais where token_celular = p_token and ativo;
  if v_canal is null then return null; end if;
  if p_pedal is not null then
    select * into v_pedal from public.palco_pedais where id = p_pedal and canal_id = v_canal and ativo;
    if found then
      if v_pedal.visto_em is null or v_pedal.visto_em < now() - interval '15 seconds' then
        update public.palco_pedais set visto_em = now() where id = v_pedal.id;
      end if;
      v_meus := public.palco__meus_json(v_pedal.id);
      v_avisos := public.palco__avisos_json(v_pedal.id);
    end if;
  end if;
  return public.palco__mesa_json(v_canal)
      || jsonb_build_object('botoes', public.palco__botoes_json(v_canal), 'meus', v_meus, 'meus_avisos', v_avisos);
end;
$function$;

-- painel ⚙️ também traz os recados rápidos
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
                          from public.palco_botoes b where b.canal_id = v_canal), '[]'::jsonb),
    'pedais', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.nome, 'ativo', p.ativo, 'token', p.token,
                                         'online', coalesce(p.visto_em > now() - interval '45 seconds', false)) order by p.created_at)
                          from public.palco_pedais p where p.canal_id = v_canal), '[]'::jsonb)
  );
end;
$function$;

revoke all on function public.palco_recados_validos(jsonb) from public, anon;
revoke all on function public.palco_mesa_avisar(text, uuid, text) from public;
revoke all on function public.palco_aviso_ciente(text, uuid) from public;
revoke all on function public.palco_cel_aviso_ciente(text, uuid, uuid) from public;
revoke all on function public.palco_mesa_salvar_recados(text, jsonb) from public;
grant execute on function public.palco_mesa_avisar(text, uuid, text) to anon, authenticated;
grant execute on function public.palco_aviso_ciente(text, uuid) to anon, authenticated;
grant execute on function public.palco_cel_aviso_ciente(text, uuid, uuid) to anon, authenticated;
grant execute on function public.palco_mesa_salvar_recados(text, jsonb) to anon, authenticated;
grant execute on function public.palco_pedal_estado(text) to anon, authenticated;
grant execute on function public.palco_cel_estado(text, uuid) to anon, authenticated;
grant execute on function public.palco_mesa_config(text) to anon, authenticated;
