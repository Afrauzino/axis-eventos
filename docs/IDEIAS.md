# AXIS — Caixa de Ideias (registro contínuo)

> Tudo que o Anderson pensa/pede fica aqui pra NUNCA se perder (ideias atuais e futuras).
> Append-only: adicionar no fim, com data. Marcar `[feito]` quando implementado.
> Regra de trabalho: registrar aqui a cada poucas trocas (~5 comandos) e antes de qualquer handoff.

## Em aberto (backlog atual)
_Detalhes e "onde mexer" em `docs/HANDOFF.md`._

- [x] **BUG crachá** — [feito] editor não deixava editar; onClick do container só deseleciona no fundo vazio (`e.target===e.currentTarget`).
- [x] **Impressões:** [feito] Cozinha (detalhes); Cadastros (filtrar encontrista/encontreiro/os dois);
      Correio (checklist + avisar se tem arquivo no app); Cronograma (2 opções: inteiro / aberto com
      detalhes sem status e sem local); Equipes (nome+líder+liderados com foto, filtrar quais equipes).
- [x] **Crachá — 3 modelos** [feito] (Encontreiros/Encontrista/Especiais) por barra no topo, mesmo editor,
      config por modelo em `campos.modelos` (jsonb, _v:2, retrocompatível com o formato antigo);
      tamanho personalizado (larg/alt em mm/cm/px); PNGs como camadas independentes (arrastar/redimensionar/
      transparência); foto Redonda OU Quadrada 3×4.
- [x] **Ranking/Encontristas** — [feito] botão "Votar neste encontrista" abre direto na pessoa (router
      state votarPessoaId+origem); ao fechar volta pra origem; fechar normal do Ranking preservado.

## Novas ideias (adicionar abaixo, com data)
<!-- ex: - 2026-07-02 — [ ] descrição da ideia -->
- 2026-07-02 — [x] Varredura Admin: removida duplicidade de permissões (só pessoa+equipe), Tipos com
  emoji, auditoria automática (trigger sql/16), menu configurável de verdade (Nav↔menu_config, sql/17). [feito]
- 2026-07-02 — [x] Cor do sistema é global (admin muda p/ todos) — já funcionava via configuracoes. [ok]
- 2026-07-02 — [x] Logo configurável (Admin→Aparência): aparece no Login e vira o ícone do app. [feito]
- 2026-07-02 — [x] Carrossel na Início (imagens/vídeos, só admin adiciona, some se vazio) — sql/18. [feito]
- 2026-07-02 — [x] Bugs corrigidos: Encontreiros (badges) e Login (ano_encontro). [feito]
- 2026-07-02 — [x] **Mídia**: emoji colorido (📷🎵🎬) no lugar dos line-icons. [feito]
- 2026-07-02 — [x] **Escala**: impressão do dia no padrão (PrintOverlay, com foto). [feito]
- 2026-07-02 — [x] **Cronograma "com detalhes"**: sem duplicidade; 🎭 na frente do teatro; FOTO do
  ministrante + fotos dos atores com seus personagens. [feito]
- 2026-07-02 — [x] **Ministração impressão**: cabeçalho colorido igual ao app (sem cara dentro) + linha
  "Ministrante" com a foto abaixo (conforme foto de referência). [feito]
- 2026-07-02 — [x] **Crachá**: removido "Quem entra" (só filtro de equipes, e só no modelo Encontreiros);
  botão "Restaurar padrão deste modelo" (vale p/ os 3). [feito]
- 2026-07-02 — [x] **Cozinha impressão**: reflete o card do app (barra colorida, emoji, título, tipo, itens). [feito]
- 2026-07-02 — [x] **Equipes impressão**: igual ao card expandido do app (header + Liderança + Membros com
  foto e "Também em"). [feito]
- 2026-07-02 — [x] **Teatro impressão**: estilo app sem menus; aviso de mídia/arquivo antes das cenas;
  elenco com foto+nome+personagem; cenas no estilo dos cards. [feito]
