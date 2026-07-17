// ─────────────────────────────────────────────────────────────
// Canvas — comportamento PADRÃO de todo elemento vive aqui:
// selecionar, arrastar, redimensionar, rotacionar.
// Nenhum tipo de elemento precisa reimplementar nada disso.
//
// A folha usa milímetros REAIS no CSS e é escalada pra caber na tela.
// No celular: PINÇA (2 dedos) dá zoom; alças grandes pro dedo; e o menu
// nativo de "segurar" fica desligado (atrapalhava).
// ─────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react'
import type { Documento, Elemento, Id } from './tipos'
import { PX_POR_MM } from './tipos'
import { obterElemento } from './elementos'
import { estiloBorda, estiloRecorte } from './borda'

type Props = {
  doc: Documento
  paginaAtual: number
  selecao: Id[]
  selecionar: (ids: Id[]) => void
  moverSelecao: (patch: Partial<Elemento>) => void
  onFimGesto?: () => void
  onExcluir?: (ids: Id[]) => void
  somenteLeitura?: boolean
  dados?: Record<string, any>
  onZoom?: (z: number) => void
}

type Arraste =
  | { modo: 'mover'; id: Id; x0: number; y0: number; ex: number; ey: number }
  | { modo: 'redim'; id: Id; canto: 'nw' | 'ne' | 'sw' | 'se'; x0: number; y0: number; ex: number; ey: number; ew: number; eh: number }
  | { modo: 'girar'; id: Id; cx: number; cy: number; ang0: number; rot0: number }
  | null

const dist = (a: {x:number;y:number}, b: {x:number;y:number}) => Math.hypot(a.x - b.x, a.y - b.y)
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))

