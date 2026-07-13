import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useEvento } from '../hooks/useEvento'
import PrintOverlay from './PrintOverlay'
import { formatName, getInitials } from '../utils'

// Impressão da lista de RESPONSÁVEIS pelas cartas (adoções).
// Tiras de 2 colunas: coluna 1 = encontrista, coluna 2 = encontreiro responsável.
// Só abre pra quem tem a permissão correio/adocoes ou admin (a tela controla isso).

type Enc   = { id: string; name: string; church: string | null; photo_url: string | null }
type Resp  = { encontrista_id: string; worker_name: string | null; worker_photo: string | null }

export default function ImprimirAdocoes({ onClose }: { onClose: () => void }) {
  const { evento } = useEvento()
  const [encontristas, setEncontristas] = useState<Enc[]>([])
  const [respMap, setRespMap] = useState<Map<string, Resp>>(new Map())
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'todos' | 'adotados' | 'sem'>('todos')
  const [imprimir, setImprimir] = useState(false)

  useEffect(() => {
    if (!evento?.id) return
    Promise.all([
      supabase.from('people').select('id,name,church,photo_url')
        .eq('event_id', evento.id).eq('role_type', 'encounterer').order('name'),
      supabase.from('encontrista_adocao').select('encontrista_id,worker_name,worker_photo')
        .eq('event_id', evento.id),
    ]).then(([enc, ad]) => {
      setEncontristas((enc.data ?? []) as Enc[])
      const m = new Map<string, Resp>()
      ;(ad.data ?? []).forEach((r: any) => m.set(r.encontrista_id, r))
      setRespMap(m)
      setLoading(false)
    })
  }, [evento?.id])

  const linhas = encontristas.filter(e => {
    const tem = respMap.has(e.id)
    return filtro === 'todos' ? true : filtro === 'adotados' ? tem : !tem
  })
  const totalAdot = encontristas.filter(e => respMap.has(e.id)).length

  // ===== A FOLHA IMPRESSA =====
  if (imprimir) {
    return (
      <PrintOverlay titulo={`Responsáveis pelas cartas — ${linhas.length}`} onClose={() => setImprimir(false)}>
        <h2 style={{ fontSize: 18, fontWeight: 900, margin: '0 0 4px' }}>Responsáveis pelas cartas — {evento?.name ?? ''}</h2>
        <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 12px' }}>
          {totalAdot} de {encontristas.length} encontristas adotados
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
          {/* Cabeçalho das 2 colunas */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 10, fontWeight: 800, color: '#374151', textTransform: 'uppercase', letterSpacing: '.04em', padding: '0 4px' }}>
            <span>Encontrista</span>
            <span>Responsável (encontreiro)</span>
          </div>
          {linhas.map(e => {
            const r = respMap.get(e.id)
            return (
              <div key={e.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, border: '1px solid #d1d5db', borderRadius: 10, padding: 6, breakInside: 'avoid' }}>
                {/* col 1 — encontrista */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', borderRight: '1px dashed #d1d5db', paddingRight: 8 }}>
                  <Foto url={e.photo_url} nome={e.name} />
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 12.5, fontWeight: 800, margin: 0, lineHeight: 1.2 }}>{formatName(e.name)}</p>
                    {e.church && <p style={{ fontSize: 10, color: '#6b7280', margin: '1px 0 0' }}>{e.church}</p>}
                  </div>
                </div>
                {/* col 2 — responsável */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {r ? (
                    <>
                      <Foto url={r.worker_photo} nome={r.worker_name || '?'} />
                      <p style={{ fontSize: 12.5, fontWeight: 800, margin: 0, lineHeight: 1.2 }}>{formatName(r.worker_name || '')}</p>
                    </>
                  ) : (
                    <p style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic', margin: 0 }}>— sem responsável —</p>
                  )}
                </div>
              </div>
            )
          })}
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
        <p style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>Imprimir responsáveis</p>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>Tiras de 2 colunas: encontrista à esquerda, o encontreiro responsável à direita.</p>

        <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
          {([['todos', 'Todos'], ['adotados', 'Só adotados'], ['sem', 'Sem responsável']] as const).map(([k, lb]) => (
            <button key={k} onClick={() => setFiltro(k)}
              style={{ flex: 1, padding: '8px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
                border: filtro === k ? '2px solid var(--primary)' : '1px solid var(--border)', background: filtro === k ? 'var(--primary-light)' : 'white', color: filtro === k ? 'var(--primary)' : 'var(--text)' }}>
              {lb}
            </button>
          ))}
        </div>

        <button className="btn btn-primary btn-full" disabled={loading || linhas.length === 0}
          onClick={() => setImprimir(true)}>
          <span className="icon icon-sm">print</span> {loading ? 'Carregando...' : `Gerar (${linhas.length})`}
        </button>
        <button className="btn btn-ghost btn-full" onClick={onClose} style={{ marginTop: 8 }}>Fechar</button>
      </div>
    </div>
  )
}

function Foto({ url, nome }: { url: string | null; nome: string }) {
  return (
    <div style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {url ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <span style={{ fontSize: 13, fontWeight: 700, color: '#6b7280' }}>{getInitials(nome)}</span>}
    </div>
  )
}
