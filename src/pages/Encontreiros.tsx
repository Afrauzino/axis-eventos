import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatName, getInitials, isAdmin, canEditPessoas } from '../utils'
import UploadFoto from '../components/UploadFoto'
import CardItem from '../components/CardItem'
import { useEvento } from '../hooks/useEvento'
import type { Profile } from '../App'

type Pessoa = { id:string; name:string; phone:string; church:string; photo_url:string|null; sexo:string|null; birth_date:string|null; cpf:string|null; cidade:string|null; user_id:string|null }
type Equipe = { id:string; name:string; color:string }

export default function Encontreiros({ profile }: { profile?: Profile }) {
  const { evento, loading: evLoading } = useEvento()
  const [lista, setLista]     = useState<Pessoa[]>([])
  const [equipes, setEquipes] = useState<Equipe[]>([])
  const [vinculos, setVinculos] = useState<{person_id:string;team_id:string}[]>([])
  const [busca, setBusca]     = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(false)
  const [editando, setEditando] = useState<Pessoa|null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro]       = useState('')
  const [fotoUrl, setFotoUrl] = useState<string|null>(null)
  const [form, setForm] = useState({ name:'', phone:'', church:'', sexo:'', birth_date:'', cpf:'', cidade:'' })

  const canEdit = profile && canEditPessoas(profile.user_role)

  useEffect(() => { if (evLoading) return; if (!evento) { setLoading(false); return }; carregar() }, [evento, evLoading])

  async function carregar() {
    if (!evento) return
    setLoading(true)
    const [pe, eq, vi] = await Promise.all([
      supabase.from('people').select('*').eq('event_id', evento.id).eq('role_type','worker').order('name'),
      supabase.from('teams').select('id,name,color,leader_id,co_leader_id').eq('event_id', evento.id).order('name'),
      supabase.from('people_teams').select('person_id,team_id'),
    ])
    setLista(pe.data ?? [])
    setEquipes(eq.data ?? [])
    setVinculos(vi.data ?? [])
    setLoading(false)
  }

  function getEquipes(personId: string) {
    const ids = vinculos.filter(v=>v.person_id===personId).map(v=>v.team_id)
    // inclui equipes que a pessoa LIDERA (líder ou co-líder), não só onde é membro
    return equipes.filter(e=>ids.includes(e.id) || (e as any).leader_id===personId || (e as any).co_leader_id===personId)
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setErro(''); setSalvando(true)
    if (!evento) return
    if (!form.name.trim() || !form.phone.trim() || !form.church.trim()) {
      setErro('Nome, celular e igreja sao obrigatorios.'); setSalvando(false); return
    }
    const payload = {
      name: formatName(form.name), phone: form.phone, church: form.church,
      role_type: 'worker', sexo: form.sexo||null,
      birth_date: form.birth_date||null, cpf: form.cpf||null,
      cidade: form.cidade||null, photo_url: fotoUrl||null, event_id: evento.id,
    }
    let err
    if (editando) { const r=await supabase.from('people').update(payload).eq('id',editando.id); err=r.error }
    else { const r=await supabase.from('people').insert(payload); err=r.error }
    if (err) { setErro('Erro: '+err.message); setSalvando(false); return }
    setModal(false); setSalvando(false); setEditando(null); carregar()
  }

  const filtrados = lista.filter(p => {
    if (!busca.trim()) return true
    const q = busca.toLowerCase()
    return p.name.toLowerCase().includes(q) || p.church.toLowerCase().includes(q) || p.phone.includes(q)
  })

  return (
    <div className="page">
      <div className="stats-grid mb-4">
        <div className="stat-card"><div className="stat-label">Total</div><div className="stat-value">{lista.length}</div></div>
        <div className="stat-card"><div className="stat-label">Homens / Mulheres</div><div className="stat-value" style={{fontSize:18}}>{lista.filter(p=>p.sexo==='M').length} / {lista.filter(p=>p.sexo==='F').length}</div></div>
      </div>

      <div className="search-bar mb-3">
        <span className="icon icon-sm" style={{color:'var(--muted-light)'}}>search</span>
        <input placeholder="Buscar por nome, igreja ou celular..." value={busca} onChange={e=>setBusca(e.target.value)} />
      </div>

      {loading ? [1,2,3].map(i=><div key={i} className="skeleton" style={{height:68,marginBottom:8,borderRadius:14}}/>) :
      filtrados.length===0 ? (
        <div className="empty">
          <div className="empty-icon"><span className="icon" style={{color:'var(--muted-light)'}}>groups</span></div>
          <p className="empty-title">Nenhum encontreiro</p>
          <p className="empty-desc">Cadastre os encontreiros deste evento.</p>
        </div>
      ) : filtrados.map(p => {
        const eqs = getEquipes(p.id)
        const corCard = eqs[0]?.color || 'var(--primary)'
        return (
          <CardItem
            key={p.id}
            cor={corCard}
            fotoUrl={p.photo_url}
            iniciais={getInitials(p.name)}
            titulo={p.name}
            subtitulo={p.church}
            badges={eqs.length>0
              ? eqs.map(e=>({ emoji:'👥', texto:e.name, cor:e.color }))
              : [{ emoji:'⚠️', texto:'Sem equipe' }]}
            onClick={()=>{ if(!canEdit) return; setEditando(p); setForm({name:p.name,phone:p.phone,church:p.church,sexo:p.sexo??'',birth_date:p.birth_date??'',cpf:p.cpf??'',cidade:p.cidade??''}); setErro(''); setModal(true) }}
          />
        )
      })}

      {canEdit && <button className="fab" onClick={()=>{setEditando(null);setForm({name:'',phone:'',church:'',sexo:'',birth_date:'',cpf:'',cidade:''});setErro('');setModal(true)}}><span className="icon">add</span></button>}

      {modal && canEdit && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'8px 20px 32px',maxHeight:'92vh',overflowY:'auto'}}>
            <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 0'}}/>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'18px 0 16px',borderBottom:'1px solid var(--border)',marginBottom:20}}>
              <span style={{fontSize:17,fontWeight:700}}>{editando?'Editar encontreiro':'Novo encontreiro'}</span>
              <button onClick={()=>setModal(false)} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:'50%',width:32,height:32,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}><span className="icon icon-sm">close</span></button>
            </div>
            {erro && <div className="alert-box alert-error mb-3">{erro}</div>}
            <form onSubmit={salvar}>
              {/* Foto */}
              <div style={{display:'flex',justifyContent:'center',marginBottom:20}}>
                <UploadFoto
                  bucket="pessoas"
                  path={`encontreiro-${editando?.id??Date.now()}`}
                  currentUrl={fotoUrl}
                  onUpload={url=>setFotoUrl(url)}
                  label="Foto do encontreiro"
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
              <div className="form-group"><label className="form-label">CPF / RG</label>
                <input className="form-input" value={form.cpf} onChange={e=>setForm(f=>({...f,cpf:e.target.value}))}/>
              </div>
              <button type="submit" className="btn btn-primary btn-full" disabled={salvando} style={{marginTop:8}}>
                {salvando?'Salvando...':editando?'Salvar':'Cadastrar encontreiro'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
