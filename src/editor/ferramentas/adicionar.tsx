import { registrarFerramenta } from './registry'
import { criarElemento, listarElementos } from '../elementos'

// Ferramenta "Adicionar" — lista automaticamente TODOS os tipos registrados.
// Registrou um QR Code? Ele aparece aqui sozinho.

registrarFerramenta({
  id: 'adicionar',
  nome: 'Adicionar',
  icone: 'add_box',
  Painel: ({ doc, paginaAtual, dispatch, selecionar }) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
      {listarElementos().map(def => (
        <button key={def.tipo} type="button"
          onClick={() => {
            const el = criarElemento(def.tipo, { x: doc.papel.largura / 2 - 20, y: doc.papel.altura / 2 - 10 })
            if (!el) return
            dispatch({ t: 'add', paginaId: doc.paginas[paginaAtual].id, el })
            selecionar([el.id])
          }}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '14px 12px',
            border: '1px dashed var(--border)', borderRadius: 12, background: 'white',
            cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: 'var(--text2)',
          }}>
          <span className="icon" style={{ color: 'var(--primary)' }}>{def.icone}</span>
          {def.nome}
        </button>
      ))}
    </div>
  ),
})