- 2026-07-02 — [x] Correio impressão: mostrar a bolinha com a foto da pessoa. [feito]
- 2026-07-02 — [x] Cronograma impressão: refletir exatamente o que está na tela (mesmos grupos/filtro,
  visual de card); "com detalhes" só estende o card com ministração/teatro (coloca os teatros). [feito]
- 2026-07-02 — [x] Crachá: PNG estava "duro" pra mover — desligado o drag nativo (draggable=false) e
  camadas renderizadas por cima pra pegar fácil. [feito]
- 2026-07-02 — [x] Menus: só config visual (removido liberações/rota); carrossel avisa se tabela não existe. [feito]
- 2026-07-02 — [x] Relatórios: emoji colorido no lugar dos line-icons. [feito]
- 2026-07-02 — [x] Logs ricos: o que mudou (de→para), quem/onde + botão **Desfazer** (sql/16). [feito]
- 2026-07-02 — [x] **Permissões por função**: catálogo (Ver/Criar-editar/especiais como "Criar checklist")
  + tela Liberações reformada (Usuários/Equipes); acumulativo (união), não somativo. [feito — falta bloqueio por tela]
- 2026-07-02 — [x] Cor/logo no Login (leitura pública de configuracoes, sql/19). [feito]
- 2026-07-02 — [x] Carrossel: autoplay, loop, vídeo avança ao terminar, duração por imagem (sql/20). [feito]
- 2026-07-02 — [x] **Boas-vindas**: 2 telas editáveis (texto rico + GPS/mapa + contatos WhatsApp) p/ quem
  entra sem liberação (visitante/encontrista e encontreiro sem equipe). Só veem isso + carrossel. [feito]
- 2026-07-02 — [ ] **Cadeado nas rotas** (redirect de quem não tem acesso) — pendente.
- 2026-07-02 — [ ] **Bloqueio por função tela por tela** (Etapa 3 das permissões) — pendente.
- 2026-07-02 — [ ] **Varredura restante**: Locais, Minhas Atividades, Saúde (3), Alertas — pendente.
- 2026-07-02 — [ ] **Produção**: PWA (instalável/offline); credenciais em env var; schema do repo desatualizado. — pendente

## 2026-07-03 — LISTA GRANDE (pré-lançamento online) — implementar tudo, publicar só no fim
> Regra: fazer 2 a 2, checar bug, commitar. Publicar (Vercel) só quando TUDO ok.

1. [x] **Admin → Usuários**: botão "Editar cadastro completo" (foto+todos os dados, reusa CadastroPessoa);
   barra de abas agora rola sozinha (não arrasta a página). [feito]
2. [x] **Instalar como app**: PWA (manifest + service worker network-first) + botão "Instalar aplicativo"
   no Login/Dashboard (Android 1 toque; iPhone mostra passo a passo). [feito]
3. [~] **Equipes**: (c) color picker personalizado [feito]; (a) foto-ícone: código OK, faltava bucket →
   **rodar sql/21_storage_buckets.sql** [feito no código/SQL]; (b) tecla fantasma "2"/"W" — sem listener
   global no código; precisa REPRO no celular (qual tela, qual campo, qual teclado). PENDENTE repro.
4. [x] **Boas-vindas**: 1 botão liga/desliga que controla as DUAS telas. [feito — switch no card de boas-vindas]
5. [x] **Dashboard**: removido "Acesso rápido"; indicadores só p/ Admin e Financeiro. [feito]
6. [x] **Central de notificações (sino)**: painel junta escalas, cronograma (ministrante/elenco), equipes,
   avisos e aprovações; lembrete "começa em breve" (≤1h); "lido" no aparelho; badge de não-lidas. [feito]
   OBS: lembrete/push automático real (fora do app) exige backend/cron — feito o melhor sem servidor.
7. [x] **Medicamentos**: botão "Adicionar alarmes ao celular" gera .ics (nome/medicamento/dose/horário),
   alarme ~8 min antes; abre no calendário do Android/iPhone. [feito]
8. [x] **Tela de visitante**: logo aparece na tela de boas-vindas + 3ª variante "Visitante" configurável;
   visitante sem cadastro cai na tela própria. [feito]
