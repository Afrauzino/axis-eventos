# AXIS — Checklist Pré-Deploy (subir online)

> Varredura com pensamento futuro (produção). Prioridade: 🔴 bloqueador · 🟠 importante · 🟡 bom ter.
> Marcar `[x]` conforme resolver.

## 🔴 BLOQUEADORES (resolver ANTES de abrir pro público)

- [ ] **RLS incompleto (dados sensíveis expostos).** A `anon key` do app é **pública** (vai no
  frontend, está em `src/lib/supabase.ts`). A única proteção real é o **RLS** estar ligado + com
  policies em TODAS as tabelas. O SQL do repo só cobre ~13 tabelas, mas o app usa **~55** — incluindo
  **`saude_fichas`, `med_controlados`, `med_agenda`, `medicamento_entregas`, `financeiro`, `doacoes`,
  `correio_*`, `permissoes`, `escalas`, `ranking_votos`**. Se estiverem sem RLS no Supabase, qualquer
  pessoa na internet pode ler/gravar (inclusive **dados de saúde**).
  **Ação:** rodar `sql/AUDITORIA_RLS.sql` no SQL Editor do Supabase → ver quais tabelas estão sem
  RLS/policy → habilitar RLS + criar policies em cada uma. (Posso escrever as policies por tabela
  depois que soubermos o estado real e as regras de cada uma.)

- [ ] **Schema do repo desatualizado.** O SQL versionado (nomes em inglês: `medications`, `schedules`…)
  **não bate** com o que o app usa (nomes em português: `escalas`, `ministrações`, `med_controlados`…).
  Ou seja, o banco real foi construído fora desses arquivos. **Ação:** exportar o schema real do
  Supabase para o repo (fonte da verdade), pra dar pra versionar RLS/policies e recriar o ambiente.

## 🟠 IMPORTANTES

- [ ] **PWA não está configurado.** `vite-plugin-pwa` está instalado mas **não é usado** em
  `vite.config.ts`; não há `manifest.webmanifest`, ícones PWA nem service worker. O `index.html` se
  anuncia instalável (meta apple), mas **não é um PWA de verdade** (sem "instalar", sem offline).
  **Ação:** configurar o plugin + manifest + ícones. (Posso fazer.)
- [ ] **Credenciais Supabase hardcoded** em `src/lib/supabase.ts`. A anon key é pública (ok tecnicamente),
  mas o ideal é mover para env (`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`) e configurar no Vercel —
  facilita trocar de ambiente e não deixa credencial fixa no código. (Posso fazer.)

## 🟡 BOM TER (qualidade/produção)

- [x] **ErrorBoundary** — feito (`src/components/ErrorBoundary.tsx`), evita tela branca se uma tela quebrar.
- [ ] **`alert()` para erros** (~30 usos) — funciona, mas um toast/inline fica melhor no futuro.
- [ ] **Monitoramento de erro** (ex.: Sentry) — opcional, ajuda a ver bugs em produção.
- [x] **console.*** — poucos (4), sem problema.

## 🛠️ Administração (varredura + reorganização)

- [x] **Duplicidade de permissões removida** — havia 3 sistemas (cargo/pessoa/equipe); o **por cargo**
  era código morto (aba `cargos` inacessível + bug `setCargos`). Removido. Ficaram **por pessoa** e
  **por equipe** (o que você pediu).
- [x] **Tipos (cronograma) com emoji colorido** — trocado o `EmojiPicker` (line-icons) por `EmojiGrid`.
- [x] **Bugs de tipo pré-existentes no Admin** corrigidos (`.catch` em delete, `start_date/end_date`).
- [x] **Auditoria de tudo** — `sql/16_audit_triggers.sql`: trigger no banco que registra TODA
  inserção/edição/exclusão com quem fez + valores antigos/novos. **Rodar no Supabase.** Depois, a aba
  **Logs** do Admin mostra tudo (quem, o quê, quando).
- [ ] **Menu (tela MenusAdmin) está DESCONECTADO** — `menu_config` só é lido/gravado na própria tela;
  **nada mais consome** (o menu real `Nav` é fixo no código). Por isso "não dá pra escolher o emoji do
  menu": mudar lá não afeta o menu de verdade. **Decisão:** ou (a) ligar o `Nav` ao `menu_config` e usar
  emoji, ou (b) remover a tela MenusAdmin. Precisa da sua escolha.

## 🐞 Bugs achados na varredura (pré-existentes, a corrigir)
- [ ] `src/pages/Encontreiros.tsx:105` — passa prop `badges` para um componente que não aceita → badges
  não renderizam.
- [ ] `src/pages/Login.tsx:63` — lê `ano_encontro` que não está no `select` → sempre `undefined`.

## ✅ Já OK
- Deploy Vercel: `vercel.json` com SPA rewrites (rotas do react-router funcionam). Build (`npx vite build`) passa.
- `index.html`: título/descrição/theme-color corretos (AXIS Eventos).

---
_Detalhes da varredura ficam aqui; conforme resolvermos, atualizar os checkboxes._
