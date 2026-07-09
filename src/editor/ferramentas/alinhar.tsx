import { registrarFerramenta } from './registry'

// Alinhar em relação à folha. (Distribuição/espaçamento entram aqui depois,
// quando houver seleção múltipla — sem mexer no resto.)

registrarFerramenta({
  id: 'alinhar',
  nome: 'Alinhar',
  icone: 'format_align_center',
  precisaSelecao: true,
  Painel: ({ doc, selecao, dispatch }) => {
    const els = doc.paginas.flatMap(p => p.elementos).filter(e => selecao.includes(e.id))
    if (!els.length) return <p style={{ fontSize: 13, color: 'var(--muted)' }}>Selecione um elemento.</p>
    const { largura: W, altura: H } = doc.papel

    const alinhar = (onde: string) => {
      els.forEach(el => {
        const patch: any = {}
        if (onde === 'esq') patch.x = 0
        if (onde === 'centroH') patch.x = W / 2 - el.w / 2
        if (onde === 'dir') patch.x = W - el.w
        if (onde === 'topo') patch.y = 0
        if (onde === 'centroV') patch.y = H / 2 - el.h / 2
        if (onde === 'base') patch.y = H - el.h
        dispatch({ t: 'patch', ids: [el.id], patch })
      })
    }

    const b = (icone: string, titulo: string, onde: string) => (
      <button type="button" title={titulo} onClick={() => alinhar(onde)}
        style={{ flex: 1, padding: '11px 4px', border: '1px solid var(--border)', borderRadius: 10, background: 'white', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text2)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, fontSize: 10 }}>
        <span className="icon icon-sm">{icone}</span>{titulo}
      </button>
    )

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {b('align_horizontal_left', 'Esquerda', 'esq')}
          {b('align_horizontal_center', 'Centro', 'centroH')}
          {b('align_horizontal_right', 'Direita', 'dir')}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {b('align_vertical_top', 'Topo', 'topo')}
          {b('align_vertical_center', 'Meio', 'centroV')}
          {b('align_vertical_bottom', 'Base', 'base')}
        </div>
      </div>
    )
  },
})
