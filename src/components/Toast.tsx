/**
 * Toast — avisos amigáveis (padrão visual AXIS).
 * Card branco, barra colorida à esquerda, emoji colorido, some sozinho.
 * Uso em qualquer lugar (inclusive fora de componente):
 *   import { toast } from '../components/Toast'
 *   toast.sucesso('Salvo!')
 *   toast.falha('Não foi possível salvar', err)  // detecta falta de internet
 * Basta ter <ToastHost/> montado uma vez no App.
 */
import { useEffect, useState } from 'react'

export type ToastTipo = 'sucesso' | 'erro' | 'info' | 'aviso'
type ToastItem = { id: number; tipo: ToastTipo; texto: string }

const ESTILO: Record<ToastTipo, { cor: string; emoji: string }> = {
  sucesso: { cor: 'var(--success)', emoji: '✅' },
  erro:    { cor: 'var(--danger)',  emoji: '❌' },
  info:    { cor: 'var(--primary)', emoji: 'ℹ️' },
  aviso:   { cor: 'var(--warning)', emoji: '⚠️' },
}

let seq = 1
const listeners = new Set<(t: ToastItem) => void>()
function emitir(tipo: ToastTipo, texto: string) {
  const item = { id: seq++, tipo, texto }
  listeners.forEach(l => l(item))
}

function semInternet() {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

export const toast = {
  sucesso: (texto: string) => emitir('sucesso', texto),
  erro:    (texto: string) => emitir('erro', texto),
  info:    (texto: string) => emitir('info', texto),
  aviso:   (texto: string) => emitir('aviso', texto),
  /**
   * Falha de operação: se estiver offline, mostra "Sem internet"; senão a
   * mensagem amigável em português. `err` é opcional (só pra logar no console).
   */
  falha: (msgAmigavel: string, err?: unknown) => {
    if (err) { try { console.error(msgAmigavel, err) } catch {} }
    if (semInternet()) {
      emitir('aviso', 'Sem internet. Verifique sua conexão e tente de novo.')
    } else {
      emitir('erro', msgAmigavel)
    }
  },
}

export function ToastHost() {
  const [itens, setItens] = useState<ToastItem[]>([])

  useEffect(() => {
    const add = (t: ToastItem) => {
      setItens(prev => [...prev.slice(-2), t]) // no máximo 3 na tela
      const dur = t.tipo === 'erro' || t.tipo === 'aviso' ? 5000 : 3000
      setTimeout(() => setItens(prev => prev.filter(x => x.id !== t.id)), dur)
    }
    listeners.add(add)

    const aoFicarOffline = () => emitir('aviso', 'Você está sem internet. As mudanças podem não ser salvas.')
    const aoVoltarOnline = () => emitir('sucesso', 'Conexão restabelecida.')
    window.addEventListener('offline', aoFicarOffline)
    window.addEventListener('online', aoVoltarOnline)

    return () => {
      listeners.delete(add)
      window.removeEventListener('offline', aoFicarOffline)
      window.removeEventListener('online', aoVoltarOnline)
    }
  }, [])

  if (itens.length === 0) return null

  return (
    <div style={{
      position:'fixed', left:0, right:0,
      bottom:'calc(24px + env(safe-area-inset-bottom))',
      zIndex:900, display:'flex', flexDirection:'column',
      alignItems:'center', gap:8, pointerEvents:'none', padding:'0 16px',
    }}>
      {itens.map(t => {
        const e = ESTILO[t.tipo]
        return (
          <div
            key={t.id}
            className="toast-item"
            onClick={() => setItens(prev => prev.filter(x => x.id !== t.id))}
            style={{
              pointerEvents:'auto', cursor:'pointer',
              display:'flex', alignItems:'center', gap:10,
              background:'white', borderRadius:12,
              boxShadow:'0 4px 18px rgba(0,0,0,0.18)',
              padding:'12px 14px', maxWidth:480, width:'100%',
              borderLeft:`5px solid ${e.cor}`,
            }}
          >
            <span style={{fontSize:20, lineHeight:1, flexShrink:0}}>{e.emoji}</span>
            <span style={{fontSize:14, fontWeight:600, color:'var(--text)', flex:1, minWidth:0}}>{t.texto}</span>
          </div>
        )
      })}
    </div>
  )
}
