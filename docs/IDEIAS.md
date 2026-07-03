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
2. [ ] **Instalar como app**: melhor caminho de instalação simples (PWA facilitada / prompt de install).
3. [~] **Equipes**: (c) color picker personalizado [feito]; (a) foto-ícone: código OK, faltava bucket →
   **rodar sql/21_storage_buckets.sql** [feito no código/SQL]; (b) tecla fantasma "2"/"W" — sem listener
   global no código; precisa REPRO no celular (qual tela, qual campo, qual teclado). PENDENTE repro.
4. [x] **Boas-vindas**: 1 botão liga/desliga que controla as DUAS telas. [feito — switch no card de boas-vindas]
5. [x] **Dashboard**: removido "Acesso rápido"; indicadores só p/ Admin e Financeiro. [feito]
6. [ ] **Central de notificações (sino)**: escalas, alterações, avisos, mensagens, comunicados, "você foi
   escalado p/ teatro", "adicionado em equipe", "atividade alterada" + lembretes automáticos antes das
   atividades (ex.: 1h antes). (Aviso de aprovação já ok.)
7. [ ] **Medicamentos**: 1º acesso sem nada de saúde (já feito); botão "Adicionar alarmes ao celular" que gera
   lembretes (nome, medicamento, dose, horário) ~5–10 min antes. Android/iPhone/PWA (ICS/calendário se nativo
   não der).
8. [x] **Tela de visitante**: logo aparece na tela de boas-vindas + 3ª variante "Visitante" configurável;
   visitante sem cadastro cai na tela própria. [feito]
9. [x] **Ministrantes**: só Encontreiro pode ser ministrante. [feito — PersonSelect filtra role_type=worker]
10. [ ] **Ministrações**: remover data/horário/horário final/duração (agenda só no Cronograma).
11. [ ] **Cronograma → atividades pessoais**: ministrante/elenco entram automaticamente nas atividades pessoais
    da pessoa, com horário vindo do Cronograma.
12. [~] **Cronograma**: botão "Adicionar" do cronômetro não estoura mais o layout [feito]; FALTA sincronização
    em tempo real (~1–2s) em todos os dispositivos (Supabase realtime).
13. [x] **Tema**: barra superior do celular segue a cor do sistema (theme-color dinâmico em tema.ts). [feito]
14. [x] **Impressão**: print-color-adjust em PrintOverlay preserva cores no PDF. [feito]
15. [x] ~~Permissões por contexto~~ — DESCARTADO pelo Anderson (2026-07-03). Não fazer.
16. [ ] **Permissões do ministrante**: acesso mínimo — só vê a própria ministração + bloco de notas; sem lista,
    sem play/continuar/concluir; entra só pelo Cronograma; voltar/fechar sempre volta ao Cronograma.
17. [ ] **Início (Fotos/vídeos)**: playlist automática. Imagem = tempo configurado. Vídeo YouTube = autoplay,
    sem controles/barra/play/UI, avança só ao terminar. Loop infinito no fim.
