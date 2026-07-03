# Publicar a Edge Function `admin-delete-user` (excluir contas de verdade)

Essa função apaga a conta inteira (perfil + login `auth.users`) com a chave de admin do servidor.
Ela **só deixa admin chamar** e **nunca apaga outro admin**. O app já chama ela no botão "Excluir"
(Admin → Usuários). Enquanto ela não estiver publicada, o excluir só tira do sistema e avisa.

## Passo a passo (no seu terminal, na pasta do projeto)

1. **Instalar a CLI do Supabase** (uma vez):
   ```
   npm i -g supabase
   ```

2. **Logar:**
   ```
   supabase login
   ```
   (abre o navegador pra autorizar)

3. **Linkar o projeto** (o ref é o do seu Supabase):
   ```
   supabase link --project-ref vxhowdmzssvvmgonwoud
   ```

4. **Publicar a função:**
   ```
   supabase functions deploy admin-delete-user
   ```

Pronto. A função usa automaticamente `SUPABASE_URL`, `SUPABASE_ANON_KEY` e
`SUPABASE_SERVICE_ROLE_KEY` (o Supabase injeta) — você **não** precisa configurar segredo nenhum.

## Testar
- No app (como admin): Admin → Usuários → abre alguém que **não** é admin → **Excluir**.
- Some da lista **e** some de Authentication → Users (login apagado de verdade).
- Em admin, o botão de excluir nem aparece.

## Segurança
- Só quem tem `profiles.user_role = 'admin'` consegue chamar.
- A função recusa apagar um admin e recusa você apagar a si mesmo.
- A chave `service_role` fica **só no servidor** (nunca no navegador).
