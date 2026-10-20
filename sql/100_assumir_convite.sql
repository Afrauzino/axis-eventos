-- ============================================================================
-- 100 — Primeiro acesso por código vira RPC (2026-10-20). Idempotente.
-- Antes: a policy people_claim_convite (sql/96) deixava QUALQUER conta logada
-- assumir qualquer cadastro com código de convite ainda não usado — sem saber o
-- código — e depois ler CPF, endereço… E o sql/98 teve que liberar a leitura
-- dessas linhas pra conta pendente (o UPDATE exige enxergar a linha).
-- Agora a conta nova só assume o cadastro do código que ELA digitou, pelo servidor.
-- Depois de publicar o front que usa rpc('assumir_convite'), rodar o sql/101.
-- ============================================================================
create or replace function public.assumir_convite(p_codigo text, p jsonb)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  uid  uuid := auth.uid();
  v_id uuid;
begin
  if uid is null then raise exception 'Sem usuário logado'; end if;
  if coalesce(trim(p_codigo), '') = '' then raise exception 'Código não informado.'; end if;

  -- Só campos pessoais. Nunca valor_pago/valor_total/status/team_id/event_id/desistente
  -- (o gatilho trg_trava_people_self também segura esses).
  update public.people set
    user_id             = uid,
    invite_code         = null,
    name                = coalesce(nullif(p->>'name',''), name),
    phone               = coalesce(p->>'phone', phone),
    church              = coalesce(p->>'church', church),
    photo_url           = case when p ? 'photo_url'           then nullif(p->>'photo_url','')            else photo_url end,
    apelido             = case when p ? 'apelido'             then nullif(p->>'apelido','')              else apelido end,
    contact_phone       = case when p ? 'contact_phone'       then nullif(p->>'contact_phone','')        else contact_phone end,
    ano_encontro        = case when p ? 'ano_encontro'        then nullif(p->>'ano_encontro','')::int    else ano_encontro end,
    sexo                = case when p ? 'sexo'                then nullif(p->>'sexo','')                 else sexo end,
    birth_date          = case when p ? 'birth_date'          then nullif(p->>'birth_date','')::date     else birth_date end,
    cpf                 = case when p ? 'cpf'                 then nullif(p->>'cpf','')                  else cpf end,
    rg                  = case when p ? 'rg'                  then nullif(p->>'rg','')                   else rg end,
    cidade              = case when p ? 'cidade'              then nullif(p->>'cidade','')               else cidade end,
    estado              = case when p ? 'estado'              then nullif(p->>'estado','')               else estado end,
    endereco            = case when p ? 'endereco'            then nullif(p->>'endereco','')             else endereco end,
    bairro              = case when p ? 'bairro'              then nullif(p->>'bairro','')               else bairro end,
    cep                 = case when p ? 'cep'                 then nullif(p->>'cep','')                  else cep end,
    cargo               = case when p ? 'cargo'               then nullif(p->>'cargo','')                else cargo end,
    notes               = case when p ? 'notes'               then nullif(p->>'notes','')                else notes end,
    team_pref           = case when p ? 'team_pref'           then nullif(p->>'team_pref','')::uuid      else team_pref end,
    role_type           = case when p->>'role_type' in ('worker','encounterer') then p->>'role_type'   else role_type end,
    instagram           = case when p ? 'instagram'           then nullif(p->>'instagram','')            else instagram end,
    facebook            = case when p ? 'facebook'            then nullif(p->>'facebook','')             else facebook end,
    rede_outra          = case when p ? 'rede_outra'          then nullif(p->>'rede_outra','')           else rede_outra end,
    estado_civil        = case when p ? 'estado_civil'        then nullif(p->>'estado_civil','')         else estado_civil end,
    phone2              = case when p ? 'phone2'              then nullif(p->>'phone2','')               else phone2 end,
    contact_phone_dono  = case when p ? 'contact_phone_dono'  then nullif(p->>'contact_phone_dono','')   else contact_phone_dono end,
    contact_phone2      = case when p ? 'contact_phone2'      then nullif(p->>'contact_phone2','')       else contact_phone2 end,
    contact_phone2_dono = case when p ? 'contact_phone2_dono' then nullif(p->>'contact_phone2_dono','')  else contact_phone2_dono end
  where invite_code = upper(trim(p_codigo))
    and user_id is null
  returning id into v_id;

  if v_id is null then
    raise exception 'Código não encontrado ou já usado.' using errcode = 'P0002';
  end if;
  return v_id;
end;
$function$;
revoke all on function public.assumir_convite(text, jsonb) from public, anon;
grant execute on function public.assumir_convite(text, jsonb) to authenticated;
