import { registrarFerramenta } from './registry'
import { obterElemento } from '../elementos'

// Propriedades do elemento selecionado.
// Em cima: o painel ESPECÍFICO do tipo (vem do registro).
// Embaixo: o que TODO elemento tem — ordem, opacidade, bloquear, duplicar, excluir.

registrarFerramenta({
  id: 'propriedades',
  nome: 'Editar',
  icone: 'tune',
  precisaSelecao: true,
  Painel: ({ doc, selecao, dispatch, subirImagem }) => {
    const todos = doc.paginas.flatMap(p => p.elementos)
    const els = todos.filter(e => selecao.includes(e.id))
    if (!els.length) return <p style={{ fontSize: 13, color: 'var(--muted)' }}>Toque num elemento para editar.</p>
    const el = els[0]
    const def = obterElemento(el.tipo)
    const setProps = (props: Record<string, any>) => dispatch({ t: 'patchProps', ids: selecao, props })
    const set = (patch: any) => dispatch({ t: 'patch', ids: selecao, patch })

    const btnIcone = (icone: string, titulo: string, onClick: () => void, perigo = false) => (
      <button key={titulo} type="button" title={titulo} onClick={onClick}
        style={{
          flex: '0 0 auto', width: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '8px 3px',
          border: '1px solid var(--border)', borderRadius: 10, background: 'white', cursor: 'pointer', fontFamily: 'inherit',
          color: perigo ? 'var(--danger)' : 'var(--text2)', fontSize: 9.5, fontWeight: 600, lineHeight: 1.1,
        }}>
        <span className="icon icon-sm">{icone}</span>{titulo}
      </button>
    )

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* específico do tipo */}
        {els.length === 1 && def?.Painel && def.Painel({ el, setProps, set, subirImagem })}

        <div style={{ height: 1, background: 'var(--border)' }} />

        {/* comum a todos */}
        <label style={{ fontSize: 13, color: 'var(--text2)' }}>
          Opacidade ({Math.round(el.opacidade * 100)}%)
          <input type="range" min={0} max={100} value={Math.round(el.opacidade * 100)}
            onChange={e => set({ opacidade: Number(e.target.value) / 100 })} style={{ width: '100%' }} />
        </label>

        <label style={{ fontSize: 13, color: 'var(--text2)' }}>
          Rotação ({el.rot}°)
          <input type="range" min={0} max={359} value={el.rot}
            onChange={e => set({ rot: Number(e.target.value) })} style={{ width: '100%' }} />
        </label>

        <div className="ed-tira" style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
          {btnIcone('flip_to_front', 'Frente', () => dispatch({ t: 'ordem', ids: selecao, para: 'frente' }))}
          {btnIcone('flip_to_back', 'Trás', () => dispatch({ t: 'ordem', ids: selecao, para: 'tras' }))}
          {btnIcone('vertical_align_top', 'Topo', () => dispatch({ t: 'ordem', ids: selecao, para: 'topo' }))}
          {btnIcone('vertical_align_bottom', 'Fundo', () => dispatch({ t: 'ordem', ids: selecao, para: 'fundo' }))}
          {btnIcone(el.bloqueado ? 'lock' : 'lock_open', el.bloqueado ? 'Desbloq.' : 'Bloquear', () => set({ bloqueado: !el.bloqueado }))}
          {btnIcone('content_copy', 'Duplicar', () => dispatch({ t: 'duplicar', ids: selecao }))}
          {els.length > 1
            ? btnIcone('group_work', 'Agrupar', () => dispatch({ t: 'agrupar', ids: selecao }))
            : btnIcone('workspaces', 'Desagrupar', () => dispatch({ t: 'desagrupar', ids: selecao }))}
          {btnIcone('delete', 'Excluir', () => dispatch({ t: 'excluir', ids: selecao }), true)}
        </div>
      </div>
    )
  },
})
