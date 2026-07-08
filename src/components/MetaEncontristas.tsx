import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { carregarConfig, salvarConfig } from '../lib/tema'
import { useVoltarFecha } from '../hooks/useVoltarFecha'
import { toast } from './Toast'

// Meta de encontristas (configurável pelo admin). Barra de progresso.
const CHAVE = 'meta_encontristas'

export default function MetaEncontristas({ eventoId, admin }: { eventoId?: string; admin: boolean }) {
  const [total, setTotal] = useState(0)
  const [meta, setMeta] = useState(0)
  const [carregado, setCarregado] = useState(false)
  const [editando, setEditando] = useState(false)
  const [rascunho, setRascunho] = useState('')
  const [salvando, setSalvando] = useState(false)
  useVoltarFecha(editando, () => setEditando(false))

  async function carregar() {
    if (!eventoId) { setCarregado(true); return }
    const [{ count }, cfg] = await Promise.all([
      supabase.from('people').select('id', { count: 'exact', head: true }).eq('event_id', eventoId).eq('role_type', 'encounterer'),
      carregarConfig(CHAVE),
    ])
    setTotal(count ?? 0)
    setMeta(Number(cfg ?? 0) || 0)
    setCarregado(true)
  }
  useEffect(() => { carregar() }, [eventoId])

  async function salvar() {
    const n = Math.max(0, Math.round(Number(rascunho) || 0))
    setSalvando(true)
    const ok = await salvarConfig(CHAVE, String(n))
    setSalvando(false)
    if (!ok) { toast.falha('Não foi possível salvar a meta.'); return }
    setMeta(n); setEditando(false)
    toast.sucesso('Meta atualizada!')
  }

  if (!carregado) return null
  if (meta <= 0 && !admin) return null // sem meta definida, some para não-admin

  const pct = meta > 0 ? Math.min(100, Math.round((total / meta) * 100)) : 0
  const bateu = meta > 0 && total >= meta

  return (
    <div style={{ background: 'linear-gradient(135deg,#2F855A,#276749)', borderRadius: 14, padding: '16px', marginBottom: 16, boxShadow: '0 4px 14px rgba(0,0,0,0.15)', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 18 }}>🎯</span>
          <span style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.92)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Meta de encontristas</span>
        </div>
        {admin && (
          <button onClick={() => { setRascunho(meta ? String(meta) : ''); setEditando(true) }} title="Definir meta"
            style={{ background: 'rgba(255,255,255,0.22)', border: 'none', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontFamily: 'inherit' }}>
            <span className="icon icon-sm">edit</span>
          </button>
        )}
      </div>

      {meta <= 0 ? (
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)' }}>Defina uma meta no ✏️ para acompanhar o progresso.</p>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 30, fontWeight: 800, color: 'white', lineHeight: 1 }}>{total}</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>/ {meta}</span>
            <span style={{ marginLeft: 'auto', fontSize: 15, fontWeight: 800, color: 'white' }}>{pct}%</span>
          </div>
          <div style={{ height: 12, background: 'rgba(255,255,255,0.25)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: 'white', borderRadius: 99, transition: 'width 0.5s ease' }} />
          </div>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 8, fontWeight: 600 }}>
            {bateu ? '🎉 Meta alcançada!' : `Faltam ${meta - total} para a meta`}
          </p>
        </>
      )}

      {editando && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 400, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
          onClick={e => e.target === e.currentTarget && setEditando(false)}>
          <div style={{ background: 'white', borderRadius: '20px 20px 0 0', padding: '8px 20px 28px', maxWidth: 480, width: '100%', margin: '0 auto' }}>
            <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 2, margin: '12px auto 16px' }} />
            <p style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>Meta de encontristas</p>
            <label className="form-label">Quantos encontristas você quer atingir?</label>
            <input className="form-input" type="number" min={0} value={rascunho} onChange={e => setRascunho(e.target.value)} placeholder="Ex: 40" autoFocus style={{ marginBottom: 16 }} />
            <button className="btn btn-primary btn-full" onClick={salvar} disabled={salvando} style={{ marginBottom: 8 }}>{salvando ? 'Salvando...' : 'Salvar meta'}</button>
            {meta > 0 && <button className="btn btn-ghost btn-full" style={{ color: 'var(--danger)' }} onClick={() => setRascunho('0')}>Zerar meta (ocultar)</button>}
          </div>
        </div>
      )}
    </div>
  )
}
