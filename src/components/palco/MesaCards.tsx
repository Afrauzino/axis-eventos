import { haQuanto, type PalcoChamado } from '../../lib/palco'

// Cards dos recados abertos na MESA (usado no /mesa e na aba Mesa do /cel).
// Recado ainda não visto PISCA NA COR DO BOTÃO até o técnico marcar "Visto".

type Props = {
  abertos: PalcoChamado[]
  agora: number
  onMarcar: (id: string, status: 'visto' | 'resolvido') => void
  compacto?: boolean
}

export const MESA_CSS = `
  @keyframes mesaPisca { 0%,100% { background-color: #111827; border-color: var(--cor) } 50% { background-color: var(--cor); border-color: #ffffff } }
  @keyframes mesaFlashTela { 0%,100% { opacity: 0 } 50% { opacity: .55 } }
`

export default function MesaCards({ abertos, agora, onMarcar, compacto }: Props) {
  if (abertos.length === 0) return (
    <div style={{ height: '100%', minHeight: 240, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#475569', textAlign: 'center', padding: 16 }}>
      <div style={{ fontSize: 72 }}>✓</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: '#64748b' }}>Tudo certo no palco</div>
      <div style={{ fontSize: 14, marginTop: 6 }}>Os recados aparecem aqui assim que alguém apertar um pedal.</div>
    </div>
  )

  return (
    <div style={{ display: 'grid', gridTemplateColumns: compacto ? '1fr' : 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))', gap: compacto ? 10 : 14 }}>
      {abertos.map(c => {
        const naoVisto = c.status === 'aberto'
        const maior = Math.max(4, ...c.nome.split(/\s+/).map(w => w.length))
        return (
          <div key={c.id} style={{
            ['--cor' as any]: c.cor,
            borderRadius: 20, overflow: 'hidden', background: '#111827', border: `4px solid ${naoVisto ? c.cor : '#334155'}`,
            animation: naoVisto ? 'mesaPisca .9s steps(1, end) infinite' : 'none', display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ background: c.cor, padding: compacto ? '10px 14px' : '14px 16px', position: 'relative' }}>
              <div style={{ fontSize: `clamp(24px, ${Math.floor((compacto ? 260 : 290) / (maior * 0.62))}px, ${compacto ? 40 : 52}px)`, fontWeight: 900, lineHeight: 1.05, color: 'white', textShadow: '0 2px 6px rgba(0,0,0,.3)', overflowWrap: 'break-word', paddingRight: c.repeticoes > 1 ? 56 : 0 }}>{c.nome}</div>
              {c.detalhe && <div style={{ fontSize: compacto ? 20 : 26, fontWeight: 900, color: 'white', marginTop: 4, textShadow: '0 2px 6px rgba(0,0,0,.3)' }}>{c.detalhe}</div>}
              {c.repeticoes > 1 && (
                <span style={{ position: 'absolute', top: 10, right: 12, background: '#0b0f17', color: '#fbbf24', borderRadius: 99, padding: '4px 10px', fontWeight: 900, fontSize: 18 }}>×{c.repeticoes}</span>
              )}
            </div>
            <div style={{ padding: compacto ? '10px 14px' : '12px 16px', flex: 1 }}>
              {c.mensagem && <div style={{ fontSize: compacto ? 16 : 20, fontWeight: 700, lineHeight: 1.25, marginBottom: 8, color: 'white' }}>{c.mensagem}</div>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', color: '#e2e8f0', fontSize: compacto ? 13 : 15 }}>
                <span style={{ fontWeight: 800, background: 'rgba(0,0,0,.35)', borderRadius: 8, padding: '3px 10px' }}>🎤 {c.pedal_nome}</span>
                <span>{haQuanto(c.criado_em, agora)}</span>
                {c.repeticoes > 1 && <span style={{ color: '#fbbf24' }}>· último {haQuanto(c.atualizado_em, agora)}</span>}
                <span style={{ marginLeft: 'auto', fontWeight: 900, background: naoVisto ? '#ef4444' : '#0ea5e9', color: 'white', borderRadius: 6, padding: '2px 8px' }}>{naoVisto ? 'NOVO' : 'VISTO'}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, padding: compacto ? '0 14px 12px' : '0 16px 14px' }}>
              {naoVisto && <button onClick={() => onMarcar(c.id, 'visto')} style={{ ...btnAcao, background: '#1e3a8a' }}>👀 Visto</button>}
              <button onClick={() => onMarcar(c.id, 'resolvido')} style={{ ...btnAcao, background: '#166534', flex: 2 }}>✓ Resolvido</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Clarão na tela inteira na cor do recado que acabou de chegar. */
export function FlashTela({ cor }: { cor: string | null }) {
  if (!cor) return null
  return <div style={{ position: 'fixed', inset: 0, background: cor, pointerEvents: 'none', zIndex: 50, animation: 'mesaFlashTela .4s ease-in-out 4' , opacity: 0 }} />
}

const btnAcao: React.CSSProperties = { flex: 1, border: 'none', borderRadius: 12, padding: '14px 10px', fontSize: 18, fontWeight: 900, color: 'white', cursor: 'pointer', fontFamily: 'inherit' }