9. [x] **Ministrantes**: só Encontreiro pode ser ministrante. [feito — PersonSelect filtra role_type=worker]
10. [x] **Ministrações**: sem data/horário/fim/duração no form/lista/detalhe/impressão; agenda só no Cronograma
    (mantém hora-base interna p/ não quebrar o banco). [feito]
11. [x] **Cronograma → atividades pessoais**: ministrante/elenco aparecem em "Minha agenda" (Minhas Atividades)
    com o horário do Cronograma. [feito]
12. [x] **Cronograma**: botão "Adicionar" ok [feito]; sincronização em tempo real (Supabase Realtime em
    cronograma_eventos; popup de quem acompanha sincroniza). **Rodar sql/22_realtime_cronograma.sql**. [feito]
13. [x] **Tema**: barra superior do celular segue a cor do sistema (theme-color dinâmico em tema.ts). [feito]
14. [x] **Impressão**: print-color-adjust em PrintOverlay preserva cores no PDF. [feito]
15. [x] ~~Permissões por contexto~~ — DESCARTADO pelo Anderson (2026-07-03). Não fazer.
16. [x] **Permissões do ministrante** (cargo "Ministrante"=coordenador, não-admin): só vê a própria ministração
    + notas; sem lista/status/play/print/editar; entra só pelo Cronograma; voltar sempre volta ao Cronograma. [feito]
17. [x] **Início (Fotos/vídeos)**: playlist — imagem por tempo; YouTube autoplay limpo (IFrame API, sem
    controles/UI), avança só ao terminar; loop infinito. [feito]
18. [x] **MSG (aba no Admin)**: mensagem editável do código de acesso ({nome}/{codigo}), prévia, botão
    "Copiar msg" monta a mensagem. [feito]
19. [x] **Encontristas → "conheço esta pessoa"**: encontreiro marca (nome+foto+WhatsApp); vários marcam; lista
    no perfil. **Rodar sql/23_encontrista_conhecidos.sql**. [feito]

### 2026-07-04 — ajustes pós-lançamento (publicados)
- Instalar app: botão global no rodapé de todas as telas; aparece sozinho; ícone da instalação usa a LOGO
  (manifest dinâmico em `src/lib/tema.ts::aplicarIconesApp`). Quem já instalou precisa reinstalar p/ trocar o ícone.
- Tela inicial: sem data/"Olá nome"; ordem = evento → ranking → indicadores → carrossel → boas-vindas.
- **Tela inicial reordenável:** admin arrasta os blocos (botão "Reordenar tela"), ordem salva em config `home_ordem`
  e vale p/ todos. Blocos: evento/ranking/indicadores/carrossel/boasvindas (`Dashboard.tsx::renderSecao`).
- Minhas Atividades: ministração/teatro do cronograma entram na barra de progresso, mas só sobem quando o
  item do cronograma está 'concluido' ou 'cancelado'.
- Ranking na tela inicial: removido o título "Ranking do Encontro" (fica só a caixa do widget).
- Pós-instalação do app: ao instalar, mostra tela "App instalado! abra pelo ícone" e tenta fechar a aba
  (`InstallPWA.tsx`, evento `appinstalled`).
- **Performance:** telas carregadas sob demanda (React.lazy + Suspense em `App.tsx`). Bundle inicial caiu de
  ~935KB p/ ~476KB (gzip 225KB→135KB). Nada de config foi perdido.

