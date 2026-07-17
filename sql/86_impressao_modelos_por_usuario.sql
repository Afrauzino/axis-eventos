-- ============================================================================
-- 86_impressao_modelos_por_usuario.sql
-- Modelos de impressão passam a ser POR USUÁRIO, com compartilhamento + senha.
--   • Cada um vê os SEUS + os COMPARTILHADOS pelos outros.
--   • Imprimir: qualquer um. Editar: só o dono OU quem tem a senha do compartilhado.
--   • A senha NUNCA vai pro cliente: RLS de SELECT é só do dono; os compartilhados
--     vêm pela função modelos_visiveis() (que não devolve a senha).
-- JÁ RODADO no banco (2026-07-17). Migrou os 6 modelos do config antigo pro Anderson.
-- ============================================================================

create table if not exists public.impressao_modelos (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid(),
  nome          text not null,
  doc           jsonb not null,
  compartilhado boolean not null default false,
  senha         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_impr_modelos_user on public.impressao_modelos(user_id);

alter table public.impressao_modelos enable row level security;

drop policy if exists "impr_modelos_sel" on public.impressao_modelos;
drop policy if exists "impr_modelos_ins" on public.impressao_modelos;
drop policy if exists "impr_modelos_upd" on public.impressao_modelos;
drop policy if exists "impr_modelos_del" on public.impressao_modelos;
create policy "impr_modelos_sel" on public.impressao_modelos for select to authenticated using (user_id = auth.uid());
create policy "impr_modelos_ins" on public.impressao_modelos for insert to authenticated with check (user_id = auth.uid());
create policy "impr_modelos_upd" on public.impressao_modelos for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "impr_modelos_del" on public.impressao_modelos for delete to authenticated using (user_id = auth.uid());

create or replace function public.modelos_visiveis()
returns table(id uuid, nome text, doc jsonb, compartilhado boolean, sou_dono boolean, tem_senha boolean)
language sql security definer set search_path to 'public' as $$
  select m.id, m.nome, m.doc, m.compartilhado,
         (m.user_id = auth.uid()) as sou_dono,
         (m.senha is not null and m.senha <> '') as tem_senha
  from public.impressao_modelos m
  where m.user_id = auth.uid() or m.compartilhado = true
  order by (m.user_id = auth.uid()) desc, m.nome;
$$;
grant execute on function public.modelos_visiveis() to authenticated;

create or replace function public.checar_senha_modelo(p_id uuid, p_senha text)
returns boolean language sql security definer set search_path to 'public' as $$
  select exists(
    select 1 from public.impressao_modelos m where m.id = p_id
      and ( m.user_id = auth.uid()
            or (m.compartilhado and m.senha is not null and m.senha <> '' and m.senha = coalesce(p_senha,'')) )
  );
$$;
grant execute on function public.checar_senha_modelo(uuid, text) to authenticated;

create or replace function public.editar_modelo_compartilhado(p_id uuid, p_senha text, p_nome text, p_doc jsonb)
returns void language plpgsql security definer set search_path to 'public' as $$
declare m record;
begin
  select * into m from public.impressao_modelos where id = p_id;
  if not found then raise exception 'Modelo não encontrado.'; end if;
  if m.user_id = auth.uid() then
    update public.impressao_modelos set nome = coalesce(p_nome, nome), doc = coalesce(p_doc, doc), updated_at = now() where id = p_id;
    return;
  end if;
  if not m.compartilhado then raise exception 'Modelo não compartilhado.'; end if;
  if m.senha is null or m.senha = '' then raise exception 'Só o dono pode editar este modelo.'; end if;
  if m.senha <> coalesce(p_senha,'') then raise exception 'Senha incorreta.'; end if;
  update public.impressao_modelos set nome = coalesce(p_nome, nome), doc = coalesce(p_doc, doc), updated_at = now() where id = p_id;
end $$;
grant execute on function public.editar_modelo_compartilhado(uuid, text, text, jsonb) to authenticated;

-- Migração: os modelos do config antigo (impressao_modelos_v2) viram do Anderson, compartilhados.
insert into public.impressao_modelos (user_id, nome, doc, compartilhado)
select '174b4e0a-65d4-46d6-96bb-99130319197b'::uuid, elem->>'nome', elem->'doc', true
from configuracoes c, jsonb_array_elements(c.valor::jsonb) elem
where c.chave = 'impressao_modelos_v2'
  and not exists (select 1 from public.impressao_modelos);
