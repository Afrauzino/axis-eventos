import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getInitials } from '../utils'
import CardItem from '../components/CardItem'
import { useEvento } from '../hooks/useEvento'
import type { Profile } from '../App'

type Pessoa = {
  id: string; name: string; church: string; photo_url: string | null
  sexo: string | null; cidade: string | null
  referencia_id: string | null
}
type Encontreiro = { id: string; name: string; phone: string; photo_url: string | null }

export default function Encontristas({ profile }: { profile: Profile }) {
  const navigate = useNavigate()
  const { evento, loading: evLoading } = useEvento()
  const [lista, setLista]         = useState<Pessoa[]>([])
  const [encontreiros, setEncontreiros] = useState<Encontreiro[]>([])
  const [busca, setBusca]         = useState('')
  const [fotoAmpliada, setFotoAmpliada] = useState<string|null>(null)
  const [loading, setLoading]     = useState(true)
  const [selecionado, setSelecionado] = useState<Pessoa | null>(null)

  useEffect(() => { if (evLoading) return; if (!evento) { setLoading(false); return }; carregar() }, [evento, evLoading])

  async function carregar() {
    if (!evento) return
    setLoading(true)
    const [enc, trb] = await Promise.all([
      supabase.from('people').select('id,name,church,photo_url,sexo,cidade,referencia_id')
        .eq('event_id', evento.id).eq('role_type', 'encounterer').order('name'),
      supabase.from('people').select('id,name,phone,photo_url')
        .eq('event_id', evento.id).eq('role_type', 'worker').order('name'),
    ])
    setLista(enc.data ?? [])
    setEncontreiros(trb.data ?? [])
    setLoading(false)
  }

  const filtrados = lista.filter(p => {
    if (!busca.trim()) return true
    const q = busca.toLowerCase()
    return p.name.toLowerCase().includes(q) || p.church.toLowerCase().includes(q)
  })

  function getReferencia(refId: string | null) {
    if (!refId) return null
    return encontreiros.find(e => e.id === refId) ?? null
  }

  function whatsapp(phone: string, nome: string) {
    const num = phone.replace(/\D/g, '')
    const msg = encodeURIComponent(`Oi ${nome}, encontrei um objeto de um encontrista e preciso da sua ajuda para identificar!`)
    window.open(`https://wa.me/55${num}?text=${msg}`, '_blank')
  }

  return (
    <div className="page">
      {/* Busca */}
      <div className="search-bar mb-3">
        <span className="icon icon-sm" style={{ color: 'var(--muted-light)' }}>search</span>
        <input
          placeholder="Buscar por nome ou igreja..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
         
        />
        {busca && (
          <button onClick={() => setBusca('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-light)', padding: 0 }}>
            <span className="icon icon-sm">close</span>
          </button>
        )}
      </div>

      {/* Contador */}
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
        {busca ? `${filtrados.length} resultado(s) para "${busca}"` : `${lista.length} encontrista(s)`}
      </p>

      {/* Lista */}
      {loading ? (
        [1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: 68, marginBottom: 8, borderRadius: 14 }} />)
      ) : filtrados.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">
            <span className="icon" style={{ color: 'var(--muted-light)' }}>person_search</span>
          </div>
          <p className="empty-title">Nenhum resultado</p>
          <p className="empty-desc">Tente outro nome ou igreja.</p>
        </div>
      ) : filtrados.map(p => {
        const ref = getReferencia(p.referencia_id)
        return (
          <CardItem
            key={p.id}
            cor="var(--primary)"
            fotoUrl={p.photo_url}
            iniciais={getInitials(p.name)}
            ehPessoa={true}
            titulo={p.name}
            subtitulo={p.church + (ref ? ` · Ref: ${ref.name.split(' ')[0]}` : '')}
            onVer={() => setSelecionado(p)}
            onFoto={() => p.photo_url && setFotoAmpliada(p.photo_url)}
          />
        )
      })}

      {/* Modal de detalhe — foto grande + referencia */}
      {selecionado && (() => {
        const ref = getReferencia(selecionado.referencia_id)
        return (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 300, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
            onClick={e => e.target === e.currentTarget && setSelecionado(null)}
          >
            <div style={{ background: 'white', borderRadius: '20px 20px 0 0', padding: '8px 20px 32px', maxHeight: '80vh', overflowY: 'auto' }}>
              <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 2, margin: '12px auto 16px' }} />

              {/* Foto grande */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 20 }}>
                <div onClick={()=>selecionado.photo_url && setFotoAmpliada(selecionado.photo_url)} style={{ width: 120, height: 120, borderRadius: '50%', background: 'var(--primary-light)', border: '4px solid var(--primary)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14, cursor: selecionado.photo_url?'pointer':'default' }}>
                  {selecionado.photo_url
                    ? <img src={selecionado.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: 42, fontWeight: 700, color: 'var(--primary)' }}>{getInitials(selecionado.name)}</span>
                  }
                </div>
                <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>{selecionado.name}</h2>
                <p style={{ fontSize: 14, color: 'var(--muted)' }}>
                  {selecionado.church}
                  {selecionado.cidade ? ` · ${selecionado.cidade}` : ''}
                  {selecionado.sexo ? ` · ${selecionado.sexo === 'M' ? 'Masculino' : 'Feminino'}` : ''}
                </p>
              </div>

              {/* Quem conhece */}
              {ref ? (
                <div style={{ background: 'var(--primary-light)', borderRadius: 14, padding: '16px', marginBottom: 16 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--primary-dark)', marginBottom: 12 }}>
                    Quem conhece esta pessoa
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: 'white', overflow: 'hidden', flexShrink: 0 }}>
                      {ref.photo_url
                        ? <img src={ref.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : getInitials(ref.name)
                      }
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 700, fontSize: 16 }}>{ref.name}</p>
                      {ref.phone && <p style={{ fontSize: 13, color: 'var(--text2)' }}>{ref.phone}</p>}
                    </div>
                    {ref.phone && (
                      <button
                        onClick={() => whatsapp(ref.phone, ref.name.split(' ')[0])}
                        style={{ background: '#25D366', border: 'none', borderRadius: 12, width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, boxShadow: '0 2px 8px rgba(37,211,102,0.4)' }}
                      >
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ background: 'var(--bg)', borderRadius: 14, padding: '16px', marginBottom: 16, textAlign: 'center' }}>
                  <p style={{ fontSize: 13, color: 'var(--muted)' }}>Nenhum encontreiro de referencia vinculado.</p>
                </div>
              )}

              <button
                onClick={()=>{ setSelecionado(null); navigate('/ranking') }}
                style={{width:'100%',background:'#F6AD55',color:'#744210',border:'none',borderRadius:10,padding:'12px',cursor:'pointer',fontSize:14,fontWeight:700,fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:8,marginBottom:8}}>
                <span style={{fontFamily:"'Material Symbols Outlined'",fontSize:18,color:'#744210',fontWeight:'normal',fontStyle:'normal',lineHeight:1,letterSpacing:'normal',textTransform:'none',display:'inline-block',whiteSpace:'nowrap',userSelect:'none'}}>how_to_vote</span>
                Votar neste encontrista
              </button>
              <button className="btn btn-ghost btn-full" onClick={() => setSelecionado(null)}>Fechar</button>
            </div>
          </div>
        )
      })()}

      {/* Foto ampliada em tela cheia */}
      {fotoAmpliada && (
        <div onClick={()=>setFotoAmpliada(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.92)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:20,cursor:'pointer'}}>
          <img src={fotoAmpliada} alt="" style={{maxWidth:'100%',maxHeight:'100%',objectFit:'contain',borderRadius:12}}/>
          <button onClick={()=>setFotoAmpliada(null)} style={{position:'absolute',top:20,right:20,background:'rgba(255,255,255,0.2)',border:'none',borderRadius:'50%',width:40,height:40,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <span className="icon" style={{color:'white',fontSize:24}}>close</span>
          </button>
        </div>
      )}
    </div>
  )
}
