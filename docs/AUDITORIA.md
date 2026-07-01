# AXIS — Auditoria do Sistema (menus, telas, permissões, fluxos)

> Baseada no material existente (conversa original + código atual). Não cria padrões novos:
> apenas organiza, corrige inconsistências e documenta o que já foi decidido.
> Padrão visual: ver `docs/PADRAO-VISUAL.md`. Pendências de features: `docs/PENDENCIAS.md`.

---

## 1. Estrutura final de MENUS e SUBMENUS

Gaveta (menu lateral, fundo branco + emoji colorido). Submenus = abas no topo da página (`SubTabs`).

| # | Menu (emoji) | Rota / Submenus | Tela(s) |
|---|---|---|---|
| 1 | 🏠 Início | `/` | Dashboard |
| 2 | ✅ Minhas Atividades | `/minhas-atividades` | MinhasAtividades |
| 3 | 📅 Cronograma | `/cronograma` | Cronograma |
| 4 | 👥 Encontristas | `/encontristas` | Encontristas |
| 5 | 📝 Cadastros | `/cadastros` | Cadastros |
| 6 | 🎤 Ministrações | `/ministracoes` (+`/ministracoes/:id`) | Ministracoes |
| 7 | 🏆 Ranking | `/ranking` | Ranking |
| 8 | 📬 Correio | `/correio` | Correio |
| 9 | 📦 Logística | `/logistica` | Logistica |
| 10 | 🎬 Mídia | `/midia` | Midia (abas Mídia/Arquivos) |
| 11 | 📢 Alertas | `/alertas-lideres` | AlertasLideres |
| 12 | 🍴 Cozinha | `/cozinha` | Cozinha (Cardápio) |
| 13 | 🛡️ Equipes & Escalas | `/equipes` · `/escalas` | Equipes, Escalas |
| 14 | 🎭 Teatro | `/teatro` · `/teatro/atores` · `/teatro/personagens` · `/teatro/objetos` | TeatroLista, TeatroAtores, TeatroPersonagens, TeatroObjetos (+`/teatro/:id` TeatroDetalhe) |
| 15 | 📍 Evento | `/locais` · `/ocorrencias` | Locais, Ocorrencias |
| 16 | ⛑️ Saúde | `/saude` · `/saude/ficha` · `/saude/medicamentos` | Saude, SaudeFicha, Medicamentos |
| 17 | 💰 Financeiro | `/financeiro` · `/doacoes` | Financeiro, Doacoes |
| 18 | ⚙️ Administração | `/admin` · `/admin/permissoes` · `/admin/menus` · `/admin/saude-sistema` · `/relatorios` | Admin, PermissoesAdmin, MenusAdmin, SaudeSistema, Relatorios |
| — | 👤 Meu Perfil | `/perfil` (rodapé) | Perfil |
| — | 🚪 Sair | logout (rodapé) | — |

**Fora do menu, mas telas válidas (acessadas por outro caminho):**
- `/alertas` (Alertas) — avisos gerais, acessado pelo **Dashboard** e **Minhas Atividades**.
- `/teatro/:id` (TeatroDetalhe) — aberto ao clicar num teatro.
- `/ministracoes/:id` — aberto pelo Cronograma.
- `/perfil` — pelo avatar no cabeçalho.
- Auth: `/` cai em Login (sem sessão) ou Pending (aguardando aprovação).

---

## 2. Lista final de TELAS VÁLIDAS
Dashboard · MinhasAtividades · Cronograma · Encontristas · Cadastros · Ministracoes ·
Ranking · Correio · Logistica · Midia · AlertasLideres · Alertas · Cozinha · Equipes ·
Escalas · TeatroLista · TeatroAtores · TeatroPersonagens · TeatroObjetos · TeatroDetalhe ·
Locais · Ocorrencias · Saude · SaudeFicha · Medicamentos · Financeiro · Doacoes ·
Admin · PermissoesAdmin · MenusAdmin · SaudeSistema · Relatorios · Perfil · Login · Pending ·
PrimeiroAcesso · (componentes: CadastroPessoa, Encontreiros, EncontristasCadastro, ConfigCor).

---

## 3. PERMISSÕES por perfil

Modelo real (código `hooks/usePermissao.ts` + tabela `permissoes`):
- Permissão = (cargo **ou** pessoa **ou** equipe) × `modulo` × `acao` (`ver`/`criar`/`editar`/`excluir`).
- **Admin tem TUDO.** Demais recebem acesso por **equipe** (acumulativo) **+ individual**.
- Regra: **"editar implica ver; ver não implica editar."**
- Menu só aparece se `admin` OU permissão `menu_<x>` liberada (por equipe/pessoa).

