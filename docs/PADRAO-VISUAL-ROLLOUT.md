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

## ⏳ Seletor que FALTA trocar (ainda `<select>` nativo)
- `src/components/CadastroPessoa.tsx`: sexo (~347), UF/estado (~410), status (~430), team_pref (~440).
  [Opcional/dead-code: tipo_sanguineo (~174), med tipo (~245), med intervalo (~260) — bloco Saúde não renderiza hoje.]
- `src/pages/Cracha.tsx`: fonte (~303), tamanho (~329), unidade mm/cm/px (~346), filtroEquipe (~373).
- `src/pages/SaudeConfig.tsx`: hora de corte (~45) — 24 opções (valor number → converter p/ string).
- `src/pages/Admin.tsx`: cargo na LISTA (~924, é um select COMPACTO inline no card — precisa de estilo pequeno;
  talvez adicionar prop `compact` ao Seletor) e cargo no DETALHE (~1072).
- `src/pages/Ministracoes.tsx`: tipo do BLOCO de conteúdo (~409) — é um select inline "tipo texto"; converter com
  cuidado pra não ficar pesado (ou deixar por último).
> Regra: nunca colocar o `<Seletor>` (que é um `<button>`) DENTRO de outro `<button>` (aviso validateDOMNesting).
> O card da lista de Ministrações é um `<button>` — só converter selects que estão em formulários/modais.

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
