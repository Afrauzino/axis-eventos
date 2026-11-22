-- ============================================================================
-- 100 — PALCO ↔ MESA DE SOM (pedais de recado) — 2026-11-22
-- Idempotente (pode rodar de novo). Depende do sql/98 (pode_algum).
--
-- COMO FUNCIONA
--   • Canal  = um palco (ex.: "Palco principal"). Tem 6 botões configuráveis
--              (nome curto + recado) e um LINK SECRETO da mesa de som (monitor).
--   • Pedal  = cada aparelho/posição no palco (ex.: "Vocal 1", "Back", "Bateria").
--              Cada pedal tem o SEU link secreto → a mesa sabe QUEM apertou.
--   • Chamado = cada aperto. Guarda uma CÓPIA do nome/recado no momento (mudar a
--              configuração depois não altera o histórico).
--
-- SEGURANÇA
--   • As telas do palco e da mesa abrem SEM LOGIN (tablet/PC dedicado), só com o
--     token do link. Toda leitura/escrita delas passa por funções SECURITY DEFINER
--     que validam o token — as tabelas NÃO têm nenhuma regra para "anon".
--   • Token do pedal só ENVIA/cancela os próprios chamados. Token da mesa só
--     vê/marca chamados do seu canal. Um não serve no lugar do outro.
--   • Configuração dentro do app: liberação "Palco ↔ Mesa" (palco:ver / palco:editar).
--   • Anti-repique: aperto repetido < 1,5 s é ignorado (pedal com mau contato);
--     limite de 40 apertos/minuto por pedal.
-- ============================================================================

-- ── 1. Tabelas ────────────────────────────────────────────────────────────────
create table if not exists public.palco_canais (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events(id) on delete cascade,
  nome        text not null check (char_length(btrim(nome)) between 1 and 60),
  token_mesa  text not null unique default replace(gen_random_uuid()::text, '-', ''),
  -- id público do canal de "aviso" em tempo real (broadcast). Não dá acesso a nada:
  -- o aviso só diz "mudou, busque de novo"; os dados vêm sempre das funções abaixo.
  sinal       text not null unique default replace(gen_random_uuid()::text, '-', ''),
  ativo       boolean not null default true,
  criado_por  uuid default auth.uid(),
  created_at  timestamptz not null default now()
);
create index if not exists idx_palco_canais_event on public.palco_canais(event_id);

create table if not exists public.palco_botoes (
  id        uuid primary key default gen_random_uuid(),
  canal_id  uuid not null references public.palco_canais(id) on delete cascade,
  posicao   smallint not null check (posicao between 1 and 6),
  nome      text not null check (char_length(btrim(nome)) between 1 and 24),
  mensagem  text not null default '' check (char_length(mensagem) <= 160),
  cor       text not null default '#00A99D' check (cor ~ '^#[0-9A-Fa-f]{6}$'),
  ativo     boolean not null default true,
  unique (canal_id, posicao)
);

create table if not exists public.palco_pedais (
  id          uuid primary key default gen_random_uuid(),
  canal_id    uuid not null references public.palco_canais(id) on delete cascade,
  nome        text not null check (char_length(btrim(nome)) between 1 and 40),
  token       text not null unique default replace(gen_random_uuid()::text, '-', ''),
  ativo       boolean not null default true,
  visto_em    timestamptz,             -- último contato do aparelho (pra mesa saber se está online)
  created_at  timestamptz not null default now()
);
create index if not exists idx_palco_pedais_canal on public.palco_pedais(canal_id);

create table if not exists public.palco_chamados (
  id            uuid primary key default gen_random_uuid(),
  canal_id      uuid not null references public.palco_canais(id) on delete cascade,
  pedal_id      uuid references public.palco_pedais(id) on delete set null,
  pedal_nome    text not null,
  posicao       smallint not null check (posicao between 1 and 6),
  nome          text not null,
  mensagem      text not null default '',
  cor           text not null default '#00A99D',
  status        text not null default 'aberto' check (status in ('aberto','visto','resolvido','cancelado')),
  repeticoes    integer not null default 1,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  visto_em      timestamptz,
  resolvido_em  timestamptz
);
create index if not exists idx_palco_chamados_canal  on public.palco_chamados(canal_id, status, criado_em desc);
create index if not exists idx_palco_chamados_pedal  on public.palco_chamados(pedal_id, posicao, status);

