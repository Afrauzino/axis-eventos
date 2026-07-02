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
