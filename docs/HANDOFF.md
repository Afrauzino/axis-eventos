# AXIS Eventos — Handoff (continuar em nova conversa)

> Documento para retomar o trabalho. Leia junto com: `docs/PADRAO-VISUAL.md` (regras visuais),
> `docs/AUDITORIA.md` (menus/permissões), `docs/PENDENCIAS.md` (roadmap).

## 🟢 ESTADO ATUAL (2026-07-04) — leia isto primeiro

**App:** React + Vite + Supabase, PWA "AXIS Eventos" (gestão de encontros religiosos).
**Rodar local:** `npm run dev` (localhost:5173). Validar: `npx vite build` + `npx tsc --noEmit` (ambos passam).

### Como o Anderson trabalha (regras que valem sempre)
- **Responder 100% em português**, simples. Ele não é dev — explicar sem jargão.
- **Listas numeradas curtas** para as ações DELE, separadas do que a Claude já fez.
- **Decisões de produto → caixa de seleção** (AskUserQuestion), nunca texto aberto.
- **Autonomia total**: proceder e commitar sem pedir confirmação a cada passo. Cadência **2-a-2** (fazer, checar bug, seguir).
- **Edito direto no PC dele** (não manda zip). Toda ideia nova vai pra `docs/IDEIAS.md`.
- Ele é **admin, mas também encontreiro e pode ser líder** (papéis acumulam).

### Deploy (ele já autorizou publicar; publicar só quando tudo ok)
- Fluxo: **push na branch `main`** → **Vercel** builda e publica sozinho. Supabase é o backend sempre online.
- Branch de trabalho: `feat/axis-melhorias-sessao`. Publicar = `git checkout main` → `git merge --ff-only feat/...` → `git push origin main` → voltar pra branch.
- **Produção:** https://axis-eventos-sage.vercel.app · Repo: https://github.com/Afrauzino/axis-eventos
- **Confirmar deploy sem abrir o site** (este ambiente BLOQUEIA acessar sites externos, mas a API do GitHub funciona):
  `GET https://api.github.com/repos/Afrauzino/axis-eventos/commits/<sha>/status` → achar `context:"Vercel"` com `state:"success"`.
- Não dá pra rodar SQL daqui (só chave anon pública em `src/lib/supabase.ts`, ref `vxhowdmzssvvmgonwoud`). SQL = Anderson cola no SQL Editor.

### O que foi entregue na sessão grande (2026-07-03/04) — TUDO no ar
Lista de 19 pedidos + follow-ups, **todos feitos e publicados**. Detalhe item a item em `docs/IDEIAS.md`
(bloco "LISTA GRANDE (pré-lançamento)"). Resumo do que mexeu:
- #1 Admin edita 100% do cadastro (`Admin.tsx` reusa `CadastroPessoa`) + abas rolam sozinhas (`.tabs` overflow-x em `index.css`).
- #2 PWA instalável: `public/manifest.webmanifest`, `public/sw.js` (network-first), `InstallPWA.tsx` (Android 1 toque/passo a passo; iPhone guiado), registro em `main.tsx`.
- #3 Equipes: color picker (`Equipes.tsx`) + `sql/21_storage_buckets.sql` (foto-ícone). #3b tecla fantasma = PENDENTE (ver abaixo).
- #4 1 botão liga/desliga boas-vindas (`BoasVindas.tsx`, config `boasvindas_ativo`).
- #5 Dashboard sem "Acesso rápido"; indicadores só admin/financeiro (`Dashboard.tsx`).
- #6 Central de notificações no sino (`NotificacoesCenter.tsx` + `App.tsx`) — derivada, "lido" em localStorage.
- #7 "Adicionar alarmes ao celular" (`Medicamentos.tsx` + `src/lib/ics.ts`) — gera .ics, alarme ~8min antes.
- #8 Logo na tela de boas-vindas + 3ª variante "Visitante" (`BoasVindas.tsx`, `Dashboard.tsx`).
- #9 Só encontreiro é ministrante (`Ministracoes.tsx` filtra `role_type='worker'`).
- #10 Ministração sem data/hora (agenda só no cronograma; mantém hora-base interna p/ não quebrar o banco).
- #11 Cronograma → atividades pessoais (ministrante/elenco em `MinhasAtividades.tsx`, seção "Minha agenda").
- #12 Cronograma tempo real (Supabase Realtime em `Cronograma.tsx` + `CronometroPopup.tsx`) + `sql/22_realtime_cronograma.sql`.
- #13 Barra do celular segue a cor (theme-color dinâmico em `src/lib/tema.ts`).
- #14 Impressão preserva cores (`print-color-adjust` em `PrintOverlay.tsx`).
- #15 DESCARTADO (não fazer — ele confirmou 2x).
- #16 Ministrante restrito (`Ministracoes.tsx`, `restrito = user_role==='coordenador' && !admin`: só a própria ministração + notas, volta sempre pro cronograma).
- #17 Playlist YouTube limpa (`YouTubePlayer.tsx` IFrame API, avança no fim; `HomeCarousel.tsx`).
- #18 Aba MSG no Admin (mensagem editável do código de acesso, `{nome}`/`{codigo}`, botão "Copiar msg").
- #19 "Conheço esta pessoa" em Encontristas (`Encontristas.tsx`) + `sql/23_encontrista_conhecidos.sql`.
- Follow-up: barra de progresso de Minhas Atividades agora inclui cronograma, mas só sobe quando o item está 'concluido' ou 'cancelado'.