export default function Canvas({ doc, paginaAtual, selecao, selecionar, moverSelecao, onFimGesto, onExcluir, dados, somenteLeitura }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const folhaRef = useRef<HTMLDivElement>(null)
  const [escalaFit, setEscalaFit] = useState(1)   // escala pra caber na largura
  const [zoom, setZoom] = useState(1)              // zoom do usuário (pinça)
  const esc = escalaFit * zoom                     // escala efetiva usada em tudo
  const arraste = useRef<Arraste>(null)
  const [guia, setGuia] = useState<{ v: boolean; h: boolean }>({ v: false, h: false })

  // Pinça (2 dedos)
  const pontos = useRef<Map<number, { x: number; y: number }>>(new Map())
  const pinca = useRef<{ d0: number; z0: number } | null>(null)

  const pagina = doc.paginas[paginaAtual] ?? doc.paginas[0]

  // Escala pra folha caber na largura disponível
  useEffect(() => {
    const calc = () => {
      const w = wrapRef.current?.clientWidth ?? 0
      if (!w) return
      const larguraPx = doc.papel.largura * PX_POR_MM
      setEscalaFit(Math.min(1, (w - 32) / larguraPx))
    }
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [doc.papel.largura])

  /** px da tela → mm do documento */
  const paraMm = (px: number) => px / (PX_POR_MM * esc)

  // ---- Pinça: rastreia todos os dedos na fase de captura (mesmo em cima de um elemento) ----
  function onDownCapture(e: React.PointerEvent) {
    if (e.pointerType !== 'touch') return
    pontos.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pontos.current.size === 2) {
      arraste.current = null                       // 2 dedos = pinça, cancela arrastar
      const [a, b] = [...pontos.current.values()]
      pinca.current = { d0: dist(a, b) || 1, z0: zoom }
    }
  }
  function onMoveCapture(e: React.PointerEvent) {
    if (e.pointerType !== 'touch' || !pontos.current.has(e.pointerId)) return
    pontos.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pinca.current && pontos.current.size >= 2) {
      const [a, b] = [...pontos.current.values()]
      setZoom(clamp(pinca.current.z0 * (dist(a, b) / pinca.current.d0), 0.4, 5))
    }
  }
  function onUpCapture(e: React.PointerEvent) {
    pontos.current.delete(e.pointerId)
    if (pontos.current.size < 2) pinca.current = null
  }

  function pointerDownElemento(e: React.PointerEvent, el: Elemento) {
    if (somenteLeitura || el.bloqueado) return   // só-leitura: não seleciona nem arrasta
    if (pontos.current.size >= 2) return          // pinça em andamento: não arrasta
    e.stopPropagation()
    selecionar([el.id])
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    arraste.current = { modo: 'mover', id: el.id, x0: e.clientX, y0: e.clientY, ex: el.x, ey: el.y }
  }

  function pointerDownAlca(e: React.PointerEvent, el: Elemento, canto: 'nw' | 'ne' | 'sw' | 'se') {
    if (pontos.current.size >= 2) return
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    arraste.current = { modo: 'redim', id: el.id, canto, x0: e.clientX, y0: e.clientY, ex: el.x, ey: el.y, ew: el.w, eh: el.h }
  }

  function pointerDownGirar(e: React.PointerEvent, el: Elemento) {
    if (pontos.current.size >= 2) return
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    const r = folhaRef.current!.getBoundingClientRect()
    const cx = r.left + (el.x + el.w / 2) * PX_POR_MM * esc
    const cy = r.top + (el.y + el.h / 2) * PX_POR_MM * esc
    const ang0 = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI
    arraste.current = { modo: 'girar', id: el.id, cx, cy, ang0, rot0: el.rot }
  }

  function pointerMove(e: React.PointerEvent) {
    if (pinca.current) return                      // durante a pinça, não arrasta/redimensiona
    const a = arraste.current
    if (!a) return
    if (a.modo === 'mover') {
      let nx = a.ex + paraMm(e.clientX - a.x0)
      let ny = a.ey + paraMm(e.clientY - a.y0)
      const el = pagina.elementos.find(x => x.id === a.id)!
      const cxFolha = doc.papel.largura / 2, cyFolha = doc.papel.altura / 2
      const cxEl = nx + el.w / 2, cyEl = ny + el.h / 2
      const perto = 1.5 // mm
      const gv = Math.abs(cxEl - cxFolha) < perto
      const gh = Math.abs(cyEl - cyFolha) < perto
      if (gv) nx = cxFolha - el.w / 2
      if (gh) ny = cyFolha - el.h / 2
      setGuia(g => (g.v === gv && g.h === gh ? g : { v: gv, h: gh }))
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
      if (e.shiftKey) rot = Math.round(rot / 15) * 15
      moverSelecao({ rot: ((rot % 360) + 360) % 360 })
    }
  }

  function pointerUp(e: React.PointerEvent) {
    onUpCapture(e)
    if (arraste.current) onFimGesto?.()
    arraste.current = null
    setGuia(g => (g.v || g.h ? { v: false, h: false } : g))
  }

  const larguraPx = doc.papel.largura * PX_POR_MM * esc
  const alturaPx = doc.papel.altura * PX_POR_MM * esc

  // alças grandes pro dedo (área de toque ~36px na tela; quadrado visível ~13px)
  const HIT = 36 / esc, SQ = 13 / esc

  return (
    <div ref={wrapRef}
      onPointerDownCapture={onDownCapture} onPointerMoveCapture={onMoveCapture}
      onPointerUpCapture={onUpCapture} onPointerCancelCapture={onUpCapture}
      onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerLeave={pointerUp}
      onPointerDown={() => { if (pontos.current.size < 2) selecionar([]) }}
      onContextMenu={e => e.preventDefault()}
      style={{ flex: 1, minHeight: 0, overflow: 'auto', background: '#f1f2f4', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: 16, touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' as any, position: 'relative' }}>

      <div style={{ width: larguraPx, height: alturaPx, position: 'relative', flexShrink: 0 }}>
        {/* Folha em mm reais, escalada pra caber */}
        <div ref={folhaRef}
          style={{
            width: `${doc.papel.largura}mm`, height: `${doc.papel.altura}mm`,
            transform: `scale(${esc})`, transformOrigin: 'top left',
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
                  outline: sel ? `${1.5 / esc}px solid var(--primary)` : undefined,
                  ...estiloBorda(el),
                }}>
                <div style={estiloRecorte(el)}>{def.Render({ el, dados, modo: 'tela' })}</div>

                {sel && !el.bloqueado && !somenteLeitura && (
                  <>
                    {(['nw', 'ne', 'sw', 'se'] as const).map(c => (
                      <span key={c} onPointerDown={e => pointerDownAlca(e, el, c)}
                        style={{
                          position: 'absolute', width: HIT, height: HIT, zIndex: 3,
                          left: c[1] === 'w' ? -HIT / 2 : undefined, right: c[1] === 'e' ? -HIT / 2 : undefined,
                          top: c[0] === 'n' ? -HIT / 2 : undefined, bottom: c[0] === 's' ? -HIT / 2 : undefined,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'none',
                          cursor: c === 'nw' || c === 'se' ? 'nwse-resize' : 'nesw-resize',
                        }}>
                        <span style={{
                          width: SQ, height: SQ, background: 'white',
                          border: `${2 / esc}px solid var(--primary)`, borderRadius: 2 / esc,
                          boxShadow: `0 ${1 / esc}px ${3 / esc}px rgba(0,0,0,0.35)`,
                        }} />
                      </span>
                    ))}
                    <span onPointerDown={e => pointerDownGirar(e, el)}
                      style={{
                        position: 'absolute', left: '50%', top: -36 / esc, transform: 'translateX(-50%)',
                        width: 26 / esc, height: 26 / esc, borderRadius: '50%', background: 'white',
                        border: `${1.5 / esc}px solid var(--primary)`, cursor: 'grab', touchAction: 'none', zIndex: 3,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)',
                      }}>
                      <span className="icon" style={{ fontSize: 16 / esc }}>rotate_right</span>
                    </span>

                    {/* Lixeira: apaga o que está selecionado, sem precisar abrir painel nenhum */}
                    {onExcluir && (
                      <span title="Excluir" role="button"
                        onPointerDown={e => e.stopPropagation()}
                        onClick={e => { e.stopPropagation(); onExcluir(selecao.length ? selecao : [el.id]) }}
                        style={{
                          position: 'absolute', right: -14 / esc, top: -36 / esc,
                          width: 26 / esc, height: 26 / esc, borderRadius: '50%', background: 'white',
                          border: `${1.5 / esc}px solid var(--danger)`, cursor: 'pointer', touchAction: 'none', zIndex: 3,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger)',
                        }}>
                        <span className="icon" style={{ fontSize: 16 / esc }}>delete</span>
                      </span>
                    )}
                  </>
                )}
              </div>
            )
          })}

          {/* Guias de alinhamento (centro) */}
          {guia.v && <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1 / esc, background: '#E24B4A' }} />}
          {guia.h && <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1 / esc, background: '#E24B4A' }} />}
        </div>
      </div>

      {/* Zoom: aparece só quando ampliado, pra voltar ao ajuste */}
      {Math.abs(zoom - 1) > 0.02 && (
        <button type="button" onClick={() => setZoom(1)}
          style={{ position: 'absolute', right: 12, bottom: 12, zIndex: 20, background: 'white', border: '1px solid var(--border)',
            borderRadius: 99, padding: '7px 12px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
            color: 'var(--text2)', boxShadow: '0 2px 10px rgba(0,0,0,0.18)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="icon icon-sm">fit_screen</span> {Math.round(zoom * 100)}%
        </button>
      )}
    </div>
  )
}

const round = (n: number) => Math.round(n * 10) / 10
