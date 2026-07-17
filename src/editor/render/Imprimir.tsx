// ─────────────────────────────────────────────────────────────
// Impressão. Dois modos, decididos pelo documento:
//  • fonteDados = 'pessoas' → o modelo é repetido POR PESSOA e
//    encaixado (tiles) numa folha A4. A orientação da folha é
//    escolhida AUTOMATICAMENTE: a que couber mais cartões.
//  • fonteDados = null      → imprime as páginas do documento como estão.
// (Sangria/marcas de corte/frente-verso entram aqui depois.)
// ─────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react'
import type { Documento } from '../tipos'
import Folha from './Folha'

export const A4 = { retrato: { l: 210, a: 297 }, paisagem: { l: 297, a: 210 } }
const MARGEM = 8   // mm
const ESPACO = 3   // mm entre os cartões

export type Orientacao = 'auto' | 'retrato' | 'paisagem'

/** Quantos cartões cabem numa folha. */
function cabem(folha: { l: number; a: number }, card: { l: number; a: number }) {
  const util = { l: folha.l - MARGEM * 2, a: folha.a - MARGEM * 2 }
  const cols = Math.floor((util.l + ESPACO) / (card.l + ESPACO))
  const rows = Math.floor((util.a + ESPACO) / (card.a + ESPACO))
  return { cols: Math.max(0, cols), rows: Math.max(0, rows), total: Math.max(0, cols) * Math.max(0, rows) }
}

/** Em qual folha A4 o modelo será impresso e quantos cabem.
 *  'auto' escolhe a orientação que encaixa mais. Usado também pelo indicador da tela. */
export function encaixe(papel: { largura: number; altura: number }, forcar: Orientacao = 'auto') {
  const card = { l: papel.largura, a: papel.altura }
  const r = cabem(A4.retrato, card)
  const p = cabem(A4.paisagem, card)
  const orientacao: 'retrato' | 'paisagem' =
    forcar === 'auto' ? (p.total > r.total ? 'paisagem' : 'retrato') : forcar
  const enc = orientacao === 'paisagem' ? p : r
  return { orientacao, cols: enc.cols, rows: enc.rows, total: enc.total, cabe: enc.total > 0 }
}

export default function Imprimir({ doc, dados, orientacao: forcar = 'auto', onVoltar }: {
  doc: Documento
  dados: Record<string, any>[]          // uma entrada por pessoa
  orientacao?: Orientacao
  onVoltar: () => void
}) {
  const porPessoa = doc.fonteDados === 'pessoas'
  const card = { l: doc.papel.largura, a: doc.papel.altura }

  // Orientação escolhida na hora (começa no que veio de fora, padrão 'auto').
  const [orient, setOrient] = useState<Orientacao>(forcar)

  const enc = encaixe(doc.papel, orient)
  const orientacao = enc.orientacao
  const cols = Math.max(1, enc.cols)
  const porFolha = Math.max(1, enc.total)
  const cabeu = enc.cabe

  // Atalho: tecla R gira a folha (Automática → Em pé → Deitada → …).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'r' && e.key !== 'R') return
      const alvo = e.target as HTMLElement | null
      if (alvo && /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName)) return
      setOrient(o => (o === 'auto' ? 'retrato' : o === 'retrato' ? 'paisagem' : 'auto'))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const paginas: Record<string, any>[][] = []
  if (porPessoa) for (let i = 0; i < dados.length; i += porFolha) paginas.push(dados.slice(i, i + porFolha))

  const css = `
    @media print {
      html, body, #root, .app-root, .app-root > main { height:auto !important; max-height:none !important; overflow:visible !important; display:block !important; background:#fff !important; }
      .app-root > header { display:none !important; }
      .no-print { display:none !important; }
      /* zera as folgas da tela: senão elas empurram uma fileira pra folha seguinte
         (deixava a folha do meio quase vazia). A conta de "quantos cabem" assume a folha limpa. */
      .ed-print-wrap { padding:0 !important; margin:0 !important; }
      .ed-pagina { margin:0 !important; }
      .ed-folha { break-inside:avoid; page-break-inside:avoid; }
      .ed-pagina:not(:last-child) { break-after:page; page-break-after:always; }
      * { -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
      @page { size: A4 ${orientacao === 'retrato' ? 'portrait' : 'landscape'}; margin: ${MARGEM}mm; }
    }
  `

  const chip = (ativo: boolean): React.CSSProperties => ({
    padding: '6px 12px', borderRadius: 99, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700,
    border: ativo ? '2px solid var(--primary)' : '1px solid var(--border)',
    background: ativo ? 'var(--primary-light)' : 'white', color: ativo ? 'var(--primary)' : 'var(--text2)',
  })

  return (
    <div className="ed-print-wrap" style={{ padding: 16, background: 'white' }}>
      <style>{css}</style>

      <div className="no-print" style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={() => window.print()}>Imprimir / Salvar PDF</button>
        <button className="btn btn-ghost" onClick={onVoltar}>Voltar</button>

        {/* Escolher a orientação da folha ANTES de imprimir (atalho: tecla R) */}
        <span style={{ width: 1, height: 22, background: 'var(--border)', margin: '0 2px' }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Folha:</span>
        {([['auto', 'Automática'], ['retrato', 'Em pé'], ['paisagem', 'Deitada']] as const).map(([k, lb]) => (
          <button key={k} type="button" onClick={() => setOrient(k)} style={chip(orient === k)}>{lb}</button>
        ))}

        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
          {porPessoa
            ? `${dados.length} pessoa(s) · ${porFolha} por folha (${enc.cols}×${enc.rows}) · A4 ${orientacao === 'retrato' ? 'em pé' : 'deitada'}${orient === 'auto' ? ' (automática)' : ''}`
            : `${doc.paginas.length} página(s) · A4 ${orientacao === 'retrato' ? 'em pé' : 'deitada'}`}
        </span>
      </div>

      {porPessoa && !cabeu && (
        <div className="no-print alert-box alert-warning" style={{ marginBottom: 10, fontSize: 12 }}>
          O modelo ({card.l}×{card.a}mm) é maior que a folha A4 — vai sair cortado. Diminua o tamanho em <b>Página</b>.
        </div>
      )}

      {porPessoa
        ? paginas.map((grupo, gi) => (
            <div key={gi} className="ed-pagina" style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, ${card.l}mm)`, gap: `${ESPACO}mm`, justifyContent: 'start', marginBottom: 12 }}>
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
