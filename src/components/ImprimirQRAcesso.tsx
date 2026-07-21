import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../lib/supabase'
import { useEvento } from '../hooks/useEvento'
import PrintOverlay from './PrintOverlay'
import { formatName, getInitials } from '../utils'

// Impressão de QR de PRIMEIRO ACESSO — só de quem ainda tem código (invite_code).
// Cada tira: QR + foto + nome. A pessoa escaneia o QR e cai direto no "Primeiro
// acesso" com o código preenchido (URL ?codigo=XXX), aí preenche a própria ficha.

type Pessoa = { id: string; name: string; photo_url: string | null; invite_code: string | null }

export default function ImprimirQRAcesso({ onClose }: { onClose: () => void }) {
  const { evento } = useEvento()
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [loading, setLoading] = useState(true)
  const [colunas, setColunas] = useState(2)
  const [imprimir, setImprimir] = useState(false)

  useEffect(() => {
    if (!evento?.id) return
    supabase.from('people')
      .select('id,name,photo_url,invite_code')
      .eq('event_id', evento.id).eq('role_type', 'encounterer')
      .not('invite_code', 'is', null).order('name')
      .then(({ data }) => {
        // garante que o código não é vazio
        setPessoas(((data ?? []) as Pessoa[]).filter(p => (p.invite_code ?? '').trim() !== ''))
        setLoading(false)
      })
  }, [evento?.id])

  // Link que o QR abre: primeiro acesso já com o código (Login lê ?codigo=XXX)
  const linkDe = (code: string) => `${window.location.origin}/?codigo=${encodeURIComponent(code)}`
  const qrPx = colunas === 1 ? 150 : colunas === 2 ? 96 : 74

  // ===== A FOLHA IMPRESSA =====
  if (imprimir) {
    return (
      <PrintOverlay titulo={`QR de primeiro acesso — ${pessoas.length}`} onClose={() => setImprimir(false)}>
        <h2 style={{ fontSize: 18, fontWeight: 900, margin: '0 0 4px' }}>QR de primeiro acesso — {evento?.name ?? ''}</h2>
        <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 12px' }}>
          {pessoas.length} pessoa(s) com código · o QR abre o cadastro da própria pessoa
        </p>
        {/* inline-block (não grid): pagina certinho na impressão do Chrome */}
        <div style={{ fontSize: 0, margin: '0 -4px' }}>
          {pessoas.map(p => (
            <div key={p.id} style={{
              display: 'inline-block', verticalAlign: 'top', boxSizing: 'border-box',
              width: `${100 / colunas}%`, padding: 4,
              breakInside: 'avoid', pageBreakInside: 'avoid',
            }}>
              <div style={{ border: '1px solid #d1d5db', borderRadius: 10, padding: '8px 10px', display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ width: qrPx, height: qrPx, flexShrink: 0 }}>
                  <QRCodeSVG value={linkDe(p.invite_code!)} level="M" marginSize={0}
                    style={{ width: '100%', height: '100%', display: 'block' }} />
                </div>
                <div style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', background: '#f3f4f6', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {p.photo_url ? <img src={p.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: 13, fontWeight: 700, color: '#6b7280' }}>{getInitials(p.name)}</span>}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ fontSize: 12.5, fontWeight: 800, margin: 0, lineHeight: 1.15 }}>{formatName(p.name)}</p>
                  <p style={{ fontSize: 9, color: '#6b7280', margin: '3px 0 0', lineHeight: 1.25 }}>Aponte a câmera para preencher seu cadastro</p>
                  <p style={{ fontSize: 8.5, color: '#9ca3af', margin: '2px 0 0', letterSpacing: '.03em' }}>Código: {p.invite_code}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </PrintOverlay>
    )
  }

  // ===== CONFIGURAÇÃO =====
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 350, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'white', borderRadius: '20px 20px 0 0', padding: '8px 20px 24px', maxHeight: '92vh', overflowY: 'auto', maxWidth: 560, width: '100%', margin: '0 auto' }}>
        <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 2, margin: '12px auto 16px' }} />
        <p style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>Imprimir QR de primeiro acesso</p>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
          Só sai <b>quem ainda tem código</b> de primeiro acesso. Cada tira traz o QR + foto + nome —
          a pessoa escaneia e cai no cadastro dela pra preencher.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Colunas</span>
          {[1, 2, 3].map(n => (
            <button key={n} onClick={() => setColunas(n)}
              style={{ width: 34, height: 34, borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 800,
                border: colunas === n ? '2px solid var(--primary)' : '1px solid var(--border)', background: colunas === n ? 'var(--primary-light)' : 'white', color: colunas === n ? 'var(--primary)' : 'var(--text)' }}>{n}</button>
          ))}
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>1 coluna = QR maior (mais fácil de ler)</span>
        </div>

        <button className="btn btn-primary btn-full" disabled={loading || pessoas.length === 0}
          onClick={() => setImprimir(true)}>
          <span className="icon icon-sm">qr_code_2</span> {loading ? 'Carregando...' : pessoas.length === 0 ? 'Ninguém com código' : `Gerar (${pessoas.length})`}
        </button>
        <button className="btn btn-ghost btn-full" onClick={onClose} style={{ marginTop: 8 }}>Fechar</button>
      </div>
    </div>
  )
}