### ✅ FECHAMENTO 2026-07-03 — tudo publicado online
SQLs pra rodar no Supabase (SQL Editor) quando puder — o app NÃO quebra sem eles, só as partes esperam:
- `sql/21_storage_buckets.sql`  → foto de ícone da equipe (#3a)
- `sql/22_realtime_cronograma.sql` → cronômetro em tempo real (#12)
- `sql/23_encontrista_conhecidos.sql` → "conheço esta pessoa" (#19)
Pendências que dependem do Anderson:
- #3b tecla fantasma "2"/"W": sem causa no código; precisa reproduzir no celular (tela/campo/teclado).
- #15: DESCARTADO (não fazer).
Limitações assumidas (melhor alternativa feita):
- #6 push/lembrete que toca com o app FECHADO precisa de backend/cron (não tem servidor) — no app mostra tudo + "começa em breve".
- #7 alarme nativo em lote não existe na web — geramos .ics (calendário) que funciona em Android/iPhone.

### 2026-07-04 — SQLs JÁ RODADOS pelo Anderson
- `sql/21`, `sql/22`, `sql/23`, `sql/24` (criar cadastro), `sql/25` (segurança) — TODOS aplicados. Verificado:
  admin ainda escreve em `configuracoes` (leitura pública mantida).

### 2026-07-04 — IDEIAS DE MELHORIA (backlog priorizado, NÃO feito ainda)
> Sugestões da Claude após varredura. Confirmar com o Anderson (caixa de seleção) antes de fazer as grandes.
- **[ALTA] Auditar RLS de INSERT dos outros módulos.** O bug do "criar" (a permissão "Criar/editar" só concede a
  ação `editar`, mas o RLS de INSERT pede `create`) foi corrigido só p/ `people` (sql/24). Provavelmente afeta
  também `teams`, `ministrações`, `escalas`, `theaters`/teatro, `cozinha_cardapios`, `locais`, `cronograma_eventos`.
  Fazer o mesmo padrão do sql/24 (política de INSERT que aceita a permissão granular 'editar') p/ cada um.
- **[ALTA] Guardas de rota (cadeado).** Quem não tem permissão ainda consegue abrir uma tela digitando a URL.
  Redirecionar p/ Início quem não tem o menu/permissão. (Já estava pendente: "Cadeado nas rotas".)
- **[MÉDIA] Publicar a Edge Function `admin-delete-user`** (guia em `docs/EDGE_FUNCTION_DELETE.md`) p/ excluir
  conta DE VERDADE (perfil + login) e liberar o e-mail. Código pronto; falta `supabase functions deploy`.
- **[MÉDIA] Lembretes automáticos reais (1h antes) + push com app fechado.** Precisa de Edge Function + cron
  (`pg_cron`/agendador) + Web Push (VAPID) ou FCM. Hoje o sino só mostra "começa em breve" com o app aberto.
- **[MÉDIA] Credenciais em variáveis de ambiente.** Hoje URL+anon key estão fixos em `src/lib/supabase.ts`.
  Mover p/ `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` e configurar no Vercel (organização; anon key é pública).
- **[BAIXA] Ícone PNG quadrado do app.** Hoje o ícone da instalação usa a logo do Supabase; se ela for
  retangular, corta no ícone redondo. Gerar/enviar uma versão quadrada (ou maskable) fica melhor.
- **[BAIXA] Toasts de "salvo".** Algumas telas salvam em silêncio; um aviso visual dá segurança ao usuário.
- **[BAIXA] Endurecer listagem de buckets + ligar "leaked password protection"** (avisos de segurança do Supabase;
  buckets: cuidado que o app LISTA `avatars` p/ foto de perfil — não trancar esse).
- **[BAIXA] Modo fonte grande / acessibilidade** p/ público mais velho nos eventos.
- **[FUTURO] Alguns testes de fumaça** (build/rotas) p/ não quebrar em mudanças futuras.
- **#3b tecla fantasma "2"/"W"** ao abrir/fechar teclado criando equipe: sem causa no código; precisa repro no
  celular (qual tela, campo e teclado).

### 2026-07-04 — IDEIAS CRIATIVAS DA CLAUDE (sugestões próprias, p/ discutir)
Pensadas pro contexto real (evento ao vivo, retiro, público variado). Reaproveitam módulos que já existem.
- **Modo Painel/Projetor (tela cheia):** juntar cronômetro grande + "acontecendo agora/próximo" + carrossel numa
  tela pra por num telão/TV do evento. (Reusa Cronograma + HomeCarousel.)
- **Barra "Acontecendo agora":** faixa fixa mostrando o bloco atual do cronograma p/ todos ("agora: Louvor · depois:
  Ministração"). Corta a pergunta "o que é agora?".
- **Check-in/presença por atividade e refeição:** marcar presença (lista rápida ou QR do crachá). Cozinha sabe
  quantos vão comer; segurança sabe quem está. (Reusa Crachá + Cozinha.)
- **Restrições alimentares → resumo automático p/ Cozinha:** a Saúde já coleta alergias/restrições; gerar contagem
  automática (X vegetarianos, Y alérgicos) p/ a equipe da cozinha.
- **Carta/áudio do padrinho p/ afilhado (Correio digital):** além do checklist, permitir uma mensagem/áudio entregue
  no fim — muito no espírito do encontro.
- **Botão SOS/emergência:** líder/enfermaria dispara alerta rápido (pessoa + local). Reusa alertas críticos.
- **Galeria/retrospectiva do evento:** equipe de mídia sobe fotos; no fim, uma retrospectiva. Valor emocional.
- **Modelo de evento (1 clique):** além de duplicar, ter um "template" de cronograma/equipes p/ montar evento novo
  em minutos.
- **[ENGENHARIA — dívida técnica importante] Unificar permissões:** existem DUAS tabelas (`permissions` inglês no
  RLS vs `permissoes` português no app) e ações divergentes (`edit/create` vs `editar`). Foi a causa do bug do
  "criar". Unificar de vez evita novos bugs. É a melhoria técnica mais valiosa.
- **Toasts + erros amigáveis:** trocar alerts crus por avisos bonitos e mensagens claras ("Salvo!", "Sem internet").
- **Offline de verdade:** em sítio de retiro o sinal é ruim; melhorar o cache do PWA p/ ver cronograma/crachá/ficha
  sem internet.
- **Acessibilidade:** modo fonte grande + alto contraste p/ público mais velho.

## Painel de análises (feito Fase 1 em 2026-07-11)
- **Fase 1 (ENTREGUE):** menu Administração > Sistema > Painel. KPIs reais (online agora,
  acessaram hoje, com/sem conta, encontristas×encontreiros, arrecadado, % escalas), progresso
  por equipe, gráfico cadastros/7 dias, donut de tipos, liga/desliga por card (por aparelho),
  liberação separada da de equipe (modulo='painel', escolhida dentro da tela). SQL 63.
- **Fase 2 (ENTREGUE):** financeiro (pago × a receber + inadimplentes, arrecadação/dia, formas de
  pagamento, maiores doadores), correio %/afilhados, saúde/cozinha (remédios entregues/pendentes,
  restrições, alergias), ocorrências abertas/resolvidas, fichas médicas, aniversariantes no evento,
  engajamento do carrossel, comparativo com evento anterior.
- **Fase 3 (ENTREGUE parcial):** Modo TV (rola a tela sozinha no telão) + tela cheia + botão na Início.
- **Fase 4 (a fazer):** exportar PDF do painel, metas por equipe (definir e mostrar progresso até a
  meta), série histórica de acessos por hora/dia (precisa gravar histórico de last_seen), teatro
  (ensaios/atores/personagens preenchidos).

## Editor de Impressão — ferramentas a adicionar (ideias 2026-07-17)
Ordenado por valor pro caso (crachás/etiquetas do encontro):
- **QR Code / código de barras (TOP):** elemento que gera QR de um campo (ex.: código da pessoa ou
  link de check-in). No crachá dá pra ESCANEAR na entrada → futuro check-in/presença por câmera.
- **Duplicar elemento:** copiar o selecionado (falta óbvia num editor). Ctrl+D / botão.
- **Ordem/camadas:** trazer pra frente / mandar pra trás (z-index) do elemento selecionado.
- **Imagem de fundo da folha:** pôr uma ARTE de fundo no crachá (hoje só cor de fundo).
- **Numeração automática:** nº sequencial por cópia (crachá 001, 002…), útil pra controle.
- **Frente e verso:** imprimir crachá dos 2 lados (páginas já existem; falta o fluxo "verso").
- **Linha / divisória:** elemento de linha reta.
- **Bloquear / esconder elemento (UI):** o tipo já tem `bloqueado`/`visivel`; falta o botão.
- **Alinhar/distribuir VÁRIOS selecionados** (hoje o alinhar é só ao centro da folha).
- **Biblioteca de modelos prontos:** crachá/etiqueta/lista já montados pra só usar.
- App-level: **check-in por QR na entrada** (lê o crachá, marca presença) — casa com o QR acima.
