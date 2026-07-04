# Rollout do Padrão Visual (Seletor + Calendário) — HANDOFF

Referência oficial: **`docs/MANUAL-DESIGN-AXIS.html`** (abrir no navegador). Itens 4 e 6 do manual:
- Item 4: caixa de seleção NUNCA a nativa cinza → abre de baixo / botões lado a lado, cor do sistema.
- Item 6: data/hora → calendário próprio (não o nativo do celular).

## Componente já criado
`src/components/Seletor.tsx` — pronto e testado ao vivo (abre a lista de baixo, ✓ no selecionado).
Uso:
```tsx
import Seletor from '../components/Seletor'
<Seletor titulo="Local" placeholder="Selecionar..." value={form.local}
  onChange={v => setForm(f => ({...f, local: v}))}
  opcoes={[{value:'', label:'Sem local'}, ...locais.map(l => ({value:l.nome, label:l.nome}))]}/>
```
- `<=3` opções sem descrição → vira botões lado a lado automático. Força com `inline` ou `sheet`.
- Aceita `emoji` e `descricao` por opção.

## ✅ Seletor JÁ trocado (publicado)
- Alertas (prioridade, destino) · Cozinha (tipo refeição) · Locais (tipo, equipe)
- Cronograma (tipo, ministração, teatro, cardápio, local) · Ministrações (local, teatro)
- Teatro: Lista (ministração), Atores (teatro, personagem), Detalhe (personagem, objeto)

## ✅ Seletor — item 1 CONCLUÍDO e publicado (deploy 9ca02cd)
Todos os `<select>` nativos trocados (2026, sessão de continuação):
- `CadastroPessoa.tsx`: sexo, UF/estado, status, team_pref ✓
- `Cracha.tsx`: fonte, tamanho, unidade mm/cm/px, filtroEquipe ✓
- `SaudeConfig.tsx`: hora de corte (24h, number↔string) ✓
- `Admin.tsx`: cargo na LISTA (novo modo `compact` no Seletor + wrapper `stopPropagation` p/ não abrir o card) e cargo no DETALHE ✓
- `Ministracoes.tsx`: tipo do bloco (`sheet compact`) ✓
- `Escalas.tsx`: local (não estava na lista original, mas foi achado e trocado) ✓
- **Novo no Seletor:** prop `compact` (gatilho pequeno p/ usar inline em cards/listas).
- ÚNICO `<select>` restante: bloco Saúde dead-code em `CadastroPessoa.tsx` (tipo_sanguineo ~175, med tipo ~246,
  med intervalo ~261) — NÃO renderiza hoje; deixado de propósito.
> Regra mantida: nunca `<Seletor>` (é `<button>`) dentro de outro `<button>` (validateDOMNesting).
> O card da lista de Ministrações é `<button>` — só se converteu selects de formulários/modais.

## ⏳ Calendário próprio (2º componente, AINDA NÃO criado)
Criar `src/components/DataHora.tsx` no padrão do item 6 (mês navegável, dia na cor do sistema + seletor de hora).
Preview já foi aprovado pelo Anderson. Depois trocar os `type="date"|"time"|"datetime-local"` em:
- `src/pages/Admin.tsx` (~1508, ~1511 — datas do evento, só `date`)
- `src/pages/Cronograma.tsx` (~521 — `datetime-local`)
- `src/pages/Escalas.tsx` (~315, ~319 — `datetime-local` x2)
- `src/pages/Financeiro.tsx` (~189 — `date`)
- `src/components/CadastroPessoa.tsx` (~257 — `time`, horário do remédio)
- `src/components/FichaMedica.tsx` (~210 — `datetime-local`, última dose)

## (menor) Color picker nativo
`type="color"` em 7 telas (Equipes, Ministracoes, Admin, TeatroLista, Locais, Cracha, ConfigCor). Baixa prioridade;
a paleta custom já existe ao lado. Se for padronizar, fazer um mini color-picker próprio depois.

## Modo de trabalho (Anderson)
Português simples; autonomia; 2 a 2 checando bug; **preview antes de construir** (regra de ouro do manual);
publicar (push na main → Vercel) e confirmar pela API do GitHub. Deploy atual no ar: `e15f176`.
