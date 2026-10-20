-- ============================================================================
-- 94 — EXPORT (cópia) das funções que existiam SÓ no Supabase, não no git.
-- Exportado do banco de produção em 2026-10-20, ANTES das correções do sql/95.
-- Serve de registro/backup. Para recriar o banco do zero, rode este e depois o 95.
-- Agendamento (pg_cron) que existia:
--   auto-avancar-cronograma : '15 seconds'  → select public.avancar_expirados();
-- ============================================================================

CREATE OR REPLACE FUNCTION public.ajustar_tempo(p_id uuid, delta_seg integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  cur record; nxt record;
  cur_base int; nxt_base int;
  cur_novo int; nxt_novo int;
  limitou boolean := false;
begin
  select * into cur from cronograma_eventos where id = p_id for update;
  if not found then return json_build_object('ok', false, 'motivo', 'nao_encontrado'); end if;

  cur_base := coalesce(case when cur.duracao_minutos > 0 then cur.duracao_minutos*60
                            else greatest(0, floor(extract(epoch from (cur.hora_fim - cur.hora_inicio)))::int) end, 0);
  cur_novo := coalesce(cur.cron_ajuste_segundos, 0) + delta_seg;
  if cur_base + cur_novo < 60 then cur_novo := 60 - cur_base; limitou := true; end if;

  update cronograma_eventos set cron_ajuste_segundos = cur_novo where id = cur.id;

  -- próximo imediato na ordem (o que vai rodar depois), ainda planejado
  select * into nxt from cronograma_eventos
   where event_id = cur.event_id
     and coalesce(status, 'planejado') = 'planejado'
     and coalesce(cron_estado, 'parado') not in ('correndo', 'encerrado')
     and (hora_inicio, created_at) > (cur.hora_inicio, cur.created_at)
   order by hora_inicio, created_at
   limit 1;

  if not found then
    return json_build_object('ok', true, 'atual_ajuste', cur_novo, 'proximo', null, 'motivo', 'sem_proximo', 'limitou', limitou);
  end if;

  nxt_base := coalesce(case when nxt.duracao_minutos > 0 then nxt.duracao_minutos*60
                            else greatest(0, floor(extract(epoch from (nxt.hora_fim - nxt.hora_inicio)))::int) end, 0);
  nxt_novo := coalesce(nxt.cron_ajuste_segundos, 0) - delta_seg;
  if nxt_base + nxt_novo < 60 then nxt_novo := 60 - nxt_base; limitou := true; end if;

  update cronograma_eventos set cron_ajuste_segundos = nxt_novo where id = nxt.id;

  return json_build_object('ok', true, 'atual_ajuste', cur_novo,
    'proximo', nxt.id, 'proximo_titulo', nxt.titulo,
    'proximo_total_seg', nxt_base + nxt_novo, 'limitou', limitou);
end;
$function$;

CREATE OR REPLACE FUNCTION public.avancar_bloco(p_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  b record;
  prox record;
  total_seg int;
  decorrido int;
begin
  select * into b from cronograma_eventos where id = p_id for update;
  if not found then return json_build_object('ok', false, 'motivo', 'nao_encontrado'); end if;
  if coalesce(b.cron_estado, '') <> 'correndo' then
    return json_build_object('ok', false, 'motivo', 'nao_correndo');
  end if;

  total_seg := coalesce(
      case when b.duracao_minutos is not null and b.duracao_minutos > 0
           then b.duracao_minutos * 60
           else greatest(0, floor(extract(epoch from (b.hora_fim - b.hora_inicio)))::int) end
    , 0) + coalesce(b.cron_ajuste_segundos, 0);

  decorrido := coalesce(b.cron_decorrido_segundos, 0)
    + case when b.cron_iniciado_em is not null
           then greatest(0, floor(extract(epoch from (now() - b.cron_iniciado_em)))::int)
           else 0 end;

  -- só age quando ZEROU (nunca adianta)
  if total_seg <= 0 or decorrido < total_seg then
    return json_build_object('ok', false, 'motivo', 'ainda_tem_tempo', 'restante', total_seg - decorrido);
  end if;

  -- conclui SÓ o atual (propaga a teatro/ministração ligados)
  update cronograma_eventos set status = 'concluido', cron_estado = 'encerrado' where id = b.id;
  if b.theater_id is not null then update theaters set status = 'concluido' where id = b.theater_id; end if;
  if b.ministracao_id is not null then update "ministrações" set status = 'concluido' where id = b.ministracao_id; end if;

  -- PRÓXIMO = o imediato na ordem do cronograma (não pula), ainda planejado, depois do atual
  select * into prox from cronograma_eventos
   where event_id = b.event_id
     and coalesce(status, 'planejado') = 'planejado'
     and coalesce(cron_estado, 'parado') not in ('correndo', 'encerrado')
     and (hora_inicio, created_at) > (b.hora_inicio, b.created_at)
   order by hora_inicio, created_at
   limit 1;

  if not found then
    return json_build_object('ok', true, 'concluiu', b.id, 'proximo', null, 'motivo', 'sem_proximo');
  end if;

  -- inicia o próximo (do atual para o próximo, direto)
  update cronograma_eventos
     set status = 'em_andamento', cron_estado = 'correndo',
         cron_iniciado_em = now(), cron_decorrido_segundos = 0
   where id = prox.id;

  return json_build_object('ok', true, 'concluiu', b.id, 'proximo', prox.id);
end;
$function$;

CREATE OR REPLACE FUNCTION public.avancar_expirados()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r record; n int := 0;
begin
  for r in select id from cronograma_eventos where cron_estado = 'correndo' order by cron_iniciado_em loop
    if (avancar_bloco(r.id) ->> 'ok') = 'true' then n := n + 1; end if;
  end loop;
  return n;
end;
$function$;

CREATE OR REPLACE FUNCTION public.tela_progresso()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with ev as (
    select id, name from public.events where status='active' order by created_at desc limit 1
  ),
  calc as (
    select
      count(*) filter (where c.status='concluido')::int as feitos,
      count(*)::int as total
    from public.cronograma_eventos c join ev on c.event_id = ev.id
  )
  select jsonb_build_object(
    'nome',  (select name from ev),
    'pct',   (select case
                when total <= 0 then 0
                when feitos >= total then 83
                else (array[3,7,13,17,23,27,33,37,43,47,53,57,63,67,73,77,83]::int[])[
                       least(greatest(
                         round(16 * power(feitos::numeric / total, 0.85))::int
                         - (case when feitos % 3 = 2 then 1 else 0 end),
                       0), 15) + 1
                     ]
              end from calc),
    'feitos',(select feitos from calc),
    'total', (select total from calc)
  );
$function$;

CREATE OR REPLACE FUNCTION public.tempo_atual()
 RETURNS json
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select to_json(t) from (
    select
      b.id,
      coalesce(m.titulo, b.titulo) as titulo,
      b.tipo,
      p.name  as ministrante,
      p.photo_url as foto,
      m.foto_poster as foto_png,
      b.duracao_minutos,
      b.hora_inicio,
      b.hora_fim,
      b.cron_estado,
      b.cron_iniciado_em,
      coalesce(b.cron_ajuste_segundos, 0)   as cron_ajuste_segundos,
      coalesce(b.cron_decorrido_segundos, 0) as cron_decorrido_segundos
    from cronograma_eventos b
    left join "ministrações" m on m.id = b.ministracao_id
    left join people p on p.id = m.ministrante_id
    where coalesce(b.cron_estado, '') <> 'encerrado'
      and (
            b.cron_estado = 'correndo'
         or b.status = 'em_andamento'
         or (b.cron_estado = 'parado' and coalesce(b.cron_decorrido_segundos, 0) > 0)
      )
    order by (b.cron_estado = 'correndo') desc, b.cron_iniciado_em desc nulls last
    limit 1
  ) t;
$function$;
