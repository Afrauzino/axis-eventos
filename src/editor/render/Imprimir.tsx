// ─────────────────────────────────────────────────────────────
// Impressão. Dois modos, decididos pelo documento:
//  • fonteDados = 'pessoas' → o modelo é repetido POR PESSOA e
//    encaixado (tiles) numa folha A4.
//  • fonteDados = null      → imprime as páginas do documento como estão.
//
// A pré-visualização mostra a FOLHA A4 DE VERDADE (com a margem), do jeitinho
// que sai impressa — o que você vê é o que imprime. Dá pra escolher a
// orientação e o TAMANHO do crachá (+/−) antes de imprimir.
// ─────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Documento } from '../tipos'
import { PX_POR_MM } from '../tipos'
import Folha from './Folha'

export const A4 = { retrato: { l: 210, a: 297 }, paisagem: { l: 297, a: 210 } }
const MARGEM = 8   // mm — margem da folha
const ESPACO = 3   // mm entre os cartões

export type Orientacao = 'auto' | 'retrato' | 'paisagem'

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))
const round1 = (n: number) => Math.round(n * 10) / 10

/** Quantos cartões cabem numa folha. */
function cabem(folha: { l: number; a: number }, card: { l: number; a: number }) {
  const util = { l: folha.l - MARGEM * 2, a: folha.a - MARGEM * 2 }
  let cols = Math.floor((util.l + ESPACO) / (card.l + ESPACO))
  let rows = Math.floor((util.a + ESPACO) / (card.a + ESPACO))
  // Modelo do tamanho da folha (ou quase): imprime 1 por página, SEM margem.
  // Sem isso, uma folha A4 "não cabia" no A4 — a margem de 8mm derrubava a conta.
  if (cols < 1 && card.l <= folha.l + 0.5) cols = 1
  if (rows < 1 && card.a <= folha.a + 0.5) rows = 1
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
  const cardBase = { l: doc.papel.largura, a: doc.papel.altura }

  // Escolhas feitas na hora (não mexem no modelo salvo).
  const [orient, setOrient] = useState<Orientacao>(forcar)
  const [tamanho, setTamanho] = useState(1)   // fator do tamanho do crachá (1 = tamanho do modelo)

  const card = { l: round1(cardBase.l * tamanho), a: round1(cardBase.a * tamanho) }
  const enc = encaixe({ largura: card.l, altura: card.a }, orient)
  const orientacao = enc.orientacao
  const cols = Math.max(1, enc.cols)
  const rows = Math.max(1, enc.rows)
  const porFolha = Math.max(1, enc.total)
  const cabeu = enc.cabe
  const folhaA4 = orientacao === 'retrato' ? A4.retrato : A4.paisagem

  // Margem da folha: normalmente MARGEM (8mm), mas encolhe quando os cartões
  // ocupam quase tudo — assim um modelo do tamanho da folha preenche até a borda
  // (senão o padding cortava a folha cheia). Centraliza o bloco na folha.
  const contentW = cols * card.l + (cols - 1) * ESPACO
  const contentH = rows * card.a + (rows - 1) * ESPACO
  const padL = Math.max(0, Math.min(MARGEM, (folhaA4.l - contentW) / 2))
  const padT = Math.max(0, Math.min(MARGEM, (folhaA4.a - contentH) / 2))

  const mudarTamanho = (delta: number) => setTamanho(t => clamp(round1(t + delta), 0.3, 3))

  // Atalhos: R gira a folha; + / − mudam o tamanho do crachá.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null
      if (alvo && /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName)) return
      if (e.key === 'r' || e.key === 'R') setOrient(o => (o === 'auto' ? 'retrato' : o === 'retrato' ? 'paisagem' : 'auto'))
      else if (porPessoa && (e.key === '+' || e.key === '=')) mudarTamanho(0.1)
      else if (porPessoa && (e.key === '-' || e.key === '_')) mudarTamanho(-0.1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [porPessoa])

  // Isola a impressão: marca o body pra, no @media print, ESCONDER o app inteiro
  // (#root) e imprimir só as folhas (que são portadas pro body). Sem isso, o
  // layout do app (cabeçalho, main com scroll…) entrava junto e gerava páginas em branco.
  useEffect(() => {
    document.body.classList.add('ed-imprimindo')
    return () => document.body.classList.remove('ed-imprimindo')
  }, [])

  // Ajuste da EXIBIÇÃO: encolhe a folha A4 pra caber na largura da tela (só na
  // tela — na impressão sai em tamanho real). Assim dá pra ver a folha inteira no celular.
  const wrapRef = useRef<HTMLDivElement>(null)
  const [fitTela, setFitTela] = useState(1)
  const sheetPxW = folhaA4.l * PX_POR_MM
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    // Só encolhe quando já tem largura de verdade (>0). Se calculasse com 0,
    // o zoom virava 0 e a folha sumia. ResizeObserver reage quando o container ganha tamanho.
    const calc = () => { const w = el.clientWidth; if (w > 0) setFitTela(Math.min(1, w / sheetPxW)) }
    calc()
    const ro = new ResizeObserver(calc)
    ro.observe(el)
    window.addEventListener('resize', calc)
    return () => { ro.disconnect(); window.removeEventListener('resize', calc) }
  }, [sheetPxW])

  const paginas: Record<string, any>[][] = []
  if (porPessoa) for (let i = 0; i < dados.length; i += porFolha) paginas.push(dados.slice(i, i + porFolha))

  const css = `
    /* O "encolher pra caber na tela" é SÓ de tela (via variável --fit). Na
       impressão o zoom nem existe — se existisse, a paginação furava (1 folha
       virava 3: vazia/conteúdo/vazia). */
    @media screen { .ed-stack { zoom: var(--fit, 1); } }
    @media print {
      html, body, #root, .app-root, .app-root > main { height:auto !important; max-height:none !important; overflow:visible !important; display:block !important; background:#fff !important; }
      .app-root > header { display:none !important; }
      .no-print { display:none !important; }
      /* isola a impressão: some com o app (que fica em #root) e imprime só as
         folhas (que estão portadas direto no body). Igual ao PrintOverlay. */
      body.ed-imprimindo > #root { display:none !important; }
      .ed-print-wrap { position:static !important; inset:auto !important; overflow:visible !important; height:auto !important; padding:0 !important; margin:0 !important; background:#fff !important; min-height:0 !important; z-index:auto !important; }
      /* cada folha = UMA página A4 exata. overflow:hidden (no inline) garante que
         nada escorra pra uma página extra. Sem height:auto (mantém o A4 fixo). */
      .ed-sheet { box-shadow:none !important; margin:0 !important; }
      .ed-sheet:not(:last-child) { break-after:page; page-break-after:always; }
      .ed-folha { break-inside:avoid; page-break-inside:avoid; }
      * { -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
      /* pra pessoas: a margem já está DENTRO da folha (padding), então @page sem margem */
      @page { size: A4 ${orientacao === 'retrato' ? 'portrait' : 'landscape'}; margin: ${porPessoa ? '0' : MARGEM + 'mm'}; }
    }
  `

  const chip = (ativo: boolean): React.CSSProperties => ({
    padding: '6px 12px', borderRadius: 99, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700,
    border: ativo ? '2px solid var(--primary)' : '1px solid var(--border)',
    background: ativo ? 'var(--primary-light)' : 'white', color: ativo ? 'var(--primary)' : 'var(--text2)',
  })
  const btnMais: React.CSSProperties = {
    width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'white',
    cursor: 'pointer', fontFamily: 'inherit', fontSize: 18, fontWeight: 800, color: 'var(--primary)', lineHeight: 1,
  }

  return createPortal(
    <div className="ed-print-wrap" style={{ position: 'fixed', inset: 0, overflowY: 'auto', padding: 12, background: '#eceef1', zIndex: 1000 }}>
      <style>{css}</style>

      <div className="no-print" style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={() => window.print()}>Imprimir / Salvar PDF</button>
        <button className="btn btn-ghost" onClick={onVoltar}>Voltar</button>

        {/* Orientação da folha (atalho: tecla R) */}
        <span style={{ width: 1, height: 22, background: 'var(--border)', margin: '0 2px' }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Folha:</span>
        {([['auto', 'Automática'], ['retrato', 'Em pé'], ['paisagem', 'Deitada']] as const).map(([k, lb]) => (
          <button key={k} type="button" onClick={() => setOrient(k)} style={chip(orient === k)}>{lb}</button>
        ))}

        {/* Tamanho do crachá (+/−) — reflete na impressão */}
        {porPessoa && (
          <>
            <span style={{ width: 1, height: 22, background: 'var(--border)', margin: '0 2px' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Tamanho:</span>
            <button type="button" title="Diminuir (tecla −)" onClick={() => mudarTamanho(-0.1)} style={btnMais}>−</button>
            <span style={{ fontSize: 13, fontWeight: 800, minWidth: 44, textAlign: 'center', color: 'var(--text2)' }}>{Math.round(tamanho * 100)}%</span>
            <button type="button" title="Aumentar (tecla +)" onClick={() => mudarTamanho(0.1)} style={btnMais}>+</button>
            {tamanho !== 1 && (
              <button type="button" onClick={() => setTamanho(1)} style={{ ...chip(false), padding: '5px 10px' }}>Tamanho do modelo</button>
            )}
          </>
        )}

        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
          {porPessoa
            ? `${dados.length} pessoa(s) · ${porFolha} por folha (${enc.cols}×${enc.rows}) · crachá ${card.l}×${card.a}mm · A4 ${orientacao === 'retrato' ? 'em pé' : 'deitada'}`
            : `${doc.paginas.length} página(s) · A4 ${orientacao === 'retrato' ? 'em pé' : 'deitada'}`}
        </span>
      </div>

      {porPessoa && !cabeu && (
        <div className="no-print alert-box alert-warning" style={{ marginBottom: 10, fontSize: 12 }}>
          O crachá ({card.l}×{card.a}mm) é maior que a folha A4 — vai sair cortado. Diminua o tamanho (−) ou o modelo em <b>Página</b>.
        </div>
      )}

      <div ref={wrapRef}>
        <div className="ed-stack" style={{ ['--fit' as any]: fitTela }}>
          {porPessoa
            ? paginas.map((grupo, gi) => (
                <div key={gi} className="ed-sheet" style={{
                  width: `${folhaA4.l}mm`, height: `${folhaA4.a}mm`, padding: `${padT}mm ${padL}mm`, boxSizing: 'border-box',
                  background: 'white', boxShadow: '0 2px 12px rgba(0,0,0,0.18)', margin: '0 auto 14px', overflow: 'hidden',
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, ${card.l}mm)`, gap: `${ESPACO}mm`, justifyContent: 'start', alignContent: 'start' }}>
                    {grupo.map((d, i) => (
                      <div key={i} className="ed-folha" style={{ width: `${card.l}mm`, height: `${card.a}mm`, overflow: 'hidden', outline: '0.2mm dashed #d1d5db' }}>
                        <div style={{ width: `${cardBase.l}mm`, height: `${cardBase.a}mm`, transform: `scale(${tamanho})`, transformOrigin: 'top left' }}>
                          <Folha doc={doc} pagina={doc.paginas[0]} dados={d} modo="papel" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            : doc.paginas.map(pg => (
                <div key={pg.id} className="ed-sheet ed-folha" style={{
                  margin: '0 auto 14px', width: 'fit-content', background: 'white',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.18)', outline: '0.2mm dashed #d1d5db',
                }}>
                  <Folha doc={doc} pagina={pg} modo="papel" />
                </div>
              ))}
        </div>
      </div>
    </div>,
    document.body,
  )
}