### Ajustes 2026-07-04 (parte 2)
- **Instalar app:** botão global no rodapé de TODAS as telas (`App.tsx` → `<InstallPWA autoShow/>`); ícone da
  instalação usa a LOGO do sistema (manifest dinâmico em `tema.ts::aplicarIconesApp`). Pós-instalação (`appinstalled`)
  mostra tela "App instalado" e tenta `window.close()`. Quem já instalou precisa reinstalar p/ trocar o ícone.
- **Tela inicial (`Dashboard.tsx`):** sem data/"Olá nome"; **blocos arrastáveis pelo admin** (botão "Reordenar tela",
  ordem salva em config `home_ordem`, função `renderSecao`). Ranking sem o título (só a caixa).
- **Performance:** telas em `React.lazy`+`Suspense` (`App.tsx`). Bundle inicial ~935KB→476KB (gzip 225→135KB).
  Login/Pending/Dashboard ficam eager; o resto carrega sob demanda. NENHUMA config perdida.
- **Dica p/ verificar telas logadas:** o dev server (`npm run dev`) do Anderson costuma ter a **sessão dele ativa**,
  então dá pra ver o app logado no preview. É DADO REAL — só observar, não alterar.

### SQLs — 2026-07-04 (TODOS JÁ RODADOS pelo Anderson ✅) — MENOS o sql/27 (pendente)
- `sql/21`, `sql/22`, `sql/23`, `sql/24_fix_criar_cadastro.sql`, `sql/25_seguranca.sql` — aplicados.
- `sql/26_diagnostico_permissoes.sql` — só leitura, já rodado (revelou permissions EN inexistente, banco aberto).
- `sql/27_permissoes_fonte_unica.sql` — ⚠️ **FALTA RODAR** (permissoes só admin escreve + doses só admin apaga).
- `sql/24`: libera CRIAR pessoa p/ quem tem permissão granular "ver e editar Cadastro" (RLS de INSERT exigia
  'create', mas o app só concede 'editar'). UI também corrigida: `Cadastros.tsx` usa `pode('cadastros','editar')`.
- `sql/25`: `configuracoes` só admin escreve (leitura pública mantida); revoga execução pública das funções de
  gatilho. NÃO mexe em buckets (o app lista `avatars`). Verificado: admin ainda escreve config (status 201).
- ⚠️ PROVÁVEL BUG IGUAL em OUTROS módulos: o INSERT de `teams`/`ministrações`/`escalas`/`theaters`/`cozinha`/
  `locais`/`cronograma` pode ter o mesmo problema do `people` (criar bloqueado p/ granular). Ver IDEIAS "[ALTA]".
- Fora de propósito (risco baixo): bucket-listing e "leaked password protection" (dashboard).

### ✅ TAREFA 1 — UNIFICAR PERMISSÕES (feito em 2026-07-04, parte 3) — falta rodar sql/27
**Descoberta do diagnóstico (sql/26):** a tabela `permissions` (EN) e a função `has_permission()` **NÃO
existem** neste banco. Logo a fonte única SEMPRE foi a `permissoes` (PT). E o banco está "de portão aberto":
quase toda tabela tem policies genéricas `sel/ins/upd/del = auth.uid() IS NOT NULL` (qualquer logado grava).
Quem controlava de verdade era o app. O bug real do "criar/editar": os módulos usavam `canEdit =
isAdmin(user_role)` e **ignoravam** as liberações individuais/equipe da tela do Admin (tabela `permissoes`).
**O que foi feito (fonte única = `permissoes` via `pode()`):**
- App: cada módulo agora usa `canEdit = isAdmin || pode('<modulo>','editar')` — Equipes, Ministrações, Escalas,
  Locais, Cozinha, Teatro (+ TeatroDetalhe/Atores/Objetos/Personagens), Cronograma. (Cadastros/Encontristas já
  estavam via sql/24 + `pode('cadastros','editar')`.) Só SOMA acesso — ninguém perde. `tsc`+`build` passam.
- `sql/27_permissoes_fonte_unica.sql` (⚠️ **Anderson precisa rodar**): fecha os 2 buracos perigosos sem travar
  ninguém — (a) `permissoes` só admin escreve (fecha auto-promoção); (b) `medicamento_entregas` só admin apaga
  (histórico de doses). NÃO mexe em saude_fichas/med_controlados/med_agenda (a Saúde apaga em fluxo legítimo).
- Nota: hoje NÃO há grants de `editar` em equipes/escalas/cozinha/etc. na base (só `ver`); o conserto faz o
  toggle do Admin **passar a valer** quando o Anderson liberar. Teatro tem 1 grant `editar` com permitido=false
  (segue negado, correto). Decisão dele: "App manda, banco fecha só o perigoso" (não enrijecer RLS de tudo).
