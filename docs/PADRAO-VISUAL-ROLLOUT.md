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

## ✅ Calendário próprio — item 2 CONCLUÍDO e publicado
`src/components/DataHora.tsx` criado (item 6: mês navegável ‹ ›, dia selecionado = círculo na cor do sistema,
hora com colunas horas/minutos + caixinha "14 : 00", botões Limpar/Confirmar). Mantém o MESMO formato de valor
dos inputs nativos (date 'YYYY-MM-DD', time 'HH:MM', datetime 'YYYY-MM-DDTHH:MM') → troca sem mexer nos saves.
Props: `modo='date'|'time'|'datetime'`, `value`, `onChange`, `disabled`, `placeholder`, `titulo`.
TODOS os inputs nativos trocados (0 restantes):
- `Admin.tsx`: datas início/fim do evento ✓
- `Financeiro.tsx`: data de pagamento ✓
- `Cronograma.tsx`: data e hora programada ✓
- `Escalas.tsx`: início e fim (datetime) ✓
- `FichaMedica.tsx`: última dose ✓
- `CadastroPessoa.tsx`: nascimento (não estava na lista, é real) + horário do remédio ✓
> ⚠️ Tradeoff: o Cronograma/Escalas tinham `min/max` (limitar às datas do evento) nos inputs nativos; o DataHora
> ainda NÃO valida faixa. Se precisar travar fora do evento, adicionar props `min`/`max` ao DataHora depois.

## (menor) Color picker nativo
`type="color"` em 7 telas (Equipes, Ministracoes, Admin, TeatroLista, Locais, Cracha, ConfigCor). Baixa prioridade;
a paleta custom já existe ao lado. Se for padronizar, fazer um mini color-picker próprio depois.

## Modo de trabalho (Anderson)
Português simples; autonomia; 2 a 2 checando bug; **preview antes de construir** (regra de ouro do manual);
publicar (push na main → Vercel) e confirmar pela API do GitHub. Deploy atual no ar: `e15f176`.
