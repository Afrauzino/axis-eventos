/**
 * Cadastros — Pré-cadastro simplificado
 * Admin/líder cadastra nome + tipo + informações básicas
 * Sistema gera código de acesso → pessoa usa no Primeiro Acesso para criar conta completa
 */
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatName, getInitials, isAdmin, canEditPessoas } from '../utils'
import { useEvento } from '../hooks/useEvento'
import type { Profile } from '../App'

type Pessoa = {
  id:string; name:string; phone:string|null; church:string|null
  role_type:string; status:string; photo_url:string|null
  invite_code:string|null; user_id:string|null
}

const ROLES = [
  { value:'encounterer', label:'Encontrista', cor:'#6B46C1', bg:'#F3F0FF' },
  { value:'worker',      label:'Encontreiro', cor:'#00A99D', bg:'#E6F8F7' },
]

export default function Cadastros({ profile }: { profile: Profile }) {
  const { evento, loading: evLoading } = useEvento()
  const [lista, setLista]     = useState<Pessoa[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro]       = useState('')
  const [busca, setBusca]     = useState('')
  const [filtroRole, setFiltroRole] = useState('todos')
  const [form, setForm]       = useState({ name:'', phone:'', church:'', role_type:'encounterer' })
  const [editando, setEditando] = useState<Pessoa|null>(null)

  const canEdit = isAdmin(profile.user_role) || canEditPessoas(profile.user_role)

  useEffect(() => { if (evLoading) return; if (!evento) { setLoading(false); return }; carregar() }, [evento, evLoading])

  async function carregar() {
    if (!evento) return
    setLoading(true)
    const { data } = await supabase.from('people').select('id,name,phone,church,role_type,status,photo_url,invite_code,user_id')
      .eq('event_id', evento.id).order('name')
    setLista(data ?? [])
    setLoading(false)
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setErro(''); setSalvando(true)
    if (!evento || !form.name.trim()) { setErro('Nome é obrigatório.'); setSalvando(false); return }

    // Gerar código de acesso
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i=0; i<8; i++) code += chars[Math.floor(Math.random()*chars.length)]

    let error
    if (editando) {
      // Edição: atualiza sem mexer no código
      const r = await supabase.from('people').update({
        name: formatName(form.name),
        phone: form.phone || null,
        church: form.church || null,
        role_type: form.role_type,
      }).eq('id', editando.id)
      error = r.error
    } else {
      const r = await supabase.from('people').insert({
        name: formatName(form.name),
        phone: form.phone || null,
        church: form.church || null,
        role_type: form.role_type,
        status: 'inscrito',
        event_id: evento.id,
        invite_code: code,
      })
      error = r.error
    }
    if (error) { setErro('Erro: ' + error.message); setSalvando(false); return }
    setModal(false); setSalvando(false); setEditando(null)
    setForm({ name:'', phone:'', church:'', role_type:'encounterer' })
    carregar()
  }

  async function compartilharCodigo(p: Pessoa) {
    if (!p.invite_code) return
    const msg = `Olá ${p.name.split(' ')[0]}! Seu código de acesso para o Encontro com Deus é: ${p.invite_code}\n\nAbra o app, toque em "Primeiro acesso" e digite o código para criar sua conta.`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Código de acesso', text: msg })
      } catch (err) {
        // usuário cancelou o compartilhamento — silencioso
      }
    } else {
      // Fallback: WhatsApp Web/App direto
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
    }
  }

  async function excluirPessoa(p: Pessoa) {
    if (!confirm(`Excluir "${p.name}"?\n\nSe ela tiver conta, a conta também será removida.`)) return

    // Excluir dados vinculados
    await supabase.from('saude_fichas').delete().eq('person_id', p.id)
    await supabase.from('escalas').delete().eq('person_id', p.id)
    await supabase.from('med_controlados').delete().eq('person_id', p.id)
    await supabase.from('people_teams').delete().eq('person_id', p.id)

    // Remover vínculo de conta (não deleta auth.user - precisa do Dashboard)
    if (p.user_id) {
      await supabase.from('profiles').update({ role_status:'rejected' }).eq('user_id', p.user_id)
    }

    await supabase.from('people').delete().eq('id', p.id)
    carregar()
  }

  const filtrados = lista.filter(p => {
    const q = busca.toLowerCase()
    const matchBusca = !q || p.name.toLowerCase().includes(q) || (p.phone??'').includes(q) || (p.church??'').toLowerCase().includes(q)
    const matchRole = filtroRole==='todos' || p.role_type===filtroRole
    return matchBusca && matchRole
  })

  return (
    <div className="page">
      {/* Stats */}
      <div style={{display:'flex',gap:8,marginBottom:12,fontSize:13,color:'var(--muted)'}}>
        <span style={{fontWeight:600,color:'var(--text)'}}>{lista.length}</span> total ·
        <span style={{fontWeight:600,color:'#6B46C1'}}>{lista.filter(p=>p.role_type==='encounterer').length}</span> encontristas ·
        <span style={{fontWeight:600,color:'var(--primary)'}}>{lista.filter(p=>p.role_type==='worker').length}</span> encontreiros
      </div>

      {/* Busca */}
      <div className="search-bar mb-3">
        <span className="icon icon-sm" style={{color:'var(--muted-light)'}}>search</span>
        <input placeholder="Buscar por nome, celular ou igreja..." value={busca} onChange={e=>setBusca(e.target.value)}/>
        {busca && <button onClick={()=>setBusca('')} style={{background:'none',border:'none',cursor:'pointer',color:'var(--muted-light)',padding:0,fontFamily:'inherit'}}><span className="icon icon-sm">close</span></button>}
      </div>

      {/* Filtros */}
      <div className="filter-bar">
        {[['todos','Todos'],['encounterer','Encontristas'],['worker','Encontreiros']].map(([v,l])=>(
          <button key={v} className={`chip ${filtroRole===v?'active':''}`} onClick={()=>setFiltroRole(v)}>{l}</button>
        ))}
      </div>

      {/* Lista */}
      {loading ? [1,2,3,4].map(i=><div key={i} className="skeleton" style={{height:72,marginBottom:8,borderRadius:14}}/>) :
      filtrados.length === 0 ? (
        <div className="empty">
          <div className="empty-icon"><span className="icon" style={{color:'var(--muted-light)'}}>person_search</span></div>
          <p className="empty-title">Nenhum resultado</p>
        </div>
      ) : filtrados.map(p => {
        const role = ROLES.find(r=>r.value===p.role_type)
        return (
          <div key={p.id} style={{background:'white',borderRadius:12,boxShadow:'0 1px 5px rgba(0,0,0,0.12)',marginBottom:10,display:'flex',alignItems:'center',overflow:'hidden'}}>
            <div style={{width:6,background:role?.cor??'var(--primary)',alignSelf:'stretch',flexShrink:0}}/>
            {/* Avatar */}
            <div style={{width:50,height:50,borderRadius:'50%',background:role?.bg??'var(--primary-light)',margin:'0 12px 0 14px',flexShrink:0,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center'}}>
              {p.photo_url
                ? <img src={p.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                : <span style={{fontWeight:700,fontSize:16,color:role?.cor}}>{getInitials(p.name)}</span>
              }
            </div>
            {/* Info */}
            <div style={{flex:1,minWidth:0,padding:'12px 0'}}>
              <p style={{fontWeight:700,fontSize:15,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.name}</p>
              <p style={{fontSize:11,color:'var(--muted)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                {role?.label} {p.church ? `· ${p.church}` : ''}
              </p>
              {/* Status da conta */}
              <div style={{marginTop:3,display:'flex',alignItems:'center',gap:6}}>
                {p.user_id
                  ? <span className="badge badge-success" style={{fontSize:9}}>✓ Conta criada</span>
                  : p.invite_code
                    ? <>
                        <span style={{fontFamily:'monospace',fontSize:11,fontWeight:800,letterSpacing:'0.08em',color:'var(--primary)',background:'var(--primary-light)',padding:'1px 6px',borderRadius:6}}>{p.invite_code}</span>
                        <button onClick={()=>compartilharCodigo(p)}
                          style={{background:'#25D366',border:'none',borderRadius:6,padding:'2px 8px',cursor:'pointer',fontFamily:'inherit',display:'inline-flex',alignItems:'center',gap:3,color:'white',fontSize:10,fontWeight:700}}
                          title="Compartilhar código">
                          <span className="icon" style={{fontSize:12,color:'white'}}>share</span>
                          Enviar
                        </button>
                      </>
                    : <span className="badge badge-neutral" style={{fontSize:9}}>Sem código</span>
                }
              </div>
            </div>
            {/* Ações */}
            {canEdit && (
              <div style={{display:'flex',flexShrink:0}}>
                <button onClick={()=>{setErro('');setEditando(p);setForm({name:p.name,phone:p.phone??'',church:(p as any).church??'',role_type:p.role_type});setModal(true)}}
                  style={{background:'none',border:'none',color:'var(--primary)',cursor:'pointer',padding:'8px 10px',fontFamily:'inherit',display:'flex',alignItems:'center'}}
                  title="Editar">
                  <span className="icon icon-sm">edit</span>
                </button>
                <button onClick={()=>excluirPessoa(p)}
                  style={{background:'none',border:'none',color:'var(--muted-light)',cursor:'pointer',padding:'8px 10px',fontFamily:'inherit',display:'flex',alignItems:'center'}}
                  title="Excluir">
                  <span className="icon icon-sm">delete</span>
                </button>
              </div>
            )}
          </div>
        )
      })}

      {/* FAB */}
      {canEdit && <button className="fab" onClick={()=>{setErro('');setEditando(null);setForm({name:'',phone:'',church:'',role_type:'encounterer'});setModal(true)}}><span className="icon">add</span></button>}

      {/* Modal pré-cadastro */}
      {modal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',flexDirection:'column',justifyContent:'flex-end'}}
          onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'8px 20px 32px',maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 0'}}/>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 0 14px',borderBottom:'1px solid var(--border)',marginBottom:20}}>
              <span style={{fontSize:17,fontWeight:700}}>{editando?"Editar cadastro":"Pré-cadastro"}</span>
              <button onClick={()=>setModal(false)} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:'50%',width:32,height:32,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}>
                <span className="icon icon-sm">close</span>
              </button>
            </div>
            <p style={{fontSize:13,color:'var(--muted)',marginBottom:16,lineHeight:1.6}}>
              Cadastre o nome e tipo da pessoa. Um código de acesso será gerado automaticamente para ela criar a conta completa.
            </p>
            {erro && <div className="alert-box alert-error mb-3">{erro}</div>}
            <form onSubmit={salvar}>
              {/* Tipo */}
              <div className="form-group">
                <label className="form-label">Função no evento <span className="req">*</span></label>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:4}}>
                  {ROLES.map(r=>(
                    <button key={r.value} type="button" onClick={()=>setForm(f=>({...f,role_type:r.value}))}
                      style={{padding:'10px',borderRadius:10,cursor:'pointer',fontWeight:700,fontSize:13,fontFamily:'inherit',
                        border:`2px solid ${form.role_type===r.value?r.cor:'var(--border)'}`,
                        background:form.role_type===r.value?r.bg:'white',
                        color:form.role_type===r.value?r.cor:'var(--text2)'}}>
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Nome completo <span className="req">*</span></label>
                <input className="form-input" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} required placeholder="Nome como no documento"/>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Celular</label>
                  <input className="form-input" type="tel" value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="(11) 99999-9999"/>
                </div>
                <div className="form-group">
                  <label className="form-label">Igreja</label>
                  <input className="form-input" value={form.church} onChange={e=>setForm(f=>({...f,church:e.target.value}))} placeholder="Nome da igreja"/>
                </div>
              </div>

              <div style={{background:'var(--primary-light)',borderRadius:10,padding:'10px 12px',marginBottom:16,display:'flex',alignItems:'center',gap:8}}>
                <span className="icon icon-sm" style={{color:'var(--primary)'}}>key</span>
                <p style={{fontSize:12,color:'var(--primary)',fontWeight:600}}>Um código de 8 letras será gerado automaticamente. Envie para a pessoa criar a conta.</p>
              </div>

              <button type="submit" className="btn btn-primary btn-full" disabled={salvando}>
                {salvando ? 'Cadastrando...' : 'Cadastrar e gerar código'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