- **Verificação real pendente:** liberar no Admin "Equipes → editar" p/ uma equipe e um encontreiro dessa equipe
  confirmar que o botão de criar aparece. (Não dá pra testar no preview: dev server usa a sessão ADMIN do Anderson.)

### 🎯 TAREFAS ESCOLHIDAS PELO ANDERSON (fazer a seguir) — 2026-07-04
1. **Unificar o sistema de permissões** (dívida técnica raiz — causou o bug do "criar"). Há DUAS fontes:
   RLS usa `public.permissions` (EN: user_id/event_id/resource/action/allowed) via `has_permission(resource,action,event_id)`;
   o app usa `public.permissoes` (PT: role/person_id/team_id/modulo/acao/permitido) via `usePermissao.pode(modulo,acao)`.
   Nomes divergem: módulo `cadastros`/`encontristas`→tabela `people`, `equipes`→`teams`, `escalas`→`schedules`, etc.;
   ação `editar` (app) precisa cobrir `create`+`edit`(+`delete`) do RLS. `sql/24` só remendou o INSERT de `people`.
   → Escolher UMA fonte de verdade (recomendo `permissoes`), reescrever o RLS p/ ler ela, e auditar TODOS os módulos.
   Como a Claude NÃO roda SQL (só chave anon), comece por um SQL de DIAGNÓSTICO (listar policies + estrutura das
   tabelas) p/ o Anderson colar o resultado; depois planeje (AskUserQuestion) e entregue migrações + ajustes no app.
2. **Toasts/avisos amigáveis** ("Salvo!", "Sem internet", erros em PT) no lugar de `alert()` cru e saves silenciosos.
NÃO FAZER: **modo offline** — o Anderson NÃO quer (várias pessoas mexem ao mesmo tempo, inclusive no 3G; manter
sempre online/ao vivo; o realtime do cronograma pode continuar).

### 🔮 Próximos passos sugeridos (backlog priorizado)
Ver `docs/IDEIAS.md` (bloco "IDEIAS DE MELHORIA 2026-07-04"). Destaques: [ALTA] auditar RLS de INSERT dos outros
módulos (mesmo fix do sql/24); [ALTA] guardas de rota; [MÉDIA] publicar Edge Function admin-delete-user,
lembretes/push reais, credenciais em env var. Pendência do usuário: repro da tecla fantasma (#3b).

### SQLs — Anderson disse que **JÁ RODOU** os 3 (2026-07-04): `sql/21`, `sql/22`, `sql/23`. (Idempotentes; pode reconferir se algo falhar.)

### ⏳ PENDÊNCIAS reais
- **#3b — tecla fantasma "2"/"W"** ao abrir/fechar teclado criando equipe: **não há causa no código** (nenhum listener global de teclado). Precisa REPRO no celular dele: qual tela, qual campo, qual teclado (Gboard/SwiftKey/iPhone). Não fixar às cegas.
- **Opcional:** ícone PNG bonito pro PWA (hoje usa `favicon.svg`). Limitações assumidas: #6 push com app fechado precisa backend/cron (não tem servidor); #7 alarme nativo em lote não existe na web (por isso .ics).

---

## 📜 HISTÓRICO (sessões anteriores) — abaixo é contexto antigo, já concluído

## O que já foi feito em sessões anteriores (resumo)
- Correções: Ministrações (excluir/bugs), Ranking (votação inline por estrelas), Correio (padrinho só equipe Correio),
  Cadastros (código copia/WhatsApp), foto do admin, aprovação 3 cargos.
- Módulos: Logs/Auditoria; Eventos como raiz (auto-seed + export/import seletivo); Teatro Mídia; menu Mídia;
  **Crachá**; **Saúde/Medicamento contínuo** (ficha fonte única, motor de doses, Agenda/Histórico, hora de corte).
- Padrão visual virou regra (EmojiGrid, modal bottom-sheet, cards padrão Equipe, SubTabs, cor do sistema, "fechar volta pra origem").
- **Impressão/PDF (via PrintOverlay):** pessoas com foto; teatro; ministração; Logística como formulário manual.

---

## ✅ BACKLOG CONCLUÍDO (sessão seguinte)
- **BUG crachá** editar — corrigido (deselect só no fundo vazio, `e.target===e.currentTarget`).
- **Impressões**: Cozinha (detalhes), Cadastros (encontrista/encontreiro/os dois), Correio (checklist +
  "tem arquivo no app"), Cronograma (inteiro / detalhado sem status e sem local), Equipes (modular com fotos).
- **Crachá 3 modelos** (Encontreiros/Encontrista/Especiais), tamanho personalizado (mm/cm/px), PNGs em
  camadas, foto Redonda/Quadrada 3×4. Config por modelo em `crachas.campos.modelos` (jsonb, _v:2).
- **Ranking**: "Votar neste encontrista" abre direto na pessoa e volta pra origem ao fechar.

## 🆕 BACKLOG (histórico dos pedidos — todos já implementados acima)

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
