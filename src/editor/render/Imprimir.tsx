// ─────────────────────────────────────────────────────────────
// Impressão. Dois modos, decididos pelo documento:
//  • fonteDados = 'pessoas' → o modelo é repetido POR PESSOA e
//    encaixado (tiles) numa folha A4, quantos couberem.
//  • fonteDados = null      → imprime as páginas do documento como estão.
// (Sangria/marcas de corte/frente-verso entram aqui depois.)
// ─────────────────────────────────────────────────────────────
import type { Documento } from '../tipos'
import Folha from './Folha'

const A4 = { retrato: { l: 210, a: 297 }, paisagem: { l: 297, a: 210 } }
const MARGEM = 8   // mm
const ESPACO = 3   // mm entre os cartões

export default function Imprimir({ doc, dados, orientacao = 'retrato', onVoltar }: {
  doc: Documento
  dados: Record<string, any>[]          // uma entrada por pessoa
  orientacao?: 'retrato' | 'paisagem'
  onVoltar: () => void
}) {
  const folha = A4[orientacao]
  const porPessoa = doc.fonteDados === 'pessoas'

  // Quantos cartões cabem por folha
  const util = { l: folha.l - MARGEM * 2, a: folha.a - MARGEM * 2 }
  const cols = Math.max(1, Math.floor((util.l + ESPACO) / (doc.papel.largura + ESPACO)))
  const rows = Math.max(1, Math.floor((util.a + ESPACO) / (doc.papel.altura + ESPACO)))
  const porFolha = cols * rows

  const paginas: Record<string, any>[][] = []
  if (porPessoa) for (let i = 0; i < dados.length; i += porFolha) paginas.push(dados.slice(i, i + porFolha))

  const css = `
    @media print {
      html, body, #root, .app-root, .app-root > main { height:auto !important; max-height:none !important; overflow:visible !important; display:block !important; background:#fff !important; }
      .app-root > header { display:none !important; }
      .no-print { display:none !important; }
      .ed-folha { break-inside:avoid; page-break-inside:avoid; }
      .ed-pagina:not(:last-child) { break-after:page; page-break-after:always; }
      * { -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
      @page { size: A4 ${orientacao === 'retrato' ? 'portrait' : 'landscape'}; margin: ${MARGEM}mm; }
    }
  `

  return (
    <div style={{ padding: 16, background: 'white' }}>
      <style>{css}</style>

      <div className="no-print" style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
        <button className="btn btn-primary" onClick={() => window.print()}>Imprimir / Salvar PDF</button>
        <button className="btn btn-ghost" onClick={onVoltar}>Voltar</button>
        <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 6 }}>
          {porPessoa
            ? `${dados.length} pessoa(s) · ${porFolha} por folha (${cols}×${rows}) · A4 ${orientacao === 'retrato' ? 'em pé' : 'deitada'}`
            : `${doc.paginas.length} página(s)`}
        </span>
      </div>

      {porPessoa
        ? paginas.map((grupo, gi) => (
            <div key={gi} className="ed-pagina" style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, ${doc.papel.largura}mm)`, gap: `${ESPACO}mm`, justifyContent: 'start', marginBottom: 12 }}>
              {grupo.map((d, i) => (
                <div key={i} className="ed-folha" style={{ outline: '0.2mm dashed #d1d5db' }}>
                  <Folha doc={doc} pagina={doc.paginas[0]} dados={d} modo="papel" />
                </div>
              ))}
            </div>
          ))
        : doc.paginas.map(pg => (
            <div key={pg.id} className="ed-pagina ed-folha" style={{ marginBottom: 12, outline: '0.2mm dashed #d1d5db', width: 'fit-content' }}>
              <Folha doc={doc} pagina={pg} modo="papel" />
            </div>
          ))}
    </div>
  )
}
