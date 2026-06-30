import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatName, getInitials, isMenor, STATUS_PESSOA } from '../utils'
import { useEvento } from '../hooks/useEvento'
import PersonSelect from '../components/PersonSelect'
import UploadFoto from '../components/UploadFoto'
import type { Profile } from '../App'

type Pessoa = {
  id:string; name:string; phone:string; church:string; status:string
  sexo:string|null; birth_date:string|null; cpf:string|null
  cidade:string|null; photo_url:string|null; referencia_id:string|null
}
type Encontreiro = { id:string; name:string }

export default function EncontristasCadastro({ profile }: { profile: Profile }) {
  const { evento, loading: evLoading } = useEvento()
  const [lista, setLista]           = useState<Pessoa[]>([])
  const [encontreiros, setEncontreiros] = useState<Encontreiro[]>([])
  const [busca, setBusca]           = useState('')
  const [filtro, setFiltro]         = useState('todos')
  const [loading, setLoading]       = useState(true)
  const [modal, setModal]           = useState(false)
  const [editando, setEditando]     = useState<Pessoa|null>(null)
  const [salvando, setSalvando]     = useState(false)
  const [erro, setErro]             = useState('')
  const [fotoUrl, setFotoUrl]       = useState<string|null>(null)
  const [form, setForm] = useState({
    name:'', phone:'', church:'', sexo:'', birth_date:'',
    cpf:'', cidade:'', status:'inscrito',
    referencia_id:'', responsavel_nome:'', responsavel_tel:'',
  })

  useEffect(() => { if (evLoading) return; if (!evento) { setLoading(false); return }; carregar() }, [evento, evLoading])

  async function carregar() {
    if (!evento) return
    setLoading(true)
    const [enc, trb] = await Promise.all([
      supabase.from('people').select('*').eq('event_id',evento.id).eq('role_type','encounterer').order('name'),
      supabase.from('people').select('id,name').eq('event_id',evento.id).eq('role_type','worker').order('name'),
    ])
    setLista(enc.data??[])
    setEncontreiros(trb.data??[])
    setLoading(false)
  }

  function abrirNovo() {
    setEditando(null)
    setFotoUrl(null)
    setForm({name:'',phone:'',church:'',sexo:'',birth_date:'',cpf:'',cidade:'',status:'inscrito',referencia_id:'',responsavel_nome:'',responsavel_tel:''})
    setErro(''); setModal(true)
  }

  function abrirEdicao(p: Pessoa) {
    setEditando(p)
    setFotoUrl(p.photo_url)
    setForm({name:p.name,phone:p.phone,church:p.church,sexo:p.sexo??'',birth_date:p.birth_date??'',cpf:p.cpf??'',cidade:p.cidade??'',status:p.status,referencia_id:p.referencia_id??'',responsavel_nome:'',responsavel_tel:''})
    setErro(''); setModal(true)
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setErro(''); setSalvando(true)
    if (!evento) return
    if (!form.name.trim()||!form.phone.trim()||!form.church.trim()) {
      setErro('Nome, celular e igreja sao obrigatorios.'); setSalvando(false); return
    }
    const payload = {
      name:formatName(form.name), phone:form.phone, church:form.church,
      role_type:'encounterer', sexo:form.sexo||null, birth_date:form.birth_date||null,
      cpf:form.cpf||null, cidade:form.cidade||null, status:form.status,
      referencia_id:form.referencia_id||null, photo_url:fotoUrl||null, event_id:evento.id,
    }
    let err
    if (editando) { const r=await supabase.from('people').update(payload).eq('id',editando.id); err=r.error }
    else { const r=await supabase.from('people').insert(payload); err=r.error }
    if (err) { setErro('Erro: '+err.message); setSalvando(false); return }
    setModal(false); setSalvando(false); setEditando(null); carregar()
  }

  const filtrados = lista.filter(p => {
    const q = busca.toLowerCase()
    const matchBusca = !q||p.name.toLowerCase().includes(q)||p.church.toLowerCase().includes(q)||p.phone.includes(q)
    const matchFiltro = filtro==='todos'||p.status===filtro
    return matchBusca && matchFiltro
  })

  const masc = lista.filter(p=>p.sexo==='M').length
  const fem  = lista.filter(p=>p.sexo==='F').length

  return (
    <div className="page">
      <div className="stats-grid mb-4">
        <div className="stat-card"><div className="stat-label">Total</div><div className="stat-value">{lista.length}</div></div>
        <div className="stat-card"><div className="stat-label">H / M</div><div className="stat-value" style={{fontSize:20}}>{masc} / {fem}</div></div>
      </div>

      <div className="search-bar mb-3">
        <span className="icon icon-sm" style={{color:'var(--muted-light)'}}>search</span>
        <input placeholder="Buscar..." value={busca} onChange={e=>setBusca(e.target.value)}/>
      </div>

      <div className="filter-bar">
        {[['todos','Todos'],['inscrito','Inscritos'],['confirmado','Confirmados'],['cancelado','Cancelados']].map(([v,l])=>(
          <button key={v} className={`chip ${filtro===v?'active':''}`} onClick={()=>setFiltro(v)}>{l}</button>
        ))}
      </div>

      {loading ? [1,2,3].map(i=><div key={i} className="skeleton" style={{height:68,marginBottom:8,borderRadius:14}}/>) :
      filtrados.map(p => {
        const ref = encontreiros.find(e=>e.id===p.referencia_id)
        const cfg = STATUS_PESSOA[p.status]??STATUS_PESSOA.inscrito
        return (
          <button key={p.id} className="list-card" onClick={()=>abrirEdicao(p)}>
            <div className="list-card-bar"/>
            <div className="list-card-media">
              {p.photo_url
                ? <img src={p.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                : <span style={{fontSize:18,fontWeight:700,color:'var(--primary)'}}>{getInitials(p.name)}</span>
              }
            </div>
            <div className="list-card-body">
              <div className="list-card-title">{p.name}</div>
              <div className="list-card-desc">{p.church}{ref?` · Ref: ${ref.name.split(' ')[0]}`:''}</div>
            </div>
            <span className={`badge ${cfg.badge}`} style={{marginRight:4,flexShrink:0}}>{cfg.label}</span>
            <div className="list-card-chevron"><span className="icon icon-sm">chevron_right</span></div>
          </button>
        )
      })}

      <button className="fab" onClick={abrirNovo}><span className="icon">add</span></button>

      {modal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'8px 20px 32px',maxHeight:'92vh',overflowY:'auto'}}>
            <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 0'}}/>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'18px 0 16px',borderBottom:'1px solid var(--border)',marginBottom:20}}>
              <span style={{fontSize:17,fontWeight:700}}>{editando?'Editar encontrista':'Novo encontrista'}</span>
              <button onClick={()=>setModal(false)} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:'50%',width:32,height:32,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}><span className="icon icon-sm">close</span></button>
            </div>
            {erro && <div className="alert-box alert-error mb-3">{erro}</div>}
            <form onSubmit={salvar}>
              {/* Foto */}
              <div style={{display:'flex',justifyContent:'center',marginBottom:20}}>
                <UploadFoto
                  bucket="pessoas"
                  path={`encontrista-${editando?.id??Date.now()}`}
                  currentUrl={fotoUrl}
                  onUpload={url=>setFotoUrl(url)}
                  label="Foto do encontrista"
                  size={80}
                  shape="circle"
                />
              </div>

              <div className="form-group"><label className="form-label">Nome completo <span className="req">*</span></label>
                <input className="form-input" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} required/>
              </div>
              <div className="form-grid-2">
                <div className="form-group"><label className="form-label">Celular <span className="req">*</span></label>
                  <input className="form-input" value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} required/>
                </div>
                <div className="form-group"><label className="form-label">Sexo</label>
                  <select className="form-select" value={form.sexo} onChange={e=>setForm(f=>({...f,sexo:e.target.value}))}>
                    <option value="">Selecionar</option>
                    <option value="M">Masculino</option>
                    <option value="F">Feminino</option>
                  </select>
                </div>
              </div>
              <div className="form-group"><label className="form-label">Igreja <span className="req">*</span></label>
                <input className="form-input" value={form.church} onChange={e=>setForm(f=>({...f,church:e.target.value}))} required/>
              </div>
              <div className="form-grid-2">
                <div className="form-group"><label className="form-label">Cidade</label>
                  <input className="form-input" value={form.cidade} onChange={e=>setForm(f=>({...f,cidade:e.target.value}))}/>
                </div>
                <div className="form-group"><label className="form-label">Nascimento</label>
                  <input className="form-input" type="date" value={form.birth_date} onChange={e=>setForm(f=>({...f,birth_date:e.target.value}))}/>
                </div>
              </div>
              {form.birth_date && isMenor(form.birth_date) && (
                <>
                  <div className="alert-box alert-warning mb-3">Menor de idade — informe o responsavel.</div>
                  <div className="form-group"><label className="form-label">Nome do responsavel</label>
                    <input className="form-input" value={form.responsavel_nome} onChange={e=>setForm(f=>({...f,responsavel_nome:e.target.value}))}/>
                  </div>
                  <div className="form-group"><label className="form-label">Telefone do responsavel</label>
                    <input className="form-input" value={form.responsavel_tel} onChange={e=>setForm(f=>({...f,responsavel_tel:e.target.value}))}/>
                  </div>
                </>
              )}
              <div className="form-group"><label className="form-label">CPF / RG</label>
                <input className="form-input" value={form.cpf} onChange={e=>setForm(f=>({...f,cpf:e.target.value}))}/>
              </div>
              <div className="form-group"><label className="form-label">Quem conhece esta pessoa?</label>
                <p className="form-hint mb-2">Encontreiro de referencia para identificacao no evento.</p>
                <select className="form-select" value={form.referencia_id} onChange={e=>setForm(f=>({...f,referencia_id:e.target.value}))}>
                  <option value="">Nenhum</option>
                  {encontreiros.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Status</label>
                <select className="form-select" value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
                  <option value="inscrito">Inscrito</option>
                  <option value="confirmado">Confirmado</option>
                  <option value="cancelado">Cancelado</option>
                  <option value="concluiu">Concluiu</option>
                </select>
              </div>
              <button type="submit" className="btn btn-primary btn-full" disabled={salvando} style={{marginTop:8}}>
                {salvando?'Salvando...':editando?'Salvar alteracoes':'Cadastrar encontrista'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
