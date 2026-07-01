# AXIS Eventos — Especificação e Pendências

> Documento reconstruído a partir da conversa original do projeto (export do Claude,
> conversa "gestão de eventos religiosos", 1069 mensagens) + varredura do código atual.
> Serve como fonte de verdade do que já existe e do que falta construir.

---

## 1. Padrão de layout ("leyaut padrão")

Regras de aparência que TODA tela e TODA caixa de criar/editar deve seguir:

- **Mobile-first**, estilo Notion/Linear. 90% celular, 10% computador.
- **Cards com fundo branco.**
- **Menu lateral:** fundo branco, **emojis coloridos** (opção "B"), ícones por item.
  A **cor de seleção** do menu = a **cor do sistema** definida em Administração → Aparência
  (não fixar verde/turquesa no código).
- **Ministrações e cards em geral** usam o emoji definido no padrão.
- **Tempo em formato de relógio** (ex: `1:30`), nunca "90 min".
- Submenus abrem em painel secundário (ex: Teatro → Atores / Objetos / Personagens / Teatros).

## 2. Regras de trabalho (como o Anderson quer que eu trabalhe)

- **Fazer de 2 em 2 telas**, seguindo a ordem do menu (mas posso indicar qual é melhor primeiro).
- **Ao iniciar cada tela, sempre checar:** bugs, inconsistências e duplicidade.
- **Corrigir erros junto com a criação** — ao mexer numa tela, já arrumo as pendências dela.
- "Tudo que funciona não será tocado. Exceção: o que tem erro, aí conserta."
- Amarrar item a item, deixando cada um pronto antes de seguir.
- Confirmar o menu inteiro e todas as funções (criar/editar) no padrão.

## 3. Regras de negócio centrais

- **Tudo isolado por evento** (`event_id` em tudo, RLS obrigatório). Nada atravessa eventos.
- **Cadastro único de pessoa** — a mesma pessoa é reusada em todos os módulos (equipes, teatro,
  saúde, financeiro, escalas, etc.). Sem duplicar.
- **Encontristas** = quem recebe as ministrações. **Encontreiros** = servos/obreiros.
- **Aprovação:** usuário só acessa após aprovação de admin/líder.
- **Hierarquia:** Visitante → Aprovado → Líder/Co-líder → Financeiro → Secretaria → Admin
  (Pastor Presidente = Admin).
- **Ministrante** tem anotações pessoais privadas (só ele vê, nem admin).
- **Financeiro:** admin vê tudo; equipe Financeiro vê só valor individual + status (sem totais).
- **Alojamento foi descartado** → virou o módulo **Locais** (cozinha, sala de oração, banheiros…),
  com "alojamento" apenas como um *tipo* de local. Distribuição por cama NÃO é prioridade.
- **Correio — padrinhos:** SÓ integrantes da **equipe Correio** (líder, co-líder e membros)
  podem ser definidos como padrinho de um encontrista.

---

## 4. O que JÁ existe (construído)

Dashboard · Minhas Atividades · Cronograma · Encontristas (+cadastro) · Cadastros ·
Equipes · Encontreiros · Ministrações · Teatro (Lista/Detalhe/Atores/Objetos/Personagens) ·
Locais · Saúde (+ficha, medicamentos, saúde do sistema) · Alertas · Alertas de Líderes ·
Ocorrências · Financeiro · Escalas (com checagem de conflito) · Cozinha/Cardápio · Correio
(padrinhos/afilhados) · Ranking · Relatórios (export CSV/JSON) · Doações · Admin
(Usuários/Cargos/Permissões/Eventos/Tipos/Backup/Aparência) · Perfil · Login/Aprovação.

---

## 5. O que FALTA construir / completar

### Alta prioridade (regras do spec ainda não atendidas)
- [~] **Logs / Auditoria** — BASE PRONTA (sessão Claude Code). Falta: rodar `sql/05_audit_logs.sql`
      no Supabase + instrumentar mais ações (fazer junto da padronização de cada tela).
      Já registra: aprovar usuário, excluir cadastro, exportar backup. Viewer em Administração → Logs.
