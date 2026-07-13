# HANDOFF — AXIS Eventos (para a próxima IA assumir)

> Atualizado no fim da sessão de 06/07/2026. Leia tudo antes de agir.

---
## 🔧 SESSÃO 12/07/2026 (Claude Opus) — 2 bugs críticos RESOLVIDOS e TESTADOS no app real

Outra IA estava mexendo no repo em paralelo — só commitei os arquivos abaixo, deixei o resto (WIP dela) intocado.

1. **Cadastros sumiam (salvava sem erro e não aparecia na lista).**
   - **Causa (auditando o banco REAL pelo Chrome):** havia um trigger `BEFORE INSERT` em `public.people` chamado **`trg_set_valor_pessoa`** (criado direto no banco, provavelmente pelo "cadastro modular" — NÃO estava no código) que preenchia `valor_total` mas **não retornava NEW** → em trigger BEFORE INSERT, retornar NULL **descarta a linha em silêncio**. Todo insert em people sumia.
   - **Conserto:** `sql/74_fix_trigger_cadastro.sql` = `drop trigger if exists trg_set_valor_pessoa on public.people;`. **JÁ RODADO** (por mim, via Chrome do Anderson). Verificado: trigger sumiu, insert de teste (em transação com rollback) retornou linha, count intacto (131). O app não usa `people.valor_total` (calcula de `events.valor_encontrista/encontreiro`).
   - ⚠️ **Se você recriar "cadastro modular", NÃO recrie esse trigger sem `RETURN NEW`.**

2. **Ao salvar a FOTO de perfil, o modal de cadastro fechava sozinho (só no PC).**
   - **Causa:** `src/hooks/useVoltarFecha.ts` (botão voltar fecha modal). Em modal-dentro-de-modal (RecortarFoto sobre o Pré-cadastro), o hook liberava a trava `limpando` num `setTimeout(0)`. Como `history.back()` é **assíncrono**, no PC o timeout rodava ANTES da `popstate` do back() → o "voltar" vazava pro modal de baixo e fechava ele.
   - **Conserto (commit `c1f0da9`):** a trava agora é liberada **só quando a `popstate` do próprio `back()` chega** (com rede de segurança de 300ms). Vale pra QUALQUER modal-dentro-de-modal. **Testado no app real:** salvar a foto mantém o Pré-cadastro aberto. ✅

**Novo no fluxo de trabalho:** o Anderson me autorizou a **rodar SQL eu mesmo** pelo **Chrome logado dele** (SQL Editor do Supabase) e a **testar no app** (com `?web=1` pra pular a trava de instalação PWA). Se VOCÊ (outra IA) não tiver esse acesso ao Chrome, continue entregando `sql/NN` pra ele rodar — mas o `sql/74` já foi aplicado.

**Observação menor (não urgente):** o **Excluir** em `Cadastros` usa `window.confirm` nativo. Pra usuário real funciona; só travou minha automação (CDP não alcança dialog nativo). Existe um `components/Confirmar.tsx` (dialog in-app) que poderia substituir — polimento opcional.

### Testes de 2 sessões (admin + anônimo) — feitos 12/07, tudo OK
Testei com o Chrome logado (admin) + navegador anônimo (sem login) o fluxo do convite ponta a ponta: admin gera código → anônimo abre `?codigo=` → tela "Primeiro acesso" carrega o pré-cadastro ("Olá, {nome}!") → foto/recorte funcionam no primeiro acesso também (não fecha) → `Concluir cadastro` NÃO foi clicado (não crio conta/senha). Segurança OK: anônimo em `/` e `/cadastros` cai no login. Dados de teste apagados; auditoria (`public.audit_logs`) confirma que só as MINHAS linhas de teste foram deletadas — nenhuma pessoa real.

### 🐛 ACHADO em aberto — link `?codigo=` não preenche o campo
No fluxo de convite, abrir `https://.../?codigo=XXXXXXXX` **muda pra aba "Primeiro acesso" (certo)** mas **NÃO preenche** o campo do código — o usuário ainda tem que digitar. O item 10 deste handoff dizia que era pra vir preenchido. Ver `src/pages/Login.tsx` (leitura de `?codigo=`): provável que o `useSearchParams`/redirect esteja perdendo a query, ou o efeito não seta o input antes do submit. **Não corrigi ainda** (perguntei ao Anderson se quer). Pequeno, mas tira a comodidade do convite por link.