| Perfil | Ver | Criar | Editar | Excluir |
|---|---|---|---|---|
| **Admin / Pastor Presidente** | tudo | tudo | tudo | tudo |
| **Visitante** (não aprovado) | nada (tela Pending) | — | — | — |
| **Encontreiro (aprovado)** | cronograma, nomes/fotos, suas escalas/atividades | conforme equipe/individual | conforme equipe/individual | não |
| **Líder / Co-líder** | + tudo da(s) sua(s) equipe(s); aprova escalas | da sua equipe | da sua equipe | conforme liberação |
| **Equipe Financeiro** | valor individual + status | pagamentos | pagamentos | não (sem total geral/relatório) |
| **Equipe Saúde** | fichas/medicamentos | registros de saúde | saúde | histórico nunca é apagado |
| **Equipe Correio** | seus afilhados | — | checklist/arquivos | — |
| **Equipe Logística** | encontristas + checklist | marca checklist | ficha médica ligada | — |
| **Equipe Teatro** | teatros/cenas/elenco | conforme liberação | conforme liberação | conforme liberação |

Onde se define: **Administração → Equipes** (liberações por equipe) e **Administração → Usuários → (pessoa) → Liberações** (individual). Cargos de aprovação foram simplificados para **Visitante / Encontreiro / Administrador** (decisão do Anderson); o resto do controle é por equipe/individual.

---

## 4. VÍNCULOS e FLUXOS entre telas
- **Cronograma** é o centro: um item pode abrir **Ministração** (`/ministracoes/:id`) e **Teatro** (`/teatro/:id`) vinculados; puxa local e ministrante.
- **Ministração ↔ Teatro**: vínculo mútuo (1 teatro por ministração); cada tela abre a outra.
- **Dashboard / Minhas Atividades → Alertas** (`/alertas`).
- **Logística → Ficha médica** (`/saude/ficha`) quando "toma remédio contínuo? = Sim".
- **Correio**: padrinho (equipe Correio) → afilhados (encontristas) com checklist.
- **Cadastro único de pessoa**: a mesma pessoa é reusada em equipes, teatro, saúde, financeiro, escalas, ranking, logística.
- **Administração**: Usuários ↔ Permissões ↔ Menus ↔ Saúde do Sistema ↔ Relatórios (abas).

---

## 5. ERROS ENCONTRADOS e CORREÇÕES (aplicadas nesta auditoria)

| Problema | Correção | Resultado esperado |
|---|---|---|
| Sub-itens de **Administração** ficaram inacessíveis após a gaveta virar plana (só ia pro 1º) | Adicionado `SubTabs group="admin"` em Admin/Permissões/Menus/Saúde do Sistema/Relatórios | Navegação por abas entre as telas de Admin, como nos outros grupos |
| **Permissões** (`/admin/permissoes`) era rota órfã (sem link) | Incluída no submenu de Administração | Tela de permissões agora acessível |
| Título do cabeçalho de `/alertas` era **"Evento"** (errado) | Corrigido para **"Alertas"** | Cabeçalho coerente com a tela |
| Sub-rotas sem título (Teatro/Saúde/Ocorrências/Doações/Relatórios/Admin) caíam em "AXIS Eventos" | Títulos adicionados no `TITULOS_ROTA` | Cabeçalho sempre com o nome da página |
| `TITULOS_ROTA['/medicamentos']` apontava rota inexistente (a real é `/saude/medicamentos`) | Chave corrigida | Título "Medicamentos" aparece na rota certa |
| `Agenda.tsx` e `Pessoas.tsx` — telas mortas (sem rota/menu/import) | Removidas | Menos código morto/confusão |
| `Alojamento.tsx`, `Teatro.tsx` (stub) — mortos | Removidos (sessões anteriores) | — |
| Teatro/Locais usavam emoji de **ícone de linha** | Trocado pela grade de **emoji colorido** | Padrão visual respeitado |

### Pontos sinalizados (decisão sua, não alterei)
- **Dois conceitos de "Alertas"**: `Alertas` (`/alertas`, avisos gerais no Dashboard) e `AlertasLideres` (`/alertas-lideres`, no menu). Funcionam, mas o nome se repete. Sugestão (a confirmar): renomear um para "Avisos"/"Comunicados". **Não mexi** para não mudar decisão.
- **Cozinha × Cardápio**: menu "Cozinha", conteúdo "Cardápio" — combinado assim na conversa. Mantido.

---

## 6. FLUXO GERAL DO SISTEMA
1. **Evento é a raiz.** Ao criar, gera equipes/ranking/locais padrão. Só um ativo por vez (troca em Administração → Eventos).
2. **Pessoa** é cadastrada uma vez e reusada em todos os módulos.
3. **Acesso**: entra → se não aprovado, tela Pending → admin/líder aprova (Visitante/Encontreiro/Admin) → recebe menus/ações por equipe e individual.
4. **Operação do encontro**: Cronograma conduz (ministrações, teatros, refeições/cardápio, pausas), com escalas, cronômetro e alertas em tempo real.
5. **Apoio**: Saúde (fichas/medicamentos/contínuo via Logística), Financeiro (pagamentos/doações), Correio (padrinhos), Ranking.
6. **Administração**: usuários, permissões, menus, tipos, backup (export/import seletivo), logs/auditoria, aparência (cor do sistema).
7. **Encerramento**: finalizar evento (marca encerrado; congelar edição é pendência) + exportar backup.