- [x] **Backup exportar/importar seletivo** — FEITO. Export por seções (checkboxes) + Import
      cria um novo evento inativo remapeando ids. Falta (opcional): backup automático.
- [x] **Eventos como raiz** — FEITO. Ao criar evento, auto-cria equipes/ranking/locais/checklist do Correio.
      Só um evento ativo por vez. Navegar/trocar em Administração → Eventos ("Tornar ativo").
- [ ] **Finalizar Encontro de verdade.** Hoje só marca status "encerrado". Falta congelar/bloquear
      edição quando o evento está `finished` (esconder botões editar/salvar nas telas).
- [ ] **Escala — solicitação de alteração.** Usuário comum não edita escala, apenas
      *solicita*; líder aprova/recusa e pode substituir. (Tabela `escala_solicitacoes` + UI.)

### Média prioridade
- [ ] **Padronização de layout** faltando revisar tela a tela (menu, todas as caixas de
      criar/editar no padrão da seção 1). Já foram padronizados: Cadastros, Minhas Atividades,
      menu lateral, Cronograma, Ministrações. Falta confirmar o restante.
- [ ] **Cronograma puxa pessoas da escala** do mesmo horário automaticamente (sem seleção manual).
- [ ] **Histórico da pessoa** (`pessoas_historico`) — participação por evento visível no cadastro.
- [ ] **Relatórios em PDF/Excel** (hoje é CSV/JSON).

### Features novas (lote WhatsApp 30/06)
- [x] **Teatro → Mídia (por link de nuvem)** — FEITO. Aba Mídia em cada teatro: fotos, áudios e
      vídeos por LINK (Google Drive, Mega, YouTube…). Não ocupa disco do Supabase.
      Precisa rodar `sql/06_teatro_midias.sql`.
- [ ] **Checklist de iniciação individual (por pessoa)** — DECISÃO: fica DENTRO de Encontristas
      (botão/checklist no cadastro de cada encontrista). Ao iniciar, seleciona a pessoa e preenche:
      - Objetos (marcar vários): Colchão, Roupa de cama, Travesseiro, Remédios, Carteira, Celular,
        Relógio, Produtos alimentícios, Tablet, Notebook, Outros.
      - Pergunta: "qual a última vez que tomou remédio?" (data/hora).
      - Regra saúde: perguntar se toma **remédio controlado** (sim/não). Se sim e já preencheu a
        ficha de saúde no cadastro → puxa do cadastro e libera informar a última hora tomada.
        Se ainda não preencheu → obriga preencher a ficha de saúde ali para concluir.
      - Integração: a última hora tomada + o intervalo (ex: dipirona 8/8h) alimenta o sistema
        automático de **Medicamentos** (gera os próximos horários). Precisa nova tabela + integrar
        com med_agenda/med_controlados. Vincular à data do evento.
- [ ] **Crachá — preenchimento automático** — DECISÃO: modelo "fundo + campos por cima". Admin
      sobe uma imagem de fundo do crachá e o sistema posiciona nome/foto/equipe/evento por cima,
      gerando um crachá por pessoa (para impressão). Precisa: tabela de template (url do fundo +
      posições dos campos) + tela de geração.
- [ ] **Terminar padronização de layout** — ex: Teatro estava fora do padrão (melhorado com a aba Mídia).

### Baixa prioridade / limpeza
- [ ] **Remover código morto:** `src/pages/Alojamento.tsx` (substituído por Locais) e
      `src/pages/Teatro.tsx` (stub antigo, substituído por TeatroLista e telas de Teatro).
- [ ] Verificar telas órfãs não roteadas (`Agenda.tsx`, `Pessoas.tsx`) — usar ou remover.

---

