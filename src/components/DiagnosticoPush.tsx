import { useState } from 'react'
import { diagnosticoPush, ativarPush, type ResultadoDiag, type PassoDiag } from '../lib/push'
import type { Profile } from '../App'

// Diagnóstico de notificação no aparelho — roda TODOS os elos do push e diz, em
// português claro, onde está quebrado. Substitui o antigo botão "Testar".
const ICONE: Record<PassoDiag['status'], { emoji: string; cor: string }> = {
  ok:   { emoji: '✅', cor: 'var(--success)' },
  warn: { emoji: '⚠️', cor: '#B7791F' },
  fail: { emoji: '❌', cor: 'var(--danger)' },
  info: { emoji: 'ℹ️', cor: 'var(--muted)' },
}

export default function DiagnosticoPush({ profile }: { profile: Profile }) {
  const [rodando, setRodando] = useState(false)
  const [res, setRes] = useState<ResultadoDiag | null>(null)
  const [reativando, setReativando] = useState(false)

  async function rodar() {
    setRodando(true); setRes(null)
    try { setRes(await diagnosticoPush(profile.user_id)) }
    finally { setRodando(false) }
  }

  async function reativar() {
    setReativando(true)
    try { await ativarPush(profile.user_id); await rodar() }
    finally { setReativando(false) }
  }

  const vCor = res ? ICONE[res.vereditoStatus === 'ok' ? 'ok' : res.vereditoStatus === 'warn' ? 'warn' : 'fail'].cor : ''

  return (
    <div style={{ background: 'white', borderRadius: 14, boxShadow: 'var(--shadow-sm)', padding: '16px 20px', marginBottom: 12 }}>
      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Notificações no celular</p>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>Se as notificações não aparecem na bandeja do celular, rode o diagnóstico. Ele testa cada etapa e diz exatamente o que fazer.</p>

      <button type="button" className="btn btn-primary btn-full" onClick={rodar} disabled={rodando || reativando}>
        <span className="icon icon-sm" style={{ color: 'white' }}>notifications_active</span> {rodando ? 'Verificando...' : 'Rodar diagnóstico completo'}
      </button>

      {res && (
        <>
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {res.passos.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 15, lineHeight: '20px', flexShrink: 0 }}>{ICONE[p.status].emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{p.label}</p>
                  {p.detalhe && <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.4, marginTop: 1 }}>{p.detalhe}</p>}
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 14, background: 'var(--bg)', borderLeft: `4px solid ${vCor}`, borderRadius: 8, padding: '12px 14px' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', lineHeight: 1.5 }}>{res.veredito}</p>
          </div>

          <button type="button" className="btn btn-ghost btn-full" style={{ marginTop: 10 }} onClick={reativar} disabled={reativando || rodando}>
            <span className="icon icon-sm">refresh</span> {reativando ? 'Reativando...' : 'Reativar neste aparelho'}
          </button>
        </>
      )}
    </div>
  )
}
