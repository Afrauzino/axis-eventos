// ─────────────────────────────────────────────────────────────
// Canvas — comportamento PADRÃO de todo elemento vive aqui:
// selecionar, arrastar, redimensionar, rotacionar.
// Nenhum tipo de elemento precisa reimplementar nada disso.
//
// A folha usa milímetros REAIS no CSS e é escalada pra caber na tela.
// Assim "o que você vê é o que imprime" (na impressão a escala é 1).
// ─────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react'
import type { Documento, Elemento, Id } from './tipos'
import { obterElemento } from './elementos'

const PX_POR_MM = 96 / 25.4  // 1mm em CSS ≈ 3.7795px

type Props = {
  doc: Documento
  paginaAtual: number
  selecao: Id[]
  selecionar: (ids: Id[]) => void
  moverSelecao: (patch: Partial<Elemento>) => void
  onExcluir?: (ids: Id[]) => void
  dados?: Record<string, any>
  onZoom?: (z: number) => void
}

type Arraste =
  | { modo: 'mover'; id: Id; x0: number; y0: number; ex: number; ey: number }
  | { modo: 'redim'; id: Id; canto: 'nw' | 'ne' | 'sw' | 'se'; x0: number; y0: number; ex: number; ey: number; ew: number; eh: number }
  | { modo: 'girar'; id: Id; cx: number; cy: number; ang0: number; rot0: number }
  | null