-- ── 2. Botões e pedal padrão ao criar um canal ───────────────────────────────
create or replace function public.palco_canal_padrao()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.palco_botoes (canal_id, posicao, nome, mensagem, cor) values
    (new.id, 1, '+Mic',        'Aumenta o microfone no retorno',     '#2F855A'),
    (new.id, 2, '+Playback',   'Falta playback no retorno',          '#2B6CB0'),
    (new.id, 3, '−Back',       'Back vocal muito alto no retorno',   '#D69E2E'),
    (new.id, 4, '−Instrumento','Instrumento muito alto no retorno',  '#E8821A'),
    (new.id, 5, 'Mic falhando','Microfone falhando / sem som',       '#C53030'),
    (new.id, 6, 'Técnico',     'Preciso do técnico no palco',        '#6B46C1')
  on conflict (canal_id, posicao) do nothing;
  insert into public.palco_pedais (canal_id, nome) values (new.id, 'Palco');
  return new;
end;
$function$;

drop trigger if exists trg_palco_canal_padrao on public.palco_canais;
create trigger trg_palco_canal_padrao after insert on public.palco_canais
  for each row execute function public.palco_canal_padrao();

-- ── 3. RLS (só dentro do app, com liberação) ─────────────────────────────────
alter table public.palco_canais   enable row level security;
alter table public.palco_botoes   enable row level security;
alter table public.palco_pedais   enable row level security;
alter table public.palco_chamados enable row level security;

do $$
declare t text;
begin
  foreach t in array array['palco_canais','palco_botoes','palco_pedais','palco_chamados'] loop
    execute format('drop policy if exists %I on public.%I', t || '_sel', t);
    execute format('drop policy if exists %I on public.%I', t || '_ins', t);
    execute format('drop policy if exists %I on public.%I', t || '_upd', t);
    execute format('drop policy if exists %I on public.%I', t || '_del', t);
    execute format($p$create policy %I on public.%I for select to authenticated
                     using (public.pode_algum(array['palco:ver']))$p$, t || '_sel', t);
    -- chamados só nascem pelo pedal (função palco_enviar) — sem insert direto
    if t <> 'palco_chamados' then
      execute format($p$create policy %I on public.%I for insert to authenticated
                       with check (public.pode_algum(array['palco:editar']))$p$, t || '_ins', t);
    end if;
    execute format($p$create policy %I on public.%I for update to authenticated
                     using (public.pode_algum(array['palco:editar']))
                     with check (public.pode_algum(array['palco:editar']))$p$, t || '_upd', t);
    execute format($p$create policy %I on public.%I for delete to authenticated
                     using (public.pode_algum(array['palco:editar']))$p$, t || '_del', t);
  end loop;
end $$;

revoke all on public.palco_canais, public.palco_botoes, public.palco_pedais, public.palco_chamados from anon;

-- ── 4. Funções do PEDAL (palco) ──────────────────────────────────────────────
-- Estado da tela do pedal: botões + situação dos MEUS chamados (enviado/visto/resolvido).
create or replace function public.palco_pedal_estado(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_pedal public.palco_pedais;
  v_canal public.palco_canais;
begin
  if p_token is null or char_length(p_token) <> 32 then return null; end if;
  select * into v_pedal from public.palco_pedais where token = p_token and ativo;
  if not found then return null; end if;
  select * into v_canal from public.palco_canais where id = v_pedal.canal_id and ativo;
  if not found then return null; end if;

  -- marca "online" no máximo a cada 15 s (evita escrita a cada poll)
  if v_pedal.visto_em is null or v_pedal.visto_em < now() - interval '15 seconds' then
    update public.palco_pedais set visto_em = now() where id = v_pedal.id;
  end if;

  return jsonb_build_object(
    'pedal', jsonb_build_object('id', v_pedal.id, 'nome', v_pedal.nome),
    'canal', jsonb_build_object('nome', v_canal.nome, 'sinal', v_canal.sinal),
    'botoes', coalesce((
      select jsonb_agg(jsonb_build_object('posicao', b.posicao, 'nome', b.nome, 'mensagem', b.mensagem, 'cor', b.cor) order by b.posicao)
        from public.palco_botoes b where b.canal_id = v_canal.id and b.ativo), '[]'::jsonb),
    'chamados', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'posicao', c.posicao, 'status', c.status,
                                          'repeticoes', c.repeticoes, 'atualizado_em', c.atualizado_em))
        from public.palco_chamados c
       where c.pedal_id = v_pedal.id
         and (c.status in ('aberto','visto')
              or (c.status = 'resolvido' and c.resolvido_em > now() - interval '6 seconds'))), '[]'::jsonb),
    'agora', now()
  );
