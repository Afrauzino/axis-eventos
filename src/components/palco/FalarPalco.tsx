import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { haQuanto } from '../../lib/palco'
import { Brilho, vidroBotao, vidroChip, vidroPainel } from './vidro'

// MESA → PALCO: o técnico manda recado pro palco. Toque num recado rápido (envia na
// hora) ou escreva um texto. Destino: todos os pedais ou um só. Embaixo, os últimos
// enviados com quem já leu ("✓ lido por Vocal 1").

export type AvisoEnviado = { id: string; texto: string; criado_em: string; para: string; lidos: string[] }

type Props = {
  token: string
  pedais: { id: string; nome: string; online: boolean }[]
  recados: string[]
  avisos: AvisoEnviado[]
  agora: number
  onEnviado: () => void
  onFechar: () => void
}

export default function FalarPalco({ token, pedais, recados, avisos, agora, onEnviado, onFechar }: Props) {
  const [para, setPara] = useState<string | null>(null)       // null = todos
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [ok, setOk] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function enviar(t: string) {
    const msg = t.trim().slice(0, 160)
    if (!msg || enviando) return
    setEnviando(true); setErro(null)
    const { error } = await supabase.rpc('palco_mesa_avisar', { p_token: token, p_pedal: para, p_texto: msg })
    setEnviando(false)
    if (error) {
      setErro(error.message?.includes('limite_avisos') ? 'Muitos recados seguidos. Aguarde um pouco.' : navigator.onLine ? 'Não foi enviado. Tente de novo.' : 'Sem internet.')
      return
    }
    setOk(msg); window.setTimeout(() => setOk(o => (o === msg ? null : o)), 2200)
    if (t === texto) setTexto('')
    onEnviado()
  }

  const destino = para ? pedais.find(p => p.id === para)?.nome ?? '—' : 'Todos'

  return (
    <div onClick={e => e.target === e.currentTarget && onFechar()}
      style={{ position: 'fixed', inset: 0, zIndex: 75, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ ...vidroPainel(.78), position: 'relative', width: '100%', maxWidth: 820, maxHeight: '92vh', overflowY: 'auto', color: '#f8fafc',
                    borderRadius: '28px 28px 0 0', padding: '16px 16px max(16px, env(safe-area-inset-bottom))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 20, fontWeight: 900, flex: 1 }}>📣 Falar com o palco</span>
          <button onClick={onFechar} style={vidroChip}>✕ Fechar</button>
        </div>

        {/* destino */}
        <div style={{ fontSize: 12, fontWeight: 800, color: '#94a3b8', marginBottom: 6 }}>PARA QUEM</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {[{ id: null as string | null, nome: '👥 Todos', online: true }, ...pedais.map(p => ({ ...p, nome: `🎤 ${p.nome}` }))].map(p => (
            <button key={p.id ?? 'todos'} onClick={() => setPara(p.id)}
              style={{ ...vidroChip, padding: '10px 14px', fontSize: 15, ...(para === p.id ? { ...vidroBotao('#0ea5e9'), color: 'white' } : {}), opacity: p.online ? 1 : .6 }}>
              {p.nome}
            </button>
          ))}
        </div>

        {/* recados rápidos */}
        <div style={{ fontSize: 12, fontWeight: 800, color: '#94a3b8', marginBottom: 6 }}>RECADOS RÁPIDOS · toque pra enviar a {destino}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 210px), 1fr))', gap: 10, marginBottom: 16 }}>
          {recados.map(r => (
            <button key={r} onClick={() => enviar(r)} disabled={enviando}
              style={{ ...vidroBotao('#0ea5e9', true), position: 'relative', color: 'white', borderRadius: 18, padding: '16px 12px', fontSize: 17, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', minHeight: 64 }}>
              <Brilho raio={18} /><span style={{ position: 'relative' }}>{r}</span>
            </button>
          ))}
          {recados.length === 0 && <span style={{ color: '#94a3b8', fontSize: 14 }}>Nenhum recado rápido. Crie em ⚙️ Configurar.</span>}
        </div>

        {/* texto livre */}
        <div style={{ fontSize: 12, fontWeight: 800, color: '#94a3b8', marginBottom: 6 }}>OU ESCREVA</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input value={texto} maxLength={160} onChange={e => setTexto(e.target.value)} placeholder="Ex.: Volta pro refrão, segura o tom"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); enviar(texto) } }}
            style={{ flex: 1, minWidth: 0, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.2)', borderRadius: 14, color: 'white', padding: '14px 14px', fontSize: 16, fontFamily: 'inherit', outline: 'none' }} />
          <button onClick={() => enviar(texto)} disabled={enviando || !texto.trim()}
            style={{ ...vidroBotao('#16a34a'), color: 'white', borderRadius: 14, padding: '0 18px', fontSize: 16, fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit', opacity: texto.trim() ? 1 : .5 }}>
            Enviar
          </button>
        </div>
        {ok && <div style={{ background: 'rgba(34,197,94,.25)', border: '1px solid rgba(34,197,94,.5)', borderRadius: 12, padding: '10px 12px', fontWeight: 800, marginBottom: 10 }}>✓ Enviado a {destino}: “{ok}”</div>}
        {erro && <div style={{ background: 'rgba(239,68,68,.25)', border: '1px solid rgba(239,68,68,.5)', borderRadius: 12, padding: '10px 12px', fontWeight: 800, marginBottom: 10 }}>{erro}</div>}

        {/* enviados */}
        {avisos.length > 0 && (
          <>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#94a3b8', margin: '8px 0 6px' }}>ENVIADOS (30 MIN)</div>
            {avisos.map(a => (
              <div key={a.id} style={{ display: 'flex', gap: 10, alignItems: 'baseline', padding: '8px 0', borderTop: '1px solid rgba(255,255,255,.08)', fontSize: 14 }}>
                <span style={{ flex: 1, fontWeight: 700 }}>“{a.texto}” <span style={{ color: '#94a3b8', fontWeight: 500 }}>→ {a.para} · {haQuanto(a.criado_em, agora)}</span></span>
                <span style={{ fontWeight: 800, color: a.lidos.length ? '#4ade80' : '#fbbf24', whiteSpace: 'nowrap' }}>
                  {a.lidos.length ? `✓ lido: ${a.lidos.join(', ')}` : 'aguardando'}
                </span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
