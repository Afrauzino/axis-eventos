# AXIS — Padrão Visual (REGRA)

> Regra definida pelo Anderson na conversa original do projeto. Vale para TODAS as telas.
> Ao mexer em qualquer tela, deixá-la nesse padrão. Nunca introduzir estilo fora daqui.

## 1. Emojis — SEMPRE coloridos
- Usar **emojis coloridos** (🎭 🍴 🎤 📅 👥 ⭐), NUNCA ícones de linha (Material Symbols) como "emoji".
- Seletor de emoji = **grade `EMOJIS_AXIS`** (de `components/AvatarPicker`), botões ~38×38,
  selecionado com `border:2px solid var(--primary)` + `background:var(--primary-light)`.
- ❌ NÃO usar o componente antigo `EmojiPicker` (ícones de linha) para escolher emoji.
- Material Symbols (`.icon`) só para ícones de UI (chevron, close, add, delete…), não como emoji de conteúdo.

## 2. Menu lateral (gaveta) — "Opção B"
- Fundo **branco**, cada item com um **emoji colorido**.
- Cor de seleção/realce = **cor do sistema** (var(--primary), definida em Administração → Aparência).
  Nunca fixar verde/turquesa no código.
- Submenus viram **abas no topo da página** (componente `SubTabs`), padrão de Administração.

## 3. Card de lista — `.list-card` / `CardItem`
- Largura cheia, cantos arredondados (raio 12–14), sombra `var(--shadow-sm)`.
- Barra de cor à esquerda (cor da equipe/tipo), foto da pessoa OU emoji colorido no avatar.
- Equipe aparece como **emoji + cor** (identidade visual), não o nome escrito.
- Clique no corpo/nome abre ver/editar; controles internos usam `e.stopPropagation()`.

## 4. Janela flutuante (modal) — bottom-sheet
- Overlay: `position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:300;`
  `display:flex; flex-direction:column; justify-content:flex-end;` (fecha ao tocar fora).
- Painel: `background:white; border-radius:20px 20px 0 0; max-height:~90vh; overflow-y:auto;`
- **Alcinha** no topo: `width:36; height:4; background:var(--border); border-radius:2; margin:12px auto 0;`
- Cabeçalho com título (fontWeight 700) + botão fechar redondo (32×32).

## 5. Campos / caixas de texto
- Sempre `.form-group` > `.form-label` + `.form-input` (ou `.form-textarea`).
- Dica: `.form-hint`. Obrigatório: `<span className="req">*</span>`.
- Preferir seletores no padrão (chips/botões) a `<select>` nativo quando possível.

## 6. Cores e números
- Cor principal do sistema: `var(--primary)` (dinâmica). Tons: `var(--primary-light)`, `var(--primary-dark)`.
- Perigo: `var(--danger)`/`var(--danger-bg)`. Sucesso: `var(--success)`. Aviso: `var(--warning)`.
- Texto: `var(--text)`/`var(--text2)`/`var(--muted)`. Borda: `var(--border)`. Fundo: `var(--bg)`.
- Cronograma: duração em **relógio** (1:30), nunca "90 min".

## 7. Regras de trabalho ligadas ao padrão
- Fazer de **2 em 2 telas**; ao iniciar cada uma, checar bugs/inconsistências/duplicidade.
- "Tudo que funciona não será tocado, exceto o que tem erro."
- Conferir TODAS as caixinhas (criar/editar) de cada tela no padrão acima.