end;
$function$;

-- Aperto de um botão. Se já existe chamado aberto desse pedal+botão, REFORÇA
-- (repeticoes+1 e volta pra "aberto" → a mesa alerta de novo) em vez de duplicar.
create or replace function public.palco_enviar(p_token text, p_posicao integer)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_pedal  public.palco_pedais;
  v_botao  public.palco_botoes;
  v_atual  public.palco_chamados;
  v_qtd    integer;
begin
  if p_token is null or char_length(p_token) <> 32 then raise exception 'pedal_invalido'; end if;
  -- trava o pedal: apertos simultâneos do mesmo aparelho entram em fila (sem duplicar)
  select p.* into v_pedal from public.palco_pedais p
    join public.palco_canais c on c.id = p.canal_id and c.ativo
   where p.token = p_token and p.ativo
   for update of p;
  if not found then raise exception 'pedal_invalido'; end if;

  select * into v_botao from public.palco_botoes
   where canal_id = v_pedal.canal_id and posicao = p_posicao and ativo;
  if not found then raise exception 'botao_inativo'; end if;

  select count(*) into v_qtd from public.palco_chamados
   where pedal_id = v_pedal.id and atualizado_em > now() - interval '1 minute';
  if v_qtd >= 40 then raise exception 'limite_apertos'; end if;

  select * into v_atual from public.palco_chamados
   where pedal_id = v_pedal.id and posicao = p_posicao and status in ('aberto','visto')
   order by criado_em desc limit 1;

  if found then
    -- repique do pedal (mau contato / dedo escorregou): ignora
    if v_atual.atualizado_em > now() - interval '1500 milliseconds' then
      return jsonb_build_object('id', v_atual.id, 'status', v_atual.status, 'repeticoes', v_atual.repeticoes, 'ignorado', true);
    end if;
    update public.palco_chamados
       set repeticoes = repeticoes + 1, status = 'aberto', visto_em = null, atualizado_em = now()
     where id = v_atual.id
     returning * into v_atual;
  else
    insert into public.palco_chamados (canal_id, pedal_id, pedal_nome, posicao, nome, mensagem, cor)
    values (v_pedal.canal_id, v_pedal.id, v_pedal.nome, v_botao.posicao, v_botao.nome, v_botao.mensagem, v_botao.cor)
    returning * into v_atual;
  end if;

  update public.palco_pedais set visto_em = now() where id = v_pedal.id;
  return jsonb_build_object('id', v_atual.id, 'status', v_atual.status, 'repeticoes', v_atual.repeticoes, 'ignorado', false);
end;
$function$;

