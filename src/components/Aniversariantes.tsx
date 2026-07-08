import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getInitials } from '../utils'
import { estiloFundo, medirAspecto, type BlocoFundo } from '../lib/blocoFundo'

// Aniversariantes do mês (tela inicial). Usa people.birth_date.
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

type Aniv = { id: string; name: string; photo_url: string | null; dia: number }

export default function Aniversariantes({ eventoId, fundo, onEditar }: { eventoId?: string; fundo?: BlocoFundo; onEditar?: (aspecto: number) => void }) {
  const [lista, setLista] = useState<Aniv[]>([])
  const [carregado, setCarregado] = useState(false)
  const headerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!eventoId) { setCarregado(true); return }
    supabase.from('people').select('id,name,photo_url,birth_date').eq('event_id', eventoId).not('birth_date', 'is', null)
      .then(({ data }) => {
        const mes = new Date().getMonth() + 1
        const doMes = (data ?? [])
          .filter((p: any) => Number(String(p.birth_date).slice(5, 7)) === mes)
          .map((p: any) => ({ id: p.id, name: p.name, photo_url: p.photo_url, dia: Number(String(p.birth_date).slice(8, 10)) }))
          .sort((a, b) => a.dia - b.dia)
        setLista(doMes)
        setCarregado(true)
      })
  }, [eventoId])

  if (!carregado || lista.length === 0) return null
  const hoje = new Date().getDate()
  const mesNome = MESES[new Date().getMonth()]

  return (
    <div style={{ background: 'white', borderRadius: 14, boxShadow: 'var(--shadow-sm)', overflow: 'hidden', marginBottom: 16 }}>
      <div ref={headerRef} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '12px 14px', ...estiloFundo(fundo, 'linear-gradient(135deg,#ED64A6,#B83280)') }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: 20 }}>🎂</span>
          <div>
            <p style={{ fontWeight: 800, fontSize: 15, color: 'white', lineHeight: 1.1 }}>Aniversariantes de {mesNome}</p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>{lista.length} no mês</p>
          </div>
        </div>
        {onEditar && (
          <button onClick={() => onEditar(medirAspecto(headerRef.current))} title="Cor / imagem" style={{ background: 'rgba(255,255,255,0.22)', border: 'none', borderRadius: 8, width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontFamily: 'inherit', flexShrink: 0 }}>
            <span className="icon icon-sm">palette</span>
          </button>
        )}
      </div>
      <div style={{ maxHeight: 320, overflowY: 'auto' }}>
        {lista.map((p, i) => {
          const ehHoje = p.dia === hoje
          return (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: i < lista.length - 1 ? '1px solid var(--border)' : 'none', background: ehHoje ? '#FFF5F9' : 'white' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {p.photo_url ? <img src={p.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>{getInitials(p.name)}</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</p>
                {ehHoje && <p style={{ fontSize: 11, color: '#B83280', fontWeight: 800 }}>🎉 É hoje!</p>}
              </div>
              <div style={{ textAlign: 'center', flexShrink: 0, background: ehHoje ? '#B83280' : 'var(--bg)', borderRadius: 10, padding: '5px 10px', minWidth: 44 }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: ehHoje ? 'white' : 'var(--text)' }}>{String(p.dia).padStart(2, '0')}</div>
                <div style={{ fontSize: 9, fontWeight: 700, color: ehHoje ? 'rgba(255,255,255,0.85)' : 'var(--muted)', letterSpacing: '0.05em' }}>{mesNome.slice(0, 3).toUpperCase()}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
