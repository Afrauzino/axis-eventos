> ⚠️ **Obsoleto — o app não usa mais esta função.**
>
> A exclusão de contas passou para `excluir_conta_completa`, uma função do próprio
> banco (`sql/51_excluir_conta.sql`). Ela não depende de deploy e faz tudo numa
> transação só: se algo falhar, nada é apagado.
>
> A Edge Function abaixo **está publicada**, mas responde `403 "Apenas administradores
> podem excluir contas"` mesmo quando quem chama é admin de verdade
> (`user_role='admin'`, `is_admin=true`). Ou seja: a leitura do perfil com a chave de
> serviço não devolve nada — provavelmente `SUPABASE_SERVICE_ROLE_KEY` ausente no
> ambiente, ou a versão publicada é mais antiga que este código. Se um dia for
> reaproveitada, é aí que está o defeito.

# Publicar a Edge Function `admin-delete-user` (excluir contas de verdade)

Essa função apaga a conta inteira (perfil + login `auth.users`) com a chave de admin do servidor.
Ela **só deixa admin chamar** e **nunca apaga outro admin**.

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