### Preferências novas do Anderson (12/07)
- Quando for **mais rápido** e não precisar do login dele, posso usar meu **navegador próprio** (não o Chrome logado).
- Ele me autorizou **rodar SQL e testar no app** eu mesmo pelo Chrome logado dele (ver `sql/74` já aplicado).

### 🐛 DIAGNÓSTICO (Anderson reportou 12/07) — cadastro por CÓDIGO perde os dados
Sintomas dele: (1) ao aprovar, as informações do cadastro **não vêm** (foto some também); (2) devolveu o cadastro pra pessoa refazer, mas: **2.1** o cadastro devolvido **não fica visível pro admin ver**; **2.2** pra pessoa aparece só a **mensagem** de recusa, os **dados somem** e ela **não consegue reenviar**.

**Causa provável (NÃO corrigida — deixei pra quem está na área de cadastro/RLS):** o pré-cadastro (admin) cria a linha em `people` com `user_id` NULL + `invite_code`. Ao completar pelo código, `Login.tsx:317` faz `people.update({user_id: uid, ...dados}).eq('id', pessoa.id)`. Se a **policy de UPDATE de `people`** exigir `user_id = auth.uid()` no USING, o usuário novo (uid) **não "casa"** com a linha (user_id ainda NULL) → o UPDATE atinge **0 linhas em SILÊNCIO (sem erro)** → `user_id`/dados nunca gravam. Daí: admin não vê dados (1/2), e `Pending.abrirRefazer` (busca `people` por `user_id`) volta vazio → 2.2.
- **Verificar:** a policy de UPDATE em `public.people` (USING/WITH CHECK). 
- **Correção sugerida:** permitir "reivindicar" a linha órfã — USING `user_id = auth.uid() OR user_id IS NULL` + WITH CHECK `user_id = auth.uid()`; OU uma RPC SECURITY DEFINER (padrão do `reenviar_meu_cadastro`) que faz o vínculo. Confirmar rodando um cadastro real por código e conferindo se `people.user_id`/dados gravaram.
- **2.1 (admin ver o recusado):** a lista de cadastros/aprovação some com quem está `rejected`; manter visível um filtro "Recusados" pro admin reabrir.

### Item 3 — botão "Unificar com duplicado" (mesclar contas) não funciona
Fica em `Admin.tsx:1504` (`merge_type` "Unificar com duplicado"). Anderson diz que não funciona. **Eu (Claude) vou olhar esse** — é fora dos seus arquivos de cadastro.

### Correio — arquivos de padrinho→afilhado (Claude vai fazer)
Pedido: encontreiro **padrinho** pode pôr/excluir arquivo no **afilhado**; TODOS os padrinhos daquele afilhado + o líder veem os mesmos arquivos. Tabelas já existem (`correio_padrinhos`, `correio_arquivos`). Provável faltar **RLS** deixando o padrinho (não só líder) INSERT/SELECT/DELETE em `correio_arquivos` do seu afilhado. **Eu (Claude) assumo esse.**

---

## 0. Como trabalhar aqui (REGRAS do usuário — Anderson)
- **Não programador.** Fale 100% em **português**, simples, sem jargão. Listas numeradas curtas para as ações DELE; caixa de seleção (AskUserQuestion) para decisões de produto.
- **App é 98% MOBILE.** Sempre mobile-first.
- **Autonomia total:** pode editar e commitar sem pedir a cada passo. Salvar/commitar com frequência.
- **Preview antes de construir** componente novo (mostrar mockup e aprovar).
- **Padrão visual:** ver `docs/PADRAO-VISUAL.md`. Cards = componente `CardItem`. Modais = bottom-sheet. "Fechar volta pra origem".
- **Ideias** vão em `docs/IDEIAS.md`.

## 1. Stack e deploy
- React + Vite + TypeScript + Supabase (Postgres/Auth/Storage) + Vercel. PWA.
- **Branch de trabalho:** `feat/axis-melhorias-sessao` (está SINCRONIZADA com `main` — fast-forward).
- **Deploy = push na `main`** → Vercel publica sozinho. Fluxo que usei:
  ```
  git add ... && git commit -m "..."
  git checkout main && git merge feat/axis-melhorias-sessao --ff-only && git push origin main
  git checkout feat/axis-melhorias-sessao
  ```