## 6. Já feito nesta sessão (Claude Code, local)
- **Ministrações:** excluir corrigido (desvincula teatro + cronograma antes; mostra erro se falhar);
  removido bloco "Teatro vinculado" duplicado; corrigida aba "Minhas notas" do ministrante;
  id do insert agora vem direto (sem risco de vincular teatro errado).
- **Ranking:** clicar na pessoa abre modal com todas as categorias, votos recebidos e
  votação inline por estrelas (sem botão "votar").
- **Correio → Definir padrinhos:** barra de pesquisa por nome + seleção de vários +
  **regra corrigida:** só integrantes da equipe Correio podem ser padrinho.
- Removida pasta duplicada `frontend/`.
- **Menu:** submenus viraram abas no topo da página (padrão Admin) via `SubTabs` + `navGroups`;
  gaveta ficou plana. Grupos: Equipes/Escalas, Teatro(4), Evento(Locais/Ocorrências), Saúde(3), Financeiro(2).

---

## 7. LOTE NOVO DE PEDIDOS (a fazer) — WhatsApp/sessão atual

### Correções ao que foi feito
- [x] Auto-seed: **não** criar mais o checklist do Correio automaticamente (feito).
- [ ] **DECISÃO MUDOU:** o "Checklist de iniciação" NÃO fica em Encontristas — vai para um
      **novo menu "Logística"** (ver abaixo).
- [ ] **Remover medicamentos do formulário de cadastro** — isso passa a ser feito junto do
      checklist da Logística.
- [ ] **Bug:** criei um perfil, tornei admin, criei evento e ativei — a **foto do admin não apareceu**.
      Investigar (provável: fallback de foto em `loadProfile` / troca de evento).

### Menu Logística (novo)
- [ ] Criar **menu "Logística"**. Dentro: lista de **todos os encontristas** + uma aba (igual ao
      Correio) para **configurar o checklist**. Ao clicar num encontrista, abre o checklist dele:
      - Objetos (marcar vários): Colchão, Roupa de cama, Travesseiro, Remédios, Carteira, Celular,
        Relógio, Produtos alimentícios, Tablet, Notebook, Outros.
      - Caixa de seleção **"Toma remédio controlado (contínuo)?"** → se **Sim**, abre o preenchimento
        da **ficha médica** da pessoa.
      - Pergunta: última vez que tomou o remédio (alimenta o sistema de medicamento contínuo).

### Ficha médica (Saúde) — alterar
- [ ] **Condições de saúde** vira **caixa de seleção múltipla** (igual ao multi-select de pessoas).
- [ ] **Remover** da ficha: plano de saúde, medicamentos em uso, contato do médico.
- [ ] Incluir a mesma configuração de **medicamento controlado/contínuo** que existe no cadastro.
- [ ] **Nome do menor / responsável:** só aparece quando a pessoa é **menor** (idealmente já no cadastro).

### Cronograma
- [ ] O que **predomina no card é o nome da Ministração**.
- [ ] Poder **editar tudo dentro do cronograma** a qualquer momento.

### Teatro (ainda fora do padrão)
- [ ] Ao **criar teatro**: opção de **subir arquivo**.
- [ ] Ao **criar cena**: opção de **subir arquivo**.
- [ ] Padronizar layout do Teatro.

### Ranking
- [ ] Conferir/garantir que o **ranking geral soma TODAS as estrelas** que a pessoa recebeu
      (hoje cada categoria mostra média; não há um "geral" somando tudo).

### Administração / cadastro
- [ ] Na **aprovação**, reduzir a lista de cargos para apenas **Visitante, Encontreiro, Administrador**.

### Crachá (definido)
- [ ] Campos: **foto, nome e equipe**. Tamanhos selecionáveis:
      1) Grande em pé 10×15 cm; 2) Pequeno em pé 5,4×8,6 cm; 3) Pequeno deitado 8,6×5,4 cm.
      Modelo: fundo (imagem) + campos por cima.
