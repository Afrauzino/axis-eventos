// Renderiza UMA página do documento (sem seleção/alças).
// Usado na prévia e na impressão — a mesma folha, em mm reais.
import type { Documento, Pagina } from '../tipos'
import { obterElemento } from '../elementos'

export default function Folha({ doc, pagina, dados, modo = 'papel' }: {
  doc: Documento
  pagina: Pagina
  dados?: Record<string, any>
  modo?: 'tela' | 'papel'
}) {
  return (
    <div style={{
      width: `${doc.papel.largura}mm`, height: `${doc.papel.altura}mm`,
      background: pagina.fundo ?? '#ffffff', position: 'relative', overflow: 'hidden', flexShrink: 0,
    }}>
      {pagina.elementos.filter(e => e.visivel).map(el => {
        const def = obterElemento(el.tipo)
        if (!def) return null
        return (
          <div key={el.id} style={{
            position: 'absolute', left: `${el.x}mm`, top: `${el.y}mm`,
            width: `${el.w}mm`, height: `${el.h}mm`,
            transform: `rotate(${el.rot}deg)`, transformOrigin: 'center',
            opacity: el.opacidade,
          }}>
            {def.Render({ el, dados, modo })}
          </div>
        )
      })}
    </div>
  )
}