- **Confirmar deploy:** `curl -s https://api.github.com/repos/Afrauzino/axis-eventos/commits/<SHA>/status` → procurar `"context":"Vercel"` com `"state":"success"`.
- Produção: **axis-eventos-sage.vercel.app** (aliases: axis-eventos-axis-eventos.vercel.app). Preview da branch: axis-eventos-git-feat-axis-melhorias-sessao-axis-eventos.vercel.app
- Commits terminam com `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

## 2. Banco / SQL (IMPORTANTE)
- **A IA NÃO roda SQL** (só chave anon). Entregue arquivos em `sql/NN_nome.sql` e peça pro Anderson rodar no **Supabase → SQL Editor**.
- SQLs já entregues nesta sessão e o status:
  - `sql/32_teatro_blocos_capa.sql` — **RODADO** (theaters.foto_url, capa_url; teatro_cenas.blocos/personagens/objetos jsonb).
  - `sql/33_teatro_ordem.sql` — **RODADO** (theaters.ordem).
  - `sql/34_ministracao_ordem.sql` — **provavelmente NÃO rodado** (o código já é resiliente sem ele; a coluna `ministrações.ordem` só é necessária pra gravar a reordenação). Tabela é `public."ministrações"` (com acento).
- Sempre use `add column if not exists`. Código deve ser **resiliente** se o SQL não foi rodado (ver o caso das ministrações que sumiram — item 6).

## 3. Como criei dados em massa (teatros) — padrão reutilizável
Não dá pra rodar SQL, mas dá pra **inserir via a sessão logada do Anderson no navegador** (preview MCP tools). Padrão:
```js
// preview_eval no serverId ativo (mcp__Claude_Preview__preview_eval)
const m = await import('/src/lib/supabase.ts'); const s = m.supabase;
await s.from('theaters').insert({...}) // RLS admin permite
```
- **event_id ativo:** `c51931b1-029f-472b-93a4-42af430ca58e` ("Encontro 2026", 24–26/jul/2026).
- **serverId do preview** muda por sessão — pegar com `mcp__Claude_Preview__preview_list`.
- Screenshots do preview às vezes dão timeout; use `preview_eval` lendo `document.body.innerText` pra verificar.
- **Cuidado:** isso mexe em dados REAIS de produção (mesmo banco). Confirme antes de deletar.

## 4. O que foi feito nesta sessão (tudo em produção)
1. **CardItem** padronizado (foto 64px centralizada, ⋮ com Editar/Excluir, barra de progresso). Migrado Equipes, Saúde, TeatroDetalhe, etc.
2. **Barra de data (semana)** — componente `src/components/BarraData.tsx`: fita de dias, abre **centralizada no evento**, dias do evento habilitados, resto travado. Aplicada em **Cronograma** e **Escalas** (únicas com navegador de dia).
3. **Ranking** ganhou a ⚙️ (filtro de categoria).
4. **Correções de layout:** vão header→conteúdo (era `.page` com padding-top de header fixo, mas header é flex); rolagem "fantasma"; FAB/modais que grudavam no `<main>` (removido `transform:translateZ(0)` do main).
5. **Escala/checklist:** MinhasAtividades agora busca `escala_checklist` (não buscava) → o liderado vê e marca os itens, com barra de progresso dentro e fora.
6. **Teatro:** capa/foto (AvatarPicker + capa), cenas em **blocos** tipados (Fala/Deixa/Ação/Trilha/Observação/Foto) com RichEditor, vários personagens/objetos por cena, Excluir (desvincula cronograma_eventos/cenas/elenco/midias antes), reordenar teatros (⋮), impressão renderiza os blocos.
7. **Ministração:** bloco **Arquivo** (PDF/Word) — PDF/imagem abrem em **tela cheia** (visor), Word abre em nova aba. Reordenar ministrações (⋮).
8. **Cronograma:** selo **🎭 Teatro: X** clicável quando o item tem teatro (puxa pela ministração ou direto).
9. **Padronização do VÍNCULO ministração↔teatro:** agora **SÓ no Cronograma**. Removidos os seletores de vínculo das telas de Teatro e Ministração. No Cronograma, ministração+teatro convivem no mesmo item; cada um só entra 1x (os já usados somem da lista). Handlers `onSelectMinistracao/onSelectTeatro` NÃO trocam mais o `tipo`.
10. **Primeiro acesso por link:** mensagem do código (Cadastros + template Admin via `{link}`) inclui `${origin}/?codigo=CODE`; Login lê `?codigo=` e abre na aba "Primeiro acesso" preenchido.
11. **Botão Voltar universal** no cabeçalho (`BotaoVoltar` em `src/App.tsx`) — aparece em todas as telas menos a inicial, faz `navigate(-1)`.
12. **10 teatros criados** do PDF "TEATROS - ENCONTRO (COMPLETO)" com cenas fiéis (blocos + personagens sem ator). event_id acima. Personagens globais reaproveitados (IDs em `personagens_globais`).

## 5. ✅ CONCLUÍDO (deploy bd5a3be) — data/hora amarrada ao evento
> Parte 3 (editar traz hora SALVA): trocado `toISOString().slice(0,16)` por `toLocalInput()` em
> Cronograma/Escalas/Ministracoes/FichaMedica. Partes 1-2: `DataHora` ganhou `min`/`max` (trava dias fora
> do período e abre no mês do evento); aplicado em Cronograma e Escalas (`min={evento.start_date} max={evento.end_date}`).
> Cadastro/Financeiro/Saúde/Admin ficaram livres de propósito. (Detalhe histórico abaixo.)
**Pedido do Anderson (3 partes):**
1. Toda data/hora amarrada ao período do evento (start_date/end_date), incl. telas com calendário.
2. Telas de calendário centralizam no evento.
3. **Ao editar, trazer a hora SALVA, não a hora atual.**

**O que já descobri:**
- Componente central: `src/components/DataHora.tsx` (date/time picker próprio; modos date/time/datetime; valor 'YYYY-MM-DDTHH:MM' LOCAL).
- **BUG da parte 3 (achado, NÃO corrigido ainda):** em `src/pages/Cronograma.tsx` função `abrirEdicao` (~linha 240-241):
  ```js
  hora_inicio: new Date(item.hora_inicio).toISOString().slice(0,16),  // ❌ toISOString = UTC, desloca a hora
  ```
  **Correção:** montar em horário LOCAL, ex.:
  ```js
  const toLocal = (iso) => { const d=new Date(iso); const p=(n)=>String(n).padStart(2,'0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}` }
  ```
  **Verificar `Escalas.tsx` (abrirEdicao de escala)** — provavelmente tem o MESMO `toISOString().slice(0,16)`. Corrigir igual.
  (Obs.: procurei `nowLocalInput` em Cronograma e não achei definição local — ver se vem de `utils` ou está inline; Cronograma usa `nowLocalInput()` no FAB ~linha 373.)

**O que FALTA fazer (partes 1 e 2):**
- Adicionar props opcionais `min?` e `max?` (YYYY-MM-DD) no `DataHora`, e:
  - Desabilitar dias fora de [min,max] no calendário.
  - `view` inicial e dia padrão (quando sem valor) = **início do evento** (não `hoje`). Hoje o `abrir()` usa `new Date()` (linha 78-81) — trocar pra clampar no evento quando min/max existir.
- Passar `min={evento.start_date} max={evento.end_date}` **só nas telas de AGENDA**: `Cronograma.tsx` (~linha 522) e `Escalas.tsx` (~linhas 393/397). Ambas já têm `evento` do hook `useEvento`.
- **NÃO amarrar** onde não é agenda: `CadastroPessoa.tsx` (birth_date = aniversário!), `Financeiro` (data_pagamento), `SaudeConfig`, `FichaMedica`, e o próprio `Admin` (start/end do evento — é a definição do evento). Ou seja: manter opt-in por prop.
- Telas de calendário "centralizam no evento": o `BarraData` já faz. O `DataHora` passa a abrir no mês do evento com min/max.

## 6. Bug recente resolvido (aprender com ele)
As ministrações "sumiram" porque mudei a query pra `.order('ordem')` e a coluna (sql/34) não existia → a consulta dava erro e voltava vazia. **Lição:** não ordene por coluna de migração não garantida na query; ordene por coluna segura e faça o sort no cliente. Já corrigido em `Ministracoes.tsx` (ordena por titulo na query, por `ordem` no cliente com nulos por último). **O mesmo risco existe no TeatroLista** (usa `.order('ordem')` na query) — funciona porque sql/33 foi rodado, mas se quiser blindar, aplicar o mesmo padrão.

## 7. Pendências / ideias soltas
- Terminar a tarefa do item 5 (data/hora amarrada + editar traz salvo).
- Nomes de ministrações com **espaço no início** (" Ampliamos...", " Cura interior") e duas de "Batismo" — Anderson pode querer limpar/juntar (perguntar).
- Vínculos antigos teatro↔ministração (theaters.ministracao_id) continuam no banco; se quiser 100% pelo cronograma, limpar (perguntar antes).
- Impressão do Teatro/Ministração: revisar se os blocos novos saem 100% na impressão.

## 7b. ✅ RESOLVIDOS (deploy 990cedc) — bugs de cadastro real
> Bug A: `criarConta` (Login) agora mostra **toast** (visível em qualquer scroll) + rola pro topo quando falta
> foto/campo obrigatório. Bug B: lista "Adicionar membro" (Equipes) mostra **foto** (não só iniciais).
> Texto original mantido abaixo p/ referência.

### Bug A — "Menor de idade trava na tela de cadastro" (ALTA prioridade)
- Tela: **Primeiro acesso → completar cadastro** (`src/pages/Login.tsx`, função `criarConta`, usa `components/CadastroPessoa.tsx`).
- **Causa diagnosticada:** `criarConta` valida campos obrigatórios (Login.tsx ~linhas 98-104): **foto obrigatória** (`if (!form.photo_url) setErro('A foto é obrigatória.')`), nome, celular, email, senha. Quando falha, faz `setErro(...)` mas o **erro aparece no TOPO do formulário**. Como o usuário está rolado lá embaixo (endereço/evento/observações), ele **não vê o erro** e parece que o botão "não faz nada" (trava).
- **Não é exclusivo do menor** — é qualquer submit sem foto/campo obrigatório; só foi notado no fluxo do menor.
- **Correção sugerida:** ao falhar validação, **rolar até o erro** (ou mostrar um `toast`), e/ou colocar a mensagem de erro perto do botão Enviar. Confirmar que o fluxo do menor (dados do responsável) salva certo. Testar o cadastro inteiro de um menor de ponta a ponta.

### Bug B — "Correio não traz imagem"
- O **Correio** (`src/pages/Correio.tsx`) JÁ usa `photo_url` (componente `Avatar` ~linha 480 e `CardItem fotoUrl`) — mostra foto de quem tem. Provável que o usuário se refira à lista **"Adicionar membro" da Equipe** (`src/pages/Equipes.tsx`, modal `modalMembro`), que renderiza **só as iniciais** (`getInitials`), sem `photo_url`.
- **Correção sugerida:** no modal "Adicionar membro" da Equipes, trocar o avatar de iniciais por foto quando `p.photo_url` existir (igual ao `Avatar` do Correio). Confirmar com o Anderson QUAL tela exatamente ("correio" pode ser o módulo Correio ou a lista de pessoas) — mas o mais provável é a lista de adicionar membro mostrando iniciais em vez de foto.

## 8. Arquivos-chave
- `src/components/CardItem.tsx`, `BarraData.tsx`, `DataHora.tsx`, `RichEditor.tsx`, `AvatarPicker.tsx`
- `src/lib/chrome.tsx` (⚙️ do topo: `useRegistrarChrome`/`useRegistrarChromeNav`), `BotaoConfig.tsx`
- `src/App.tsx` (shell + header + `BotaoVoltar`), `src/pages/Cronograma.tsx`, `Escalas.tsx`, `Ministracoes.tsx`, `TeatroLista.tsx`, `TeatroDetalhe.tsx`, `MinhasAtividades.tsx`, `Login.tsx`, `Cadastros.tsx`, `Admin.tsx`
- Memória do usuário (padrões/regras): `~/.claude/projects/.../memory/` (índice em MEMORY.md).