-- O cantor desiste do pedido (resolveu sozinho / apertou errado).
create or replace function public.palco_cancelar(p_token text, p_chamado uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_qtd integer;
begin
  update public.palco_chamados c
     set status = 'cancelado', atualizado_em = now()
    from public.palco_pedais p
   where p.token = p_token and p.ativo and c.pedal_id = p.id
     and c.id = p_chamado and c.status in ('aberto','visto');
  get diagnostics v_qtd = row_count;
  return v_qtd > 0;
end;
$function$;

-- ── 5. Funções da MESA DE SOM (monitor) ──────────────────────────────────────
create or replace function public.palco_mesa_estado(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_canal public.palco_canais;
begin
  if p_token is null or char_length(p_token) <> 32 then return null; end if;
  select * into v_canal from public.palco_canais where token_mesa = p_token and ativo;
  if not found then return null; end if;

  return jsonb_build_object(
    'canal', jsonb_build_object('id', v_canal.id, 'nome', v_canal.nome, 'sinal', v_canal.sinal),
    'pedais', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.nome,
                                          'online', p.visto_em > now() - interval '45 seconds') order by p.nome)
        from public.palco_pedais p where p.canal_id = v_canal.id and p.ativo), '[]'::jsonb),
    'abertos', coalesce((
      select jsonb_agg(to_jsonb(c) - 'canal_id' order by c.criado_em)
        from public.palco_chamados c
       where c.canal_id = v_canal.id and c.status in ('aberto','visto')), '[]'::jsonb),
    'recentes', coalesce((
      select jsonb_agg(to_jsonb(r) - 'canal_id' order by r.atualizado_em desc) from (
        select * from public.palco_chamados c
         where c.canal_id = v_canal.id and c.status in ('resolvido','cancelado')
           and c.atualizado_em > now() - interval '3 hours'
         order by c.atualizado_em desc limit 15) r), '[]'::jsonb),
    'agora', now()
  );
end;
$function$;

-- Marca um chamado como visto / resolvido. p_chamado NULL + 'resolvido' = resolver todos.
create or replace function public.palco_mesa_marcar(p_token text, p_chamado uuid, p_status text)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_canal uuid;
  v_qtd   integer;
begin
  if p_status not in ('visto','resolvido') then raise exception 'status_invalido'; end if;
  select id into v_canal from public.palco_canais where token_mesa = p_token and ativo;
  if v_canal is null then raise exception 'mesa_invalida'; end if;
  if p_chamado is null and p_status <> 'resolvido' then raise exception 'status_invalido'; end if;

  update public.palco_chamados
     set status        = p_status,
         visto_em      = coalesce(visto_em, now()),
         resolvido_em  = case when p_status = 'resolvido' then now() else resolvido_em end,
         atualizado_em = now()
   where canal_id = v_canal
     and (p_chamado is null or id = p_chamado)
     and status in ('aberto','visto')
     and not (p_status = 'visto' and status = 'visto');
  get diagnostics v_qtd = row_count;
  return v_qtd;
end;
$function$;

-- ── 6. Gerar novo link (invalida o antigo) — só quem configura ───────────────
create or replace function public.palco_novo_token(p_tipo text, p_id uuid)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_tok text := replace(gen_random_uuid()::text, '-', '');
begin
  if not public.pode_algum(array['palco:editar']) then raise exception 'sem_permissao'; end if;
  if p_tipo = 'mesa' then
    update public.palco_canais set token_mesa = v_tok where id = p_id;
  elsif p_tipo = 'pedal' then
    update public.palco_pedais set token = v_tok where id = p_id;
  else
    raise exception 'tipo_invalido';
  end if;
  if not found then raise exception 'nao_encontrado'; end if;
  return v_tok;
end;
$function$;

revoke all on function public.palco_pedal_estado(text)              from public;
revoke all on function public.palco_enviar(text, integer)           from public;
revoke all on function public.palco_cancelar(text, uuid)            from public;
revoke all on function public.palco_mesa_estado(text)               from public;
revoke all on function public.palco_mesa_marcar(text, uuid, text)   from public;
revoke all on function public.palco_novo_token(text, uuid)          from public, anon;
revoke all on function public.palco_canal_padrao()                  from public, anon, authenticated;
grant execute on function public.palco_pedal_estado(text)            to anon, authenticated;
grant execute on function public.palco_enviar(text, integer)         to anon, authenticated;
grant execute on function public.palco_cancelar(text, uuid)          to anon, authenticated;
grant execute on function public.palco_mesa_estado(text)             to anon, authenticated;
grant execute on function public.palco_mesa_marcar(text, uuid, text) to anon, authenticated;
grant execute on function public.palco_novo_token(text, uuid)        to authenticated;
