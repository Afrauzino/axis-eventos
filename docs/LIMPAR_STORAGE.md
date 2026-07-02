# Limpar as FOTOS e ARQUIVOS (Storage) — jeito certo

> O Supabase **não deixa** apagar direto por SQL (erro: *"Direct deletion from storage tables is not
> allowed"*). Tem que usar a **Storage API** — o painel faz isso.

## Como fazer (painel do Supabase)
1. Supabase → menu lateral **Storage**.
2. Para **cada bucket** abaixo: abra o bucket → selecione **tudo** (arquivos e pastas) → **Delete**.

**Buckets do app (apague todos para começar 100% limpo):**
- `correio`
- `arquivos`  ← contém também a **LOGO** (em `sistema/logo_...`); depois reenvie em Admin → Aparência
- `alertas`
- `avatars`
- `pessoas`
- `team-photos`
- `locais`
- `personagens`
- `objetos`

## Ordem completa do reset (resumo)
1. _(opcional)_ Backup: Admin → Backup → Exportar.
2. Banco: rodar `sql/LIMPAR_TUDO.sql`.
3. **Fotos/arquivos: apagar os buckets acima pelo painel Storage** (este guia).
4. Logins: Authentication → Users → excluir os de teste (menos a sua conta).
5. Reenviar a logo (Admin → Aparência) e criar o evento novo.
