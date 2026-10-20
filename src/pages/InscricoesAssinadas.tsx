import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useEvento } from '../hooks/useEvento'
import { useRegistrarChromeNav } from '../lib/chrome'
import PrintOverlay from '../components/PrintOverlay'
import { fmtBRL, getInitials } from '../utils'
import { montarPlano, descreverPlano } from '../lib/pix'
import type { Profile } from '../App'

// Coordenação: todas as inscrições ASSINADAS do evento (termo + contrato + valores +
// assinatura). Imprime/salva em PDF uma ou todas — é a ficha que vai pra coordenadoria.
type Linha = {
  person_id: string; role_type: string | null; termo_texto: string; contrato_texto: string | null; termo_hash: string
  valor_total: number; parcelas: number; entrada: number; assinatura_path: string; origem: string; aceito_em: string
  pessoa?: { name: string; phone: string | null; church: string | null; cpf: string | null; photo_url: string | null }
  pago?: number; assinaturaUrl?: string
}
const papel = (rt: string | null) => rt === 'worker' ? 'Encontreiro(a)' : 'Encontrista'
const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export default function InscricoesAssinadas(_: { profile: Profile }) {
  const { evento, loading: evLoading } = useEvento()
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [pendentes, setPendentes] = useState<{ id: string; name: string; role_type: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [imprimir, setImprimir] = useState<Linha[] | null>(null)
  useRegistrarChromeNav('financeiro')

  useEffect(() => {
    if (evLoading) return
    if (!evento) { setLoading(false); return }
    ;(async () => {
      const [{ data: ac }, { data: pe }, { data: fin }] = await Promise.all([
        supabase.from('inscricao_aceites').select('*').eq('event_id', evento.id).order('aceito_em', { ascending: false }),
        supabase.from('people').select('id,name,phone,church,cpf,photo_url,role_type').eq('event_id', evento.id).eq('desistente', false).order('name'),
        supabase.from('financeiro').select('person_id,valor,status').eq('event_id', evento.id),
      ])
      const pessoas: Record<string, any> = {}; (pe ?? []).forEach((p: any) => { pessoas[p.id] = p })
      const pago: Record<string, number> = {}
      ;(fin ?? []).forEach((f: any) => { if (f.status === 'pago') pago[f.person_id] = (pago[f.person_id] ?? 0) + Number(f.valor) })
      const ls: Linha[] = (ac ?? []).map((a: any) => ({ ...a, pessoa: pessoas[a.person_id], pago: pago[a.person_id] ?? 0 }))
      // Assinaturas: bucket privado → links temporários
      if (ls.length) {
        const { data: urls } = await supabase.storage.from('assinaturas').createSignedUrls(ls.map(l => l.assinatura_path), 3600)
        const m: Record<string, string> = {}; (urls ?? []).forEach((u: any) => { if (u.signedUrl && u.path) m[u.path] = u.signedUrl })
        ls.forEach(l => { l.assinaturaUrl = m[l.assinatura_path] })
      }
      const assinaram = new Set(ls.map(l => l.person_id))
      setLinhas(ls)
      setPendentes((pe ?? []).filter((p: any) => !assinaram.has(p.id)))
      setLoading(false)
    })()
  }, [evento?.id, evLoading])

  const filtradas = linhas.filter(l => !busca || (l.pessoa?.name ?? '').toLowerCase().includes(busca.toLowerCase()))

  return (
    <div className="page">
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <div className="search-bar" style={{ flex: 1, marginBottom: 0 }}>
          <span className="icon icon-sm" style={{ color: 'var(--muted-light)' }}>search</span>
          <input placeholder="Buscar por nome..." value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        <button className="btn btn-primary btn-sm" disabled={!filtradas.length} onClick={() => setImprimir(filtradas)}>
          <span className="icon icon-sm">print</span> Imprimir todas
        </button>
      </div>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
        {linhas.length} assinada(s) · {pendentes.length} ainda sem assinatura
      </p>

      {loading ? [1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 72, marginBottom: 8, borderRadius: 14 }} />) :
        filtradas.map(l => (
          <div key={l.person_id} className="list-card" style={{ cursor: 'default' }}>
            <div className="list-card-bar" style={{ background: (l.pago ?? 0) >= l.valor_total ? 'var(--success)' : 'var(--warning)' }} />
            <div className="list-card-media">
              {l.pessoa?.photo_url ? <img src={l.pessoa.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary)' }}>{getInitials(l.pessoa?.name ?? '?')}</span>}
            </div>
            <div className="list-card-body">
              <div className="list-card-title">{l.pessoa?.name ?? '(cadastro removido)'}</div>
              <div className="list-card-desc">{papel(l.role_type)} · {quando(l.aceito_em)}{l.origem === 'koinonia' ? ' · Koinonia' : ''}</div>
              <div className="list-card-desc">Pago {fmtBRL(l.pago ?? 0)} de {fmtBRL(l.valor_total)} · {descreverPlano(montarPlano(Number(l.valor_total), l.parcelas, Number(l.entrada)), fmtBRL)}</div>
            </div>
            <button className="btn btn-outline btn-sm" style={{ marginRight: 10 }} onClick={() => setImprimir([l])}><span className="icon icon-sm">print</span></button>
          </div>
        ))}

      {!loading && pendentes.length > 0 && (
        <details style={{ marginTop: 16 }}>
          <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Ainda não assinaram ({pendentes.length})</summary>
          <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text2)', lineHeight: 1.8 }}>
            {pendentes.map(p => <div key={p.id}>• {p.name} <span style={{ color: 'var(--muted)' }}>({papel(p.role_type)})</span></div>)}
          </div>
        </details>
      )}

      {imprimir && (
        <PrintOverlay titulo={`Inscrições assinadas — ${imprimir.length}`} onClose={() => setImprimir(null)}>
          {imprimir.map((l, i) => {
            const plano = montarPlano(Number(l.valor_total), l.parcelas, Number(l.entrada))
            return (
              <div key={l.person_id} className={i < imprimir.length - 1 ? 'print-break' : ''} style={{ fontSize: 11, lineHeight: 1.5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #111', paddingBottom: 6, marginBottom: 10 }}>
                  <div>
                    <p style={{ fontSize: 16, fontWeight: 900 }}>{evento?.name}</p>
                    <p style={{ fontSize: 11 }}>Ficha de inscrição assinada · {papel(l.role_type)}</p>
                  </div>
                  <p style={{ fontSize: 10, textAlign: 'right' }}>Assinada em {quando(l.aceito_em)}<br />Origem: {l.origem === 'koinonia' ? 'Koinonia' : 'AXIS Eventos'}</p>
                </div>
                <p><b>Nome:</b> {l.pessoa?.name ?? '—'} &nbsp; <b>Telefone:</b> {l.pessoa?.phone ?? '—'} &nbsp; <b>CPF:</b> {l.pessoa?.cpf ?? '—'}</p>
                <p><b>Igreja:</b> {l.pessoa?.church ?? '—'}</p>
                <p style={{ marginTop: 6 }}><b>Valor:</b> {fmtBRL(Number(l.valor_total))} · <b>Plano:</b> {descreverPlano(plano, fmtBRL)} · <b>Pago até agora:</b> {fmtBRL(l.pago ?? 0)}</p>
                <p style={{ fontWeight: 800, marginTop: 12, marginBottom: 4 }}>TERMO</p>
                <div style={{ whiteSpace: 'pre-wrap', border: '1px solid #ddd', padding: 8, borderRadius: 4 }}>{l.termo_texto || '—'}</div>
                {!!l.contrato_texto?.trim() && (<>
                  <p style={{ fontWeight: 800, marginTop: 12, marginBottom: 4 }}>CONTRATO</p>
                  <div style={{ whiteSpace: 'pre-wrap', border: '1px solid #ddd', padding: 8, borderRadius: 4 }}>{l.contrato_texto}</div>
                </>)}
                <div style={{ marginTop: 18, textAlign: 'center' }}>
                  {l.assinaturaUrl ? <img src={l.assinaturaUrl} alt="Assinatura" style={{ height: 90, maxWidth: '70%', objectFit: 'contain' }} /> : <div style={{ height: 90 }} />}
                  <div style={{ borderTop: '1px solid #111', width: '60%', margin: '0 auto', paddingTop: 2 }}>{l.pessoa?.name}</div>
                  <p style={{ fontSize: 8, color: '#666', marginTop: 6 }}>Assinatura eletrônica feita no celular · código de conferência do texto: {l.termo_hash}</p>
                </div>
              </div>
            )
          })}
        </PrintOverlay>
      )}
    </div>
  )
}
