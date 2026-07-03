import { useEffect, useState } from 'react'
import RichEditor from './RichEditor'
import { carregarConfig, salvarConfig } from '../lib/tema'

export type BVVariante = 'encontrista' | 'encontreiro'
type Contato = { nome:string; funcao:string; numero:string }
type BVData  = { texto:string; endereco:string; lat:string; lng:string; contatos:Contato[] }

const VAZIO: BVData = { texto:'', endereco:'', lat:'', lng:'', contatos:[] }
const chaveDe = (v:BVVariante) => `boasvindas_${v}`
const waLink = (num:string) => `https://wa.me/55${(num||'').replace(/\D/g,'')}`
const temMapa = (d:BVData) => (d.lat && d.lng) || d.endereco

function mapaSrc(d:BVData) {
  const q = (d.lat && d.lng) ? `${d.lat},${d.lng}` : d.endereco
  return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=15&output=embed`
}

const CHAVE_ATIVO = 'boasvindas_ativo'

export default function BoasVindas({ variante, admin }: { variante:BVVariante; admin:boolean }) {
  const [data, setData]   = useState<BVData>(VAZIO)
  const [carregado, setCarregado] = useState(false)
  const [editando, setEditando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState('')
  const [varEdit, setVarEdit] = useState<BVVariante>(variante)
  const [ativo, setAtivo] = useState(true) // #4 — 1 botão liga/desliga as DUAS telas

  useEffect(() => { setVarEdit(variante); carregar(variante) }, [variante])
  useEffect(() => { carregarConfig(CHAVE_ATIVO).then(v => { if (v !== null) setAtivo(v !== '0') }) }, [])

  async function carregar(v:BVVariante) {
    const raw = await carregarConfig(chaveDe(v))
    let d: BVData = VAZIO
    if (raw) { try { d = { ...VAZIO, ...JSON.parse(raw) } } catch {} }
    setData(d); setCarregado(true)
  }
  async function salvar() {
    setSalvando(true)
    await salvarConfig(chaveDe(varEdit), JSON.stringify(data))
    setSalvando(false); setEditando(false); setMsg('✓ Salvo'); setTimeout(()=>setMsg(''),1500)
  }
  async function alternarAtivo(v:boolean) {
    setAtivo(v)
    await salvarConfig(CHAVE_ATIVO, v ? '1' : '0')
    setMsg(v ? '✓ Boas-vindas ligada' : '✓ Boas-vindas desligada'); setTimeout(()=>setMsg(''),1500)
  }
  function usarMinhaLocalizacao() {
    if (!navigator.geolocation) { alert('Localização não disponível neste navegador.'); return }
    navigator.geolocation.getCurrentPosition(
      pos => setData(d=>({ ...d, lat:String(pos.coords.latitude.toFixed(6)), lng:String(pos.coords.longitude.toFixed(6)) })),
      () => alert('Não foi possível obter a localização (permita o acesso).')
    )
  }
  const addContato = () => setData(d=>({ ...d, contatos:[...d.contatos, { nome:'', funcao:'', numero:'' }] }))
  const setContato = (i:number, campo:keyof Contato, v:string) => setData(d=>({ ...d, contatos:d.contatos.map((c,j)=>j===i?{...c,[campo]:v}:c) }))
  const delContato = (i:number) => setData(d=>({ ...d, contatos:d.contatos.filter((_,j)=>j!==i) }))

  if (!carregado) return null

  // #4 — desligada: some para todos (usuários); admin ainda vê o botão pra religar
  if (!ativo && !admin) return null

  const vazio = !data.texto && !temMapa(data) && data.contatos.length===0

  const SwitchAtivo = () => (
    <button type="button" onClick={()=>alternarAtivo(!ativo)}
      style={{display:'flex',alignItems:'center',gap:8,background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',padding:0}}>
      <span style={{width:40,height:22,borderRadius:99,background:ativo?'var(--primary)':'var(--border)',position:'relative',transition:'background .2s',flexShrink:0}}>
        <span style={{position:'absolute',top:2,left:ativo?20:2,width:18,height:18,borderRadius:'50%',background:'white',transition:'left .2s',boxShadow:'0 1px 3px rgba(0,0,0,0.3)'}}/>
      </span>
      <span style={{fontSize:12,fontWeight:600,color:'var(--text2)'}}>{ativo?'Boas-vindas ligada':'Boas-vindas desligada'} (as 2 telas)</span>
    </button>
  )

  // ---------- MODO EDIÇÃO (admin) ----------
  if (admin && editando) {
    return (
      <div style={{background:'white',borderRadius:14,boxShadow:'var(--shadow-sm)',padding:16,marginBottom:16}}>
        <div style={{paddingBottom:12,marginBottom:12,borderBottom:'1px solid var(--border)'}}><SwitchAtivo/></div>
        <div style={{display:'flex',gap:6,marginBottom:14}}>
          {(['encontrista','encontreiro'] as BVVariante[]).map(v=>(
            <button key={v} onClick={()=>{ setVarEdit(v); carregar(v) }} className="btn btn-sm"
              style={{flex:1,border:varEdit===v?'2px solid var(--primary)':'1px solid var(--border)',background:varEdit===v?'var(--primary-light)':'white',color:varEdit===v?'var(--primary)':'var(--text2)'}}>
              {v==='encontrista'?'Visitante / Encontrista':'Encontreiro s/ equipe'}
            </button>
          ))}
        </div>

        <label className="form-label">Texto informativo</label>
        <RichEditor value={data.texto} onChange={v=>setData(d=>({...d,texto:v}))} placeholder="Escreva as boas-vindas, orientações, horários..." minHeight={140}/>

        <div className="form-group" style={{marginTop:14}}>
          <label className="form-label">Localização (GPS)</label>
          <input className="form-input" value={data.endereco} onChange={e=>setData(d=>({...d,endereco:e.target.value}))} placeholder="Endereço (opcional, aparece no texto)"/>
          <div style={{display:'flex',gap:8,marginTop:8}}>
            <input className="form-input" value={data.lat} onChange={e=>setData(d=>({...d,lat:e.target.value}))} placeholder="Latitude" style={{flex:1}}/>
            <input className="form-input" value={data.lng} onChange={e=>setData(d=>({...d,lng:e.target.value}))} placeholder="Longitude" style={{flex:1}}/>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" style={{marginTop:8,color:'var(--primary)'}} onClick={usarMinhaLocalizacao}>
            <span className="icon icon-sm">my_location</span> Usar minha localização
          </button>
        </div>

        <div className="form-group">
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
            <label className="form-label" style={{margin:0}}>Contatos (WhatsApp)</label>
            <button type="button" className="btn btn-ghost btn-sm" onClick={addContato}><span className="icon icon-sm">add</span> Contato</button>
          </div>
          {data.contatos.map((c,i)=>(
            <div key={i} style={{border:'1px solid var(--border)',borderRadius:10,padding:10,marginBottom:8}}>
              <div style={{display:'flex',gap:8,marginBottom:8}}>
                <input className="form-input" value={c.nome} onChange={e=>setContato(i,'nome',e.target.value)} placeholder="Nome" style={{flex:1}}/>
                <button type="button" onClick={()=>delContato(i)} style={{background:'var(--danger-bg)',color:'var(--danger)',border:'none',borderRadius:8,padding:'0 10px',cursor:'pointer',fontFamily:'inherit'}}><span className="icon icon-sm">delete</span></button>
              </div>
              <div style={{display:'flex',gap:8}}>
                <input className="form-input" value={c.funcao} onChange={e=>setContato(i,'funcao',e.target.value)} placeholder="Função (opcional)" style={{flex:1}}/>
                <input className="form-input" value={c.numero} onChange={e=>setContato(i,'numero',e.target.value)} placeholder="WhatsApp (só números)" style={{flex:1}}/>
              </div>
            </div>
          ))}
        </div>

        <div style={{display:'flex',gap:8,marginTop:8}}>
          <button className="btn btn-primary" style={{flex:1}} onClick={salvar} disabled={salvando}>{salvando?'Salvando...':'Salvar'}</button>
          <button className="btn btn-ghost" onClick={()=>{ setEditando(false); carregar(variante) }}>Cancelar</button>
        </div>
      </div>
    )
  }

  // ---------- MODO VISUALIZAÇÃO ----------
  if (vazio && !admin) return null
  return (
    <div style={{background:'white',borderRadius:14,boxShadow:'var(--shadow-sm)',padding:16,marginBottom:16}}>
      {admin && (
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8,gap:8,flexWrap:'wrap'}}>
          <SwitchAtivo/>
          <button className="btn btn-ghost btn-sm" onClick={()=>setEditando(true)}><span className="icon icon-sm">edit</span> Editar boas-vindas</button>
        </div>
      )}
      {admin && !ativo && (
        <p style={{fontSize:12,color:'var(--muted)',textAlign:'center',padding:'4px 0 8px'}}>
          As telas de boas-vindas (Encontristas e Encontreiros) estão <b>desligadas</b> — os usuários não as veem.
        </p>
      )}
      {msg && <p style={{fontSize:12,color:'var(--success)',textAlign:'center',marginBottom:8}}>{msg}</p>}

      {vazio && admin && <p style={{fontSize:13,color:'var(--muted)',textAlign:'center',padding:'12px 0'}}>Nada configurado ainda. Toque em "Editar boas-vindas".</p>}

      {/* 1) Texto */}
      {data.texto && <div style={{fontSize:14,lineHeight:1.7,color:'var(--text)'}} dangerouslySetInnerHTML={{__html:data.texto}}/>}

      {/* 2) Localização (endereço) */}
      {data.endereco && (
        <div style={{display:'flex',alignItems:'center',gap:8,marginTop:12}}>
          <span style={{fontSize:18}}>📍</span>
          <p style={{fontSize:13,fontWeight:600}}>{data.endereco}</p>
        </div>
      )}

      {/* 3) Mapa */}
      {temMapa(data) && (
        <div style={{marginTop:10,borderRadius:12,overflow:'hidden',border:'1px solid var(--border)'}}>
          <iframe title="mapa" src={mapaSrc(data)} style={{width:'100%',height:200,border:'none'}} loading="lazy"/>
        </div>
      )}
      {(data.lat && data.lng) && (
        <a href={`https://www.google.com/maps?q=${data.lat},${data.lng}`} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm btn-full" style={{marginTop:8}}>
          <span className="icon icon-sm">directions</span> Abrir rota no mapa
        </a>
      )}

      {/* 4) Contatos */}
      {data.contatos.length>0 && (
        <div style={{marginTop:14}}>
          <p className="section-label mb-2">Contatos</p>
          {data.contatos.filter(c=>c.numero||c.nome).map((c,i)=>(
            <a key={i} href={waLink(c.numero)} target="_blank" rel="noreferrer"
              style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',background:'var(--bg)',borderRadius:10,marginBottom:6,textDecoration:'none',color:'var(--text)'}}>
              <div style={{width:36,height:36,borderRadius:'50%',background:'#25D366',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <span className="icon icon-sm" style={{color:'white'}}>chat</span>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <p style={{fontSize:14,fontWeight:700}}>{c.nome||'Contato'}</p>
                {c.funcao && <p style={{fontSize:12,color:'var(--muted)'}}>{c.funcao}</p>}
              </div>
              <span className="icon icon-sm" style={{color:'#25D366'}}>chevron_right</span>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