export default function Canvas({ doc, paginaAtual, selecao, selecionar, moverSelecao, onExcluir, dados }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const folhaRef = useRef<HTMLDivElement>(null)
  const [escala, setEscala] = useState(1)
  const arraste = useRef<Arraste>(null)
  const [guia, setGuia] = useState<{ v: boolean; h: boolean }>({ v: false, h: false })

  const pagina = doc.paginas[paginaAtual] ?? doc.paginas[0]

  // Escala pra folha caber na largura disponível
  useEffect(() => {
    const calc = () => {
      const w = wrapRef.current?.clientWidth ?? 0
      if (!w) return
      const larguraPx = doc.papel.largura * PX_POR_MM
      setEscala(Math.min(1, (w - 32) / larguraPx))
    }
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [doc.papel.largura])

  /** px da tela → mm do documento */
  const paraMm = (px: number) => px / (PX_POR_MM * escala)

  function pointerDownElemento(e: React.PointerEvent, el: Elemento) {
    if (el.bloqueado) return
    e.stopPropagation()
    selecionar([el.id])
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    arraste.current = { modo: 'mover', id: el.id, x0: e.clientX, y0: e.clientY, ex: el.x, ey: el.y }
  }

  function pointerDownAlca(e: React.PointerEvent, el: Elemento, canto: 'nw' | 'ne' | 'sw' | 'se') {
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    arraste.current = { modo: 'redim', id: el.id, canto, x0: e.clientX, y0: e.clientY, ex: el.x, ey: el.y, ew: el.w, eh: el.h }
  }

  function pointerDownGirar(e: React.PointerEvent, el: Elemento) {
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    const r = folhaRef.current!.getBoundingClientRect()
    const cx = r.left + (el.x + el.w / 2) * PX_POR_MM * escala
    const cy = r.top + (el.y + el.h / 2) * PX_POR_MM * escala
    const ang0 = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI
    arraste.current = { modo: 'girar', id: el.id, cx, cy, ang0, rot0: el.rot }
  }

  function pointerMove(e: React.PointerEvent) {
    const a = arraste.current
    if (!a) return
    if (a.modo === 'mover') {
      let nx = a.ex + paraMm(e.clientX - a.x0)
      let ny = a.ey + paraMm(e.clientY - a.y0)
      // Guia de alinhamento: gruda no centro da folha
      const el = pagina.elementos.find(x => x.id === a.id)!
      const cxFolha = doc.papel.largura / 2, cyFolha = doc.papel.altura / 2
      const cxEl = nx + el.w / 2, cyEl = ny + el.h / 2
      const perto = 1.5 // mm
      const gv = Math.abs(cxEl - cxFolha) < perto
      const gh = Math.abs(cyEl - cyFolha) < perto
      if (gv) nx = cxFolha - el.w / 2
      if (gh) ny = cyFolha - el.h / 2
      setGuia({ v: gv, h: gh })
      moverSelecao({ x: round(nx), y: round(ny) })
    } else if (a.modo === 'redim') {
      const dx = paraMm(e.clientX - a.x0), dy = paraMm(e.clientY - a.y0)
      let { ex: x, ey: y, ew: w, eh: h } = a
      if (a.canto === 'se') { w = a.ew + dx; h = a.eh + dy }
      if (a.canto === 'ne') { w = a.ew + dx; h = a.eh - dy; y = a.ey + dy }
      if (a.canto === 'sw') { w = a.ew - dx; h = a.eh + dy; x = a.ex + dx }
      if (a.canto === 'nw') { w = a.ew - dx; h = a.eh - dy; x = a.ex + dx; y = a.ey + dy }
      if (w < 4 || h < 4) return
      moverSelecao({ x: round(x), y: round(y), w: round(w), h: round(h) })
    } else if (a.modo === 'girar') {
      const ang = Math.atan2(e.clientY - a.cy, e.clientX - a.cx) * 180 / Math.PI
      let rot = Math.round(a.rot0 + (ang - a.ang0))
      if (e.shiftKey) rot = Math.round(rot / 15) * 15   // trava de 15° com Shift
      moverSelecao({ rot: ((rot % 360) + 360) % 360 })
    }
  }

  function pointerUp() { arraste.current = null; setGuia({ v: false, h: false }) }

  const larguraPx = doc.papel.largura * PX_POR_MM * escala
  const alturaPx = doc.papel.altura * PX_POR_MM * escala

  return (
    <div ref={wrapRef}
      onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerLeave={pointerUp}
      onPointerDown={() => selecionar([])}
      style={{ flex: 1, minHeight: 0, overflow: 'auto', background: '#f1f2f4', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: 16, touchAction: 'none' }}>

      <div style={{ width: larguraPx, height: alturaPx, position: 'relative', flexShrink: 0 }}>
        {/* Folha em mm reais, escalada pra caber */}
        <div ref={folhaRef}
          style={{
            width: `${doc.papel.largura}mm`, height: `${doc.papel.altura}mm`,
            transform: `scale(${escala})`, transformOrigin: 'top left',
            background: pagina?.fundo ?? '#ffffff', position: 'absolute', top: 0, left: 0,
            boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
          }}>

          {pagina?.elementos.map(el => {
            const def = obterElemento(el.tipo)
            if (!def || !el.visivel) return null
            const sel = selecao.includes(el.id)
            return (
              <div key={el.id}
                onPointerDown={e => pointerDownElemento(e, el)}
                style={{
                  position: 'absolute', left: `${el.x}mm`, top: `${el.y}mm`,
                  width: `${el.w}mm`, height: `${el.h}mm`,
                  transform: `rotate(${el.rot}deg)`, transformOrigin: 'center',
                  opacity: el.opacidade,
                  cursor: el.bloqueado ? 'default' : 'move',
                  outline: sel ? `${1.5 / escala}px solid var(--primary)` : undefined,
                }}>
                {def.Render({ el, dados, modo: 'tela' })}

                {sel && !el.bloqueado && (
                  <>
                    {(['nw', 'ne', 'sw', 'se'] as const).map(c => (
                      <span key={c} onPointerDown={e => pointerDownAlca(e, el, c)}
                        style={{
                          position: 'absolute', width: 9 / escala, height: 9 / escala,
                          background: 'white', border: `${1.5 / escala}px solid var(--primary)`, borderRadius: 1 / escala,
                          left: c[1] === 'w' ? -5 / escala : undefined, right: c[1] === 'e' ? -5 / escala : undefined,
                          top: c[0] === 'n' ? -5 / escala : undefined, bottom: c[0] === 's' ? -5 / escala : undefined,
                          cursor: c === 'nw' || c === 'se' ? 'nwse-resize' : 'nesw-resize',
                        }} />
                    ))}
                    <span onPointerDown={e => pointerDownGirar(e, el)}
                      style={{
                        position: 'absolute', left: '50%', top: -30 / escala, transform: 'translateX(-50%)',
                        width: 20 / escala, height: 20 / escala, borderRadius: '50%', background: 'white',
                        border: `${1.5 / escala}px solid var(--primary)`, cursor: 'grab',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)',
                      }}>
                      <span className="icon" style={{ fontSize: 13 / escala }}>rotate_right</span>
                    </span>

                    {/* Lixeira: apaga o que está selecionado, sem precisar abrir painel nenhum */}
                    {onExcluir && (
                      <span title="Excluir" role="button"
                        onPointerDown={e => e.stopPropagation()}
                        onClick={e => { e.stopPropagation(); onExcluir(selecao.length ? selecao : [el.id]) }}
                        style={{
                          position: 'absolute', right: -12 / escala, top: -30 / escala,
                          width: 20 / escala, height: 20 / escala, borderRadius: '50%', background: 'white',
                          border: `${1.5 / escala}px solid var(--danger)`, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger)',
                        }}>
                        <span className="icon" style={{ fontSize: 13 / escala }}>delete</span>
                      </span>
                    )}
                  </>
                )}
              </div>
            )
          })}

          {/* Guias de alinhamento (centro) */}
          {guia.v && <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1 / escala, background: '#E24B4A' }} />}
          {guia.h && <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1 / escala, background: '#E24B4A' }} />}
        </div>
      </div>
    </div>
  )
}

const round = (n: number) => Math.round(n * 10) / 10
