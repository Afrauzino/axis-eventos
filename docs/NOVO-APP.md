# Como criar um app NOVO a partir deste (clonar)

Este app tem 3 camadas: **código** (GitHub), **banco + login** (Supabase) e
**hospedagem** (Vercel). Clonar = copiar o código e ligá-lo a um **Supabase novo**,
com **endereço próprio** e **dados separados** do app original.

> Depois desta preparação, o único passo técnico é definir 2 variáveis de ambiente.
> Nenhuma linha de código precisa ser editada.

---

## Passo 1 — Copiar o código (repositório novo)

Opção A (mais simples): no GitHub, crie um repositório novo e suba uma cópia desta pasta.
Opção B: use o botão **"Use this template"** / **Fork** do repositório atual.

O importante é ter um **repositório GitHub novo** com estes mesmos arquivos.

---

## Passo 2 — Criar o Supabase novo

1. Acesse **supabase.com** → **New project**.
2. Dê um nome (ex: "Encontro Igreja X"), defina uma senha do banco e a região.
3. Aguarde criar (uns 2 min).
4. Anote em **Project Settings → API**:
   - **Project URL** → vira `VITE_SUPABASE_URL`
   - **anon public** (em API Keys) → vira `VITE_SUPABASE_ANON_KEY`

---

## Passo 3 — Montar o banco (rodar as SQLs)

No Supabase novo → **SQL Editor** → **New query**. Rode os arquivos da pasta `sql/`
**em ordem**, um de cada vez (cole o conteúdo → Run):

```
01_schema.sql   →   02_rls_policies.sql   →   03_seed.sql   →   ...   →   45_fk_auth_delete_ok.sql
```

Dica: rode do `01` até o `45`, em sequência. Se algum já tiver rodado e der "already exists",
pode ignorar e seguir — os scripts são feitos para não quebrar.

> NÃO rode os arquivos de nome em MAIÚSCULAS (LIMPAR_TUDO, RODAR_TUDO, DIAG_*, AUDITORIA_*) —
> esses são utilitários de manutenção/teste, não fazem parte da montagem.

---

## Passo 4 — Publicar a Edge Function (excluir conta)

No Supabase novo → **Edge Functions** → **Deploy a new function** → **Via Editor**:
1. Nome exato: `admin-delete-user`
2. Cole o código de `supabase/functions/admin-delete-user/index.ts`
3. **Deploy**.

(Detalhes e o código em [EDGE_FUNCTION_DELETE.md](EDGE_FUNCTION_DELETE.md).)

---

## Passo 5 — Criar o primeiro admin

1. Abra o app novo (ou o antigo apontando pro banco novo) e faça **cadastro** de um usuário — o seu.
2. No Supabase → **Authentication → Users** → copie o **User UID** desse usuário.
3. No **SQL Editor**, rode (troque o UID):

```sql
update profiles
set is_admin = true, user_role = 'admin', role_status = 'approved'
where user_id = 'COLE-O-UID-AQUI';
```

Pronto — esse login agora é o administrador do app novo.

---

## Passo 6 — Ligar o app ao Supabase novo (variáveis)

No **Vercel**, ao importar o repositório novo → **Settings → Environment Variables**, adicione:

| Nome | Valor |
|------|-------|
| `VITE_SUPABASE_URL` | a Project URL do passo 2 |
| `VITE_SUPABASE_ANON_KEY` | a anon key do passo 2 |

> Para testar no PC: copie `.env.example` para `.env` e preencha os dois valores.

---

## Passo 7 — Publicar na Vercel

1. **vercel.com** → **Add New → Project** → importe o repositório novo.
2. Framework: **Vite** (detecta sozinho). Build: `npm run build`. Output: `dist`.
3. Confirme as variáveis do Passo 6.
4. **Deploy** → sai um endereço novo (ex: `meu-encontro.vercel.app`).

---

## Passo 8 — Marca (nome, logo, cor)

Quase tudo é configurável **dentro do app**: entre como admin → **Administração → Aparência**
(logo, cor do sistema) e nos textos/termos do evento. Não precisa mexer no código.

> Alguns textos "AXIS Eventos" ficam no código (ex: rodapés). Se quiser trocar o nome fixo,
> me chame que eu ajusto num commit.

---

## Passo 9 (opcional) — Google Drive na aba Mídia

Se for usar a navegação de pastas do Drive:
1. Gere uma **API key** no Google Cloud (Drive API).
2. Restrinja a chave ao endereço novo (ex: `https://meu-encontro.vercel.app/*`) e à **Google Drive API**.
3. Coloque a chave no app: Administração → configuração `google_api_key`.

---

## Resumo (checklist)

- [ ] 1. Repositório novo no GitHub
- [ ] 2. Projeto Supabase novo (anotar URL + anon key)
- [ ] 3. Rodar `sql/01…45` em ordem
- [ ] 4. Publicar Edge Function `admin-delete-user`
- [ ] 5. Criar o primeiro admin (UPDATE no profiles)
- [ ] 6. Variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` na Vercel
- [ ] 7. Deploy na Vercel (endereço novo)
- [ ] 8. Ajustar marca em Aparência
- [ ] 9. (opcional) Google API key para a Mídia

Cada app novo fica **100% separado**: banco próprio, usuários próprios, endereço próprio.
