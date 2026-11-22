import { useCallback, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { bipe, haQuanto, type PalcoChamado } from '../../lib/palco'

// Lógica e peças da MESA compartilhadas entre /mesa e a aba Mesa do /cel.

export type MesaEstado = {
  canal: { id: string; nome: string; sinal: string }
  pedais: { id: string; nome: string; online: boolean }[]
  abertos: PalcoChamado[]
  recentes: PalcoChamado[]
  agora: string
}

const LEMBRETE_MS = 30000

/** Lógica da mesa (poll, alerta, marcar) — compartilhada com a aba Mesa do /cel. */
export function useMesa(estado: MesaEstado | null, setEstado: React.Dispatch<React.SetStateAction<any>>, token: string | null, avisar: () => void, puxar: () => void, som: boolean) {
  const somRef = useRef(som)
  somRef.current = som
  useEffect(() => {
    const t = setInterval(() => {
      if (somRef.current && estado?.abertos.some(c => c.status === 'aberto')) bipe('novo')
    }, LEMBRETE_MS)
    return () => clearInterval(t)
  }, [estado])

  return useCallback(async (id: string | null, status: 'visto' | 'resolvido') => {
    if (!token) return
    setEstado((e: MesaEstado | null) => {
      if (!e) return e
      if (status === 'resolvido') {
        const sai = e.abertos.filter(c => id === null || c.id === id).map(c => ({ ...c, status: 'resolvido' as const, atualizado_em: new Date().toISOString() }))
        return { ...e, abertos: e.abertos.filter(c => !(id === null || c.id === id)), recentes: [...sai, ...e.recentes].slice(0, 15) }
      }
      return { ...e, abertos: e.abertos.map(c => (c.id === id ? { ...c, status: 'visto' } : c)) }
    })
    if (somRef.current && status === 'resolvido') bipe('ok')
    const { error } = await supabase.rpc('palco_mesa_marcar', { p_token: token, p_chamado: id, p_status: status })
    if (error) puxar()
    else avisar()
  }, [token, avisar, puxar, setEstado])
}

export function Recentes({ recentes, agora }: { recentes: PalcoChamado[]; agora: number }) {
  if (!recentes.length) return null
  return (
    <div style={{ padding: '8px 14px', display: 'flex', gap: 8, overflowX: 'auto', whiteSpace: 'nowrap', flexShrink: 0 }}>
      <span style={{ fontSize: 12, color: '#64748b', fontWeight: 800, alignSelf: 'center' }}>RECENTES</span>
      {recentes.map(r => (
        <span key={r.id} style={{ fontSize: 12, borderRadius: 99, padding: '4px 10px', background: 'rgba(15,23,42,.5)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', color: '#cbd5e1', border: '1px solid rgba(255,255,255,.1)' }}>
          <b style={{ color: r.cor }}>■</b> {r.nome}{r.detalhe ? ` (${r.detalhe})` : ''} · {r.pedal_nome} · {r.status === 'cancelado' ? 'cancelado pelo palco' : 'resolvido'} {haQuanto(r.atualizado_em, agora)}
        </span>
      ))}
    </div>
  )
}

