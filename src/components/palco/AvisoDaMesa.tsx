import { useEffect, useRef, useState } from 'react'
import { bipe, vibrar } from '../../lib/palco'
import { Brilho, vidroBotao, vidroPainel } from './vidro'

// Recado da MESA aparecendo no PALCO (/ped e aba Palco do /cel).
// Chega grande na tela inteira (vibra + bipe). Depois de 10 s sem resposta vira
// uma faixa no topo, pra não travar os botões no meio da música. "OK, entendi"
// (ou qualquer tecla 1–6 do pedal físico com o aviso aberto) avisa a mesa que leu.

export type AvisoPalco = { id: string; texto: string; criado_em: string; so_meu?: boolean }
const MINIMIZA_MS = 10000

export default function AvisoDaMesa({ avisos, onCiente }: { avisos: AvisoPalco[]; onCiente: (id: string) => void }) {
  const atual = avisos[0] ?? null
  const [minimizado, setMinimizado] = useState<string | null>(null)   // id do aviso minimizado
  const alertados = useRef(new Set<string>())

  // novo aviso: vibra + bipe, abre grande e minimiza sozinho depois de 10 s
  useEffect(() => {
    if (!atual) return
    if (!alertados.current.has(atual.id)) {
      alertados.current.add(atual.id)
      vibrar([300, 120, 300]); bipe('novo')
    }
    const t = window.setTimeout(() => setMinimizado(atual.id), MINIMIZA_MS)
    return () => window.clearTimeout(t)
  }, [atual?.id])

  const grande = !!atual && minimizado !== atual.id

  // pedal físico: com o aviso GRANDE aberto, qualquer tecla 1–6/A–F/Enter/Espaço = "OK"
  useEffect(() => {
    if (!grande || !atual) return
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (/^[1-6a-fA-F]$/.test(e.key) || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault(); e.stopImmediatePropagation(); onCiente(atual.id)
      }
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [grande, atual?.id, onCiente])

  if (!atual) return null
  const mais = avisos.length - 1

  if (!grande) return (
    <button onClick={() => onCiente(atual.id)}
      style={{ position: 'fixed', top: 'max(10px, env(safe-area-inset-top))', left: 12, right: 12, zIndex: 65, ...vidroBotao('#0ea5e9'), color: 'white',
               borderRadius: 18, padding: '12px 16px', fontFamily: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}>
      <Brilho raio={18} />
      <span style={{ fontSize: 22 }}>📣</span>
      <span style={{ flex: 1, fontSize: 17, fontWeight: 800, position: 'relative' }}>{atual.texto}{mais > 0 ? `  (+${mais})` : ''}</span>
      <span style={{ fontSize: 14, fontWeight: 900, background: 'rgba(255,255,255,.2)', borderRadius: 10, padding: '6px 10px', position: 'relative' }}>OK</span>
    </button>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 65, background: 'rgba(5,7,13,.55)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <style>{`@keyframes avisoEntra { from { transform: scale(.9); opacity: 0 } to { transform: scale(1); opacity: 1 } }
               @keyframes avisoBrilha { 0%,100% { box-shadow: 0 0 0 3px #38bdf8, 0 0 30px rgba(56,189,248,.5) } 50% { box-shadow: 0 0 0 3px #ffffff, 0 0 60px 10px rgba(56,189,248,.7) } }`}</style>
      <div style={{ ...vidroPainel(.55), position: 'relative', borderRadius: 32, padding: 'clamp(20px, 4vmin, 36px)', width: '100%', maxWidth: 760, textAlign: 'center', color: 'white',
                    animation: 'avisoEntra .25s ease-out, avisoBrilha 1.2s ease-in-out infinite' }}>
        <Brilho raio={32} />
        <div style={{ position: 'relative', fontSize: 'clamp(15px, 2.6vmin, 22px)', fontWeight: 900, letterSpacing: 1, color: '#7dd3fc' }}>
          📣 RECADO DA MESA DE SOM{atual.so_meu ? ' · PRA VOCÊ' : ''}
        </div>
        <div style={{ position: 'relative', fontSize: 'clamp(30px, 8vmin, 76px)', fontWeight: 900, lineHeight: 1.1, margin: '14px 0 22px', overflowWrap: 'break-word', textShadow: '0 2px 10px rgba(0,0,0,.4)' }}>
          {atual.texto}
        </div>
        <button onClick={() => onCiente(atual.id)}
          style={{ ...vidroBotao('#16a34a'), position: 'relative', color: 'white', borderRadius: 20, padding: '16px 34px', fontSize: 'clamp(18px, 3.4vmin, 28px)', fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit' }}>
          👍 OK, entendi
        </button>
        {mais > 0 && <div style={{ position: 'relative', marginTop: 12, fontSize: 14, color: '#cbd5e1' }}>+{mais} recado(s) depois deste</div>}
        <button onClick={() => setMinimizado(atual.id)}
          style={{ position: 'relative', display: 'block', margin: '12px auto 0', background: 'none', border: 'none', color: '#94a3b8', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}>
          Ver depois
        </button>
      </div>
    </div>
  )
}
