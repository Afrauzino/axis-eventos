import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { carregarConfig, salvarConfig } from '../lib/tema'
import { useVoltarFecha } from '../hooks/useVoltarFecha'
import { fmtHora } from '../utils'
import { toast } from './Toast'

// Bloco "Próximo no cronograma": mostra o próximo item (ou o que está em
// andamento). Admin personaliza cor/imagem de fundo (salvo em configuracoes).

const K_COR = 'home_proximo_cor'
const K_BG = 'home_proximo_bg'
const CORES = ['#00A99D','#1565C0','#6B46C1','#2F855A','#C53030','#D69E2E','#E8821A','#0F766E','#B83280','#1A202C']

type Prox = { titulo: string; hora_inicio: string; hora_fim: string; tipo: string; local: string | null; teatro: string | null; agora: boolean }

function ehMesmoDia(iso: string): boolean {
  const d = new Date(iso), h = new Date()
  return d.getFullYear() === h.getFullYear() && d.getMonth() === h.getMonth() && d.getDate() === h.getDate()
}
function rotuloDia(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export default function ProximoItem({ eventoId, admin }: { eventoId?: string; admin: boolean }) {
  const [prox, setProx] = useState<Prox | null>(null)
  const [carregado, setCarregado] = useState(false)
  const [cor, setCor] = useState('')
  const [bg, setBg] = useState('')
  const [editando, setEditando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const bgFileRef = useRef<HTMLInputElement>(null)
  useVoltarFecha(editando, () => setEditando(false))

  useEffect(() => {
    carregarConfig(K_COR).then(v => setCor(v ?? ''))
    carregarConfig(K_BG).then(v => setBg(v ?? ''))
  }, [])

  async function carregar(eid: string) {
    const { data } = await supabase.from('cronograma_eventos').select('*')
      .eq('event_id', eid).order('hora_inicio')
    const agoraMs = Date.now()
    const item = (data ?? []).find((it: any) =>
      it.status !== 'concluido' && it.status !== 'cancelado' && new Date(it.hora_fim).getTime() > agoraMs)
    if (!item) { setProx(null); setCarregado(true); return }

    let titulo = item.titulo
    let ministracaoId: string | null = item.ministracao_id ?? null
    if (ministracaoId) {
      const { data: m } = await supabase.from('ministrações').select('titulo').eq('id', ministracaoId).maybeSingle()
      if (m?.titulo) titulo = m.titulo
    }
    let teatro: string | null = null
    if (item.theater_id) {
      const { data: t } = await supabase.from('theaters').select('nome').eq('id', item.theater_id).maybeSingle()
      teatro = t?.nome ?? null
    } else if (ministracaoId) {
      const { data: t } = await supabase.from('theaters').select('nome').eq('ministracao_id', ministracaoId).maybeSingle()
      teatro = t?.nome ?? null
    }
    setProx({
      titulo, hora_inicio: item.hora_inicio, hora_fim: item.hora_fim, tipo: item.tipo,
      local: item.local ?? null, teatro,
      agora: new Date(item.hora_inicio).getTime() <= agoraMs,
    })
    setCarregado(true)
  }

  useEffect(() => {
    if (!eventoId) { setProx(null); setCarregado(true); return }
    carregar(eventoId)
    const canal = supabase.channel('home-proximo-' + eventoId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cronograma_eventos', filter: `event_id=eq.${eventoId}` }, () => carregar(eventoId))
      .subscribe()
    const t = setInterval(() => carregar(eventoId), 60000) // reavalia "próximo" a cada minuto
    return () => { supabase.removeChannel(canal); clearInterval(t) }
  }, [eventoId])

  async function enviarBg(file: File) {
    setSalvando(true)
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `home-proximo/bg.${ext}`
    const { error } = await supabase.storage.from('pessoas').upload(path, file, { upsert: true })
    if (error) { setSalvando(false); toast.falha('Não foi possível enviar a imagem.', error); return }
    const { data } = supabase.storage.from('pessoas').getPublicUrl(path)
    setBg(`${data.publicUrl}?t=${Date.now()}`)
    setSalvando(false)
  }
  async function salvar() {
    setSalvando(true)
    await salvarConfig(K_COR, cor)
    await salvarConfig(K_BG, bg)
    setSalvando(false)
    setEditando(false)
    toast.sucesso('Bloco atualizado!')
  }

  if (!carregado || !prox) return null

  const cardStyle: React.CSSProperties = bg
    ? { backgroundImage: `linear-gradient(rgba(0,0,0,0.42),rgba(0,0,0,0.58)), url(${bg})`, backgroundSize: 'cover', backgroundPosition: 'center', borderRadius: 14, padding: '14px 16px', marginBottom: 16, boxShadow: '0 4px 14px rgba(0,0,0,0.25)' }
    : { background: cor || 'linear-gradient(135deg,#2D3748,#1A202C)', borderRadius: 14, padding: '14px 16px', marginBottom: 16, boxShadow: 'var(--shadow-sm)' }

  const quando = prox.agora ? 'AGORA' : (ehMesmoDia(prox.hora_inicio) ? 'HOJE' : rotuloDia(prox.hora_inicio).toUpperCase())

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {prox.agora ? '🔴 Acontecendo agora' : '📌 Próximo no cronograma'}
        </span>
        {admin && (
          <button onClick={() => setEditando(true)} title="Personalizar"
            style={{ background: 'rgba(255,255,255,0.22)', border: 'none', borderRadius: 8, width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontFamily: 'inherit' }}>
            <span className="icon icon-sm">palette</span>
          </button>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flexShrink: 0, textAlign: 'center', background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.22)', borderRadius: 10, padding: '8px 10px', minWidth: 68 }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.75)', letterSpacing: '0.06em' }}>{quando}</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'white', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{fmtHora(prox.hora_inicio)}</div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 16, fontWeight: 800, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{prox.titulo}</p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.82)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {prox.tipo}{prox.local ? ` · ${prox.local}` : ''}
          </p>
          {prox.teatro && <p style={{ fontSize: 12, color: '#FFD9A8', fontWeight: 700, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🎭 Teatro: {prox.teatro}</p>}
        </div>
      </div>

      {editando && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 400, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
          onClick={e => e.target === e.currentTarget && setEditando(false)}>
          <div style={{ background: 'white', borderRadius: '20px 20px 0 0', padding: '8px 20px 28px', maxWidth: 480, width: '100%', margin: '0 auto', maxHeight: '88vh', overflowY: 'auto' }}>
            <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 2, margin: '12px auto 16px' }} />
            <p style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>Bloco "Próximo no cronograma"</p>

            <label className="form-label">Cor de fundo</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              {CORES.map(c => (
                <button key={c} type="button" onClick={() => setCor(c)} aria-label={c}
                  style={{ width: 34, height: 34, borderRadius: 8, background: c, border: cor === c ? '3px solid var(--text)' : '2px solid white', boxShadow: '0 0 0 1px var(--border)', cursor: 'pointer' }} />
              ))}
              <button type="button" onClick={() => setCor('')} title="Padrão"
                style={{ width: 34, height: 34, borderRadius: 8, background: 'linear-gradient(135deg,#2D3748,#1A202C)', border: !cor ? '3px solid var(--text)' : '2px solid white', boxShadow: '0 0 0 1px var(--border)', cursor: 'pointer' }} />
            </div>

            <label className="form-label">Imagem de fundo</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => bgFileRef.current?.click()} disabled={salvando}>
                <span className="icon icon-sm">image</span> {salvando ? 'Enviando...' : 'Enviar imagem'}
              </button>
              {bg && <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => setBg('')}>
                <span className="icon icon-sm">delete</span> Remover imagem
              </button>}
            </div>

            <button className="btn btn-primary btn-full" onClick={salvar} disabled={salvando} style={{ marginBottom: 8 }}>
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
            <button className="btn btn-ghost btn-full" onClick={() => setEditando(false)}>Cancelar</button>
            <input ref={bgFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) enviarBg(f); e.target.value = '' }} />
          </div>
        </div>
      )}
    </div>
  )
}
