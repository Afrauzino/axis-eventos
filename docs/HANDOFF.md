# AXIS Eventos — Handoff (continuar em nova conversa)

> Documento para retomar o trabalho. Leia junto com: `docs/PADRAO-VISUAL.md` (regras visuais),
> `docs/AUDITORIA.md` (menus/permissões), `docs/PENDENCIAS.md` (roadmap).

## Estado da sessão
- **Branch:** `feat/axis-melhorias-sessao` — **PR #1** aberto: https://github.com/Afrauzino/axis-eventos/pull/1
- Working tree limpo; tudo commitado e empurrado. Build (`npx vite build`) passa.
- **App:** React + Vite + Supabase (PWA "AXIS Eventos"). Rodar: `npm run dev` (localhost:5173).
- **Edito direto no PC do Anderson** — ele não copia/cola nem descompacta zip.
- **Autonomia total** concedida: proceder e commitar sem pedir confirmação a cada passo.
  Para decisões de produto, usar **caixa de seleção** (AskUserQuestion), não texto aberto.

## ⚠️ SQLs a rodar no Supabase (senão as telas abrem mas não gravam)
Arquivo único: **`sql/RODAR_TUDO.sql`** (junta 05–13). Depois, individualmente:
`14_med_corte_hora.sql`, `15_crachas.sql`. Todos idempotentes (IF NOT EXISTS). Os inserts no app são
resilientes (não quebram antes das migrações). Limpeza de teste: `sql/LIMPAR_MEDS_TESTE.sql`.

## O que já foi feito nesta sessão (resumo)
- Correções: Ministrações (excluir/bugs), Ranking (votação inline por estrelas), Correio (padrinho só equipe Correio),
  Cadastros (código copia/WhatsApp), foto do admin, aprovação 3 cargos.
- Módulos novos: Logs/Auditoria; Eventos como raiz (auto-seed + export/import seletivo); Teatro Mídia; menu Mídia;
  **Crachá**; **Saúde/Medicamento contínuo** (ficha reutilizável fonte única, motor de doses, Agenda/Histórico,
  Logística inline, tela rápida da pessoa, hora de corte configurável em Saúde → Configuração).
- Padrão visual virou regra (EmojiGrid, modal bottom-sheet, cards padrão Equipe, SubTabs, cor do sistema na barra lateral,
  "tudo que fecha volta pra origem"). Auditoria de menus/telas/permissões.
- **Impressão/PDF (via PrintOverlay):** lista de pessoas com foto (Cadastros); teatro individual; ministração individual;
  Logística → PDF por pessoa como **formulário de preenchimento manual** (marca o que existe, deixa em branco o resto).

---

## 🆕 BACKLOG NOVO (pedidos do Anderson — a fazer na próxima conversa)

### 0. BUG — Crachá não deixa editar (PRIORIDADE)
"ao clicar a aba pisca, abre mas fecha logo em seguida." No editor `src/pages/Cracha.tsx`, o container do
`CrachaView` tem `onClick={()=>edit&&onSelect?.('')}` que **deseleciona** logo após o `onPointerDown`
selecionar o elemento. **Fix provável:** não disparar o deselect quando o clique começou sobre um elemento
(usar flag de "acabei de selecionar/arrastar" no pointerDown e ignorar o onClick do container nesse caso),
ou trocar o deselect para só ocorrer em clique no fundo vazio (checar `e.target===container`).

### 1. Impressões novas (usar o componente `src/components/PrintOverlay.tsx`)
- **Cozinha:** botão imprimir com os detalhes (cardápios: tipo, título, itens; e/ou tipos de refeição).
- **Cadastros:** ao imprimir, **escolher** entre Encontristas / Encontreiros / **os dois** (filtro na impressão).
- **Correio:** imprimir com o **checklist** de cada afilhado; se a pessoa tiver **arquivo**, escrever "tem arquivo no app".
- **Cronograma:** imprimir com **2 opções**:
  1. **Inteiro** do jeito que aparece no app (lista dos itens como estão).
  2. **Aberto com detalhes completos** (puxando ministração/teatro vinculados) — **sem status e sem local**.
- **Equipes:** imprimir com riqueza de detalhes — **nome da equipe, líder, liderados**, com **nome e foto**.
  Poder **filtrar/selecionar quais equipes** imprimir (modular: marcar 2, 3, quantas quiser).

### 2. Crachá — 3 modelos + editor avançado
- **3 modelos** acessíveis por **barra de menu no topo** (padrão visual do app): **Encontreiros**, **Encontrista**, **Especiais**.
  A edição é **exatamente igual** para os três (mesmo editor). Guardar config por modelo (ex: coluna/rows por `modelo` na tabela `crachas`, ou 3 registros).
- **Tamanhos:** manter os pré-definidos + opção **"Personalizar tamanho"** (largura/altura manuais, em mm/cm/px).
- **PNGs (camadas):** inserir **vários PNGs**, posicionar livremente, **redimensionar independente**, manter **transparência**;
  cada PNG é uma **camada independente**. (Reaproveitar o padrão de "texto livre" que já existe: arrastar/selecionar/redimensionar.)
- **Foto:** poder escolher o formato: **Redondo** (atual) OU **Quadrado com cantos arredondados** (estilo 3×4).
- Objetivo: editor flexível, igual para todos os modelos, com liberdade total e reaproveitamento de layouts.

### 3. Ranking / Encontristas — botão "Votar neste encontrista"
- O botão **"Votar neste encontrista"** (na tela da pessoa, ex: em `/encontristas`) deve **ir direto para a pessoa
  selecionada** (abrir o Ranking/votação já naquela pessoa).
- **Ao fechar, voltar para a página de onde veio** (respeitar a regra global "tudo que fecha volta pra origem").
- ⚠️ **Não pode interferir no botão de fechar do Ranking** (o Ranking tem seu próprio fechar que deve continuar funcionando).
- Fluxo desejado parecido com a sequência de prints que o Anderson mandou (abre a pessoa → vota → fecha → volta).

---

## Onde mexer (mapa rápido)
- Impressões: cada página tem seu botão + `<PrintOverlay>` (ver exemplos em `Cadastros.tsx`, `TeatroDetalhe.tsx`,
  `Ministracoes.tsx`, `Logistica.tsx`). Padrão: estado `imprimir` + overlay com `className="print-break"` por página.
- Crachá: `src/pages/Cracha.tsx` (editor + `CrachaView`). Tabela `crachas` (event_id, tamanho, fundo_url, campos jsonb).
- Ranking: `src/pages/Ranking.tsx`; Encontristas: `src/pages/Encontristas.tsx` (botão "Votar neste encontrista").
- Componentes reutilizáveis: `EmojiGrid`, `SubTabs`, `PrintOverlay`, `FichaMedica`, `PessoaSaudeResumo`.
