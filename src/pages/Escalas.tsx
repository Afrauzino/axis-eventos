import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import SubTabs from '../components/SubTabs'
import PrintOverlay from '../components/PrintOverlay'
import { getInitials, fmtHora, isAdmin, isLider, nowLocalInput } from '../utils'
import { useEvento } from '../hooks/useEvento'
import { usePermissao } from '../hooks/usePermissao'
import PersonSelect from '../components/PersonSelect'
import Seletor from '../components/Seletor'
import type { Profile } from '../App'

type Escala  = { id:string; person_id:string; team_id:string|null; title:string; start_time:string; end_time:string; location:string|null; notes:string|null; status:string }
type Pessoa  = { id:string; name:string; photo_url:string|null }
type Equipe  = { id:string; name:string; color:string }
type Local   = { id:string; nome:string }

export default function Escalas({ profile }: { profile?: Profile }) {
  const { evento, loading: evLoading } = useEvento()
  const [escalas, setEscalas]   = useState<Escala[]>([])
  const [pessoas, setPessoas]   = useState<Pessoa[]>([])
  const [equipes, setEquipes]   = useState<Equipe[]>([])
  const [vinculos, setVinculos] = useState<{person_id:string;team_id:string}[]>([])
  const [locais, setLocais]     = useState<Local[]>([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(false)
  const [editando, setEditando] = useState<Escala|null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro]         = useState('')
  const [conflito, setConflito] = useState<string|null>(null)
  const [imprimir, setImprimir] = useState(false)
  const hoje = new Date()
  const [dataSel, setDataSel]   = useState(hoje)

  const [formEquipeId, setFormEquipeId] = useState('')
  const [form, setForm] = useState({ person_id:'', title:'', start_time:nowLocalInput(), end_time:nowLocalInput(), location:'', notes:'' })
  const [modoGrupo, setModoGrupo]     = useState(false)
  const [pessoasSel, setPessoasSel]   = useState<string[]>([])

  const { pode } = usePermissao(profile ?? null)
  // Admin/líder OU liberação (individual/equipe) "ver e editar Escalas" na tela do Admin
  const canEdit = (!!profile && (isAdmin(profile.user_role) || isLider(profile.user_role))) || pode('escalas','editar')
  const adminFull = profile && isAdmin(profile.user_role)

  // Resolve my person record and my teams (for líderes)
  const [myPersonId, setMyPersonId] = useState<string|null>(null)
  const [myTeamIds, setMyTeamIds]   = useState<string[]>([])

  useEffect(() => { if (evLoading) return; if (!evento) { setLoading(false); return }; carregar() }, [evento, evLoading])

  async function carregar() {
    if (!evento) return
    setLoading(true)
    const [es, pe, eq, vi, lo] = await Promise.all([
      supabase.from('escalas').select('*').eq('event_id', evento.id).order('start_time'),
      supabase.from('people').select('id,name,photo_url').eq('event_id', evento.id).order('name'),
      supabase.from('teams').select('id,name,color,leader_id,co_leader_id').eq('event_id', evento.id).order('name'),
      supabase.from('people_teams').select('person_id,team_id'),
      supabase.from('locais').select('id,nome').eq('event_id', evento.id).order('nome'),
    ])
    const allEquipes = eq.data ?? []
    setEscalas(es.data ?? [])
    setPessoas(pe.data ?? [])
    setEquipes(allEquipes)
    setVinculos(vi.data ?? [])
    setLocais(lo.data ?? [])

    // Find my person and my led teams (for role-based filtering)
    if (profile && !isAdmin(profile.user_role)) {
      const { data: myPerson } = await supabase.from('people').select('id')
        .eq('event_id', evento!.id).eq('user_id', profile.user_id).maybeSingle()
      if (myPerson) {
        setMyPersonId(myPerson.id)
        const myT = allEquipes
          .filter((t:any) => t.leader_id === myPerson.id || t.co_leader_id === myPerson.id)
          .map((t:any) => t.id)
        setMyTeamIds(myT)
      }
    }
    setLoading(false)
  }

  // Equipes disponíveis no formulário (lider só vê as suas)
  const equipesDisponiveis = adminFull || myTeamIds.length === 0
    ? equipes
    : equipes.filter(e => myTeamIds.includes(e.id))

  // Pessoas filtradas pela equipe selecionada
  const pessoasDaEquipe: Pessoa[] = formEquipeId
    ? pessoas.filter(p => vinculos.some(v => v.person_id === p.id && v.team_id === formEquipeId))
    : pessoas

  async function verificarConflito(personId:string, startTime:string, endTime:string, excludeId?:string): Promise<string|null> {
    const inicio = new Date(startTime).getTime()
    const fim    = new Date(endTime).getTime()
    const conflitos = escalas.filter(e => {
      if (e.person_id !== personId) return false
      if (excludeId && e.id === excludeId) return false
      const eIni = new Date(e.start_time).getTime()
      const eFim = new Date(e.end_time).getTime()
      return inicio < eFim && fim > eIni
    })
    if (!conflitos.length) return null
    const c  = conflitos[0]
    const p  = pessoas.find(x => x.id === c.person_id)
    return `${p?.name} já está escalado das ${fmtHora(c.start_time)} às ${fmtHora(c.end_time)} em "${c.title}"`
  }

  async function salvar(e:React.FormEvent) {
    e.preventDefault(); setErro(''); setConflito(null); setSalvando(true)
    if (!evento || !form.title || !form.start_time || !form.end_time) {
      setErro('Preencha atividade e horários.'); setSalvando(false); return
    }

    // Grupo: inserir uma escala por pessoa selecionada
    if (modoGrupo && !editando) {
      if (pessoasSel.length === 0) { setErro('Selecione pelo menos uma pessoa.'); setSalvando(false); return }
      const grupoId = crypto.randomUUID()
      for (const pid of pessoasSel) {
        await supabase.from('escalas').insert({
          event_id: evento.id, person_id: pid, team_id: formEquipeId||null,
          title: form.title, start_time: new Date(form.start_time).toISOString(),
          end_time: new Date(form.end_time).toISOString(), location: form.location||null,
          notes: form.notes||null, status: 'confirmed', grupo_id: grupoId,
        })
      }
      setModal(false); setSalvando(false); resetForm(); carregar(); return
    }

    // Individual
    if (!form.person_id) { setErro('Selecione a pessoa.'); setSalvando(false); return }
    const cf = await verificarConflito(form.person_id, form.start_time, form.end_time, editando?.id)
    if (cf) { setConflito(cf); setSalvando(false); return }
    const payload = {
      event_id: evento.id, person_id: form.person_id, team_id: formEquipeId||null,
      title: form.title, start_time: new Date(form.start_time).toISOString(),
      end_time: new Date(form.end_time).toISOString(), location: form.location||null,
      notes: form.notes||null, status: 'confirmed',
    }
    let err
    if (editando) { const r = await supabase.from('escalas').update(payload).eq('id',editando.id); err = r.error }
    else { const r = await supabase.from('escalas').insert(payload); err = r.error }
    if (err) { setErro('Erro: '+err.message); setSalvando(false); return }
    setModal(false); setSalvando(false); setEditando(null); resetForm(); carregar()
  }

  async function excluirEscala(id:string) {
    if (!confirm('Excluir esta escala?')) return
    await supabase.from('escalas').delete().eq('id', id)
    carregar()
  }

  function resetForm() {
    setFormEquipeId('')
    setForm({ person_id:'', title:'', start_time:nowLocalInput(), end_time:nowLocalInput(), location:'', notes:'' })
    setErro(''); setConflito(null)
  }

  function abrirNovo() { resetForm(); setEditando(null); setModal(true) }

  function abrirEdicao(e:Escala) {
    setEditando(e)
    setFormEquipeId(e.team_id ?? '')
    setForm({ person_id:e.person_id, title:e.title, start_time:new Date(e.start_time).toISOString().slice(0,16), end_time:new Date(e.end_time).toISOString().slice(0,16), location:e.location??'', notes:e.notes??'' })
    setErro(''); setConflito(null); setModal(true)
  }

  function getPessoa(id:string) { return pessoas.find(p => p.id === id) }
  function getEquipe(id:string|null) { return id ? equipes.find(e => e.id === id) : null }

  const mesmodia = (iso:string) => new Date(iso).toDateString() === dataSel.toDateString()
  const escalasDia = escalas.filter(e => {
    if (!mesmodia(e.start_time)) return false
    // Admin vê tudo; lider vê só sua(s) equipe(s)
    if (adminFull || myTeamIds.length === 0) return true
    return e.team_id ? myTeamIds.includes(e.team_id) : false
  })

  // Equipe selecionada atual (para exibir no PersonSelect de equipe)
  const equipeAtual = equipes.find(e => e.id === formEquipeId)

  return (
    <div className="page">
      <SubTabs group="equipes"/>
      {/* Navegação por data */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',background:'white',borderRadius:14,padding:'12px 16px',marginBottom:14,boxShadow:'var(--shadow-sm)'}}>
        <button onClick={()=>{const d=new Date(dataSel);d.setDate(d.getDate()-1);setDataSel(d)}} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:8,width:36,height:36,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontFamily:'inherit'}}>
          <span className="icon icon-sm">chevron_left</span>
        </button>
        <div style={{textAlign:'center'}}>
          <p style={{fontWeight:700,fontSize:15}}>{dataSel.toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'})}</p>
          {dataSel.toDateString() !== hoje.toDateString() && (
            <button onClick={()=>setDataSel(new Date(hoje))} style={{background:'none',border:'none',color:'var(--primary)',fontSize:12,cursor:'pointer',fontFamily:'inherit',fontWeight:500}}>Hoje</button>
          )}
        </div>
        <button onClick={()=>{const d=new Date(dataSel);d.setDate(d.getDate()+1);setDataSel(d)}} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:8,width:36,height:36,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontFamily:'inherit'}}>
          <span className="icon icon-sm">chevron_right</span>
        </button>
      </div>

      {escalasDia.length>0 && (
        <button className="btn btn-outline btn-full btn-sm mb-3" onClick={()=>setImprimir(true)}>
          <span className="icon icon-sm">print</span> Imprimir escala do dia
        </button>
      )}

      {loading ? [1,2,3].map(i=><div key={i} className="skeleton" style={{height:68,marginBottom:8,borderRadius:14}}/>) :
      escalasDia.length === 0 ? (
        <div className="empty">
          <div className="empty-icon"><span className="icon" style={{color:'var(--muted-light)'}}>checklist</span></div>
          <p className="empty-title">Nenhuma escala</p>
          <p className="empty-desc">Nenhuma escala para este dia.</p>
        </div>
      ) : escalasDia.map(e => {
        const p  = getPessoa(e.person_id)
        const eq = getEquipe(e.team_id)
        return (
          <div key={e.id} style={{background:'white',borderRadius:14,boxShadow:'var(--shadow-sm)',marginBottom:8,display:'flex',alignItems:'center',gap:0,overflow:'hidden'}}>
            <div style={{width:4,background:eq?.color??'var(--primary)',alignSelf:'stretch',flexShrink:0}}/>
            <div style={{display:'flex',alignItems:'center',gap:12,flex:1,padding:'12px 14px'}}>
              <div style={{width:40,height:40,borderRadius:'50%',background:'var(--primary)',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',flexShrink:0}}>
                {p?.photo_url ? <img src={p.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/> : <span style={{fontSize:14,fontWeight:700,color:'white'}}>{getInitials(p?.name??'?')}</span>}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <p style={{fontSize:11,color:eq?.color??'var(--primary)',fontWeight:700,marginBottom:1}}>{fmtHora(e.start_time)} — {fmtHora(e.end_time)}{eq?` · ${eq.name}`:''}</p>
                <p style={{fontWeight:700,fontSize:14}}>{p?.name}</p>
                <p style={{fontSize:12,color:'var(--muted)'}}>{e.title}{e.location?` · ${e.location}`:''}</p>
              </div>
            </div>
            {canEdit && (
              <div style={{display:'flex',gap:6,padding:'0 12px',flexShrink:0}}>
                <button onClick={()=>abrirEdicao(e)} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:6,padding:'5px 8px',cursor:'pointer',fontFamily:'inherit',fontSize:12}}>Editar</button>
                <button onClick={()=>excluirEscala(e.id)} style={{background:'var(--danger-bg)',color:'var(--danger)',border:'none',borderRadius:6,padding:'5px 8px',cursor:'pointer',fontFamily:'inherit',fontSize:12}}>Excluir</button>
              </div>
            )}
          </div>
        )
      })}

      {canEdit && <button className="fab" onClick={abrirNovo}><span className="icon">add</span></button>}

      {/* ===== IMPRESSÃO — escala do dia (reflete a tela) ===== */}
      {imprimir && (
        <PrintOverlay titulo={`Escala — ${dataSel.toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'})}`} onClose={()=>setImprimir(false)}>
          {escalasDia.length===0
            ? <p style={{fontSize:13,color:'#6b7280'}}>Nenhuma escala neste dia.</p>
            : escalasDia.map(e=>{
                const p = getPessoa(e.person_id); const eq = getEquipe(e.team_id)
                return (
                  <div key={e.id} style={{display:'flex',alignItems:'center',gap:12,border:'1px solid #e5e7eb',borderRadius:8,overflow:'hidden',marginBottom:8,breakInside:'avoid'}}>
                    <div style={{width:5,alignSelf:'stretch',background:eq?.color??'#00A99D',flexShrink:0}}/>
                    <div style={{width:42,height:42,borderRadius:'50%',overflow:'hidden',flexShrink:0,background:'#f3f4f6',display:'flex',alignItems:'center',justifyContent:'center',margin:'8px 0'}}>
                      {p?.photo_url?<img src={p.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontWeight:700,color:'#6b7280',fontSize:14}}>{getInitials(p?.name??'?')}</span>}
                    </div>
                    <div style={{flex:1,minWidth:0,padding:'8px 12px 8px 0'}}>
                      <p style={{fontSize:11,fontWeight:700,color:eq?.color??'#00A99D'}}>{fmtHora(e.start_time)} — {fmtHora(e.end_time)}{eq?` · ${eq.name}`:''}</p>
                      <p style={{fontWeight:700,fontSize:14}}>{p?.name}</p>
                      <p style={{fontSize:12,color:'#6b7280'}}>{e.title}{e.location?` · ${e.location}`:''}</p>
                    </div>
                  </div>
                )
              })}
        </PrintOverlay>
      )}

      {modal && canEdit && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'8px 20px 32px',maxHeight:'92vh',overflowY:'auto'}}>
            <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 0'}}/>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 0 14px',borderBottom:'1px solid var(--border)',marginBottom:20}}>
              <span style={{fontSize:17,fontWeight:700}}>{editando?'Editar escala':'Nova escala'}</span>
              <button onClick={()=>setModal(false)} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:'50%',width:32,height:32,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}><span className="icon icon-sm">close</span></button>
            </div>
            {erro && <div className="alert-box alert-error mb-3">{erro}</div>}
            {conflito && <div className="alert-box alert-warning mb-3"><strong>Conflito de horário:</strong> {conflito}</div>}
            <form onSubmit={salvar}>

              {/* 1. Equipe - usando mesmo padrão de PersonSelect */}
              <div className="form-group">
                <label className="form-label">1. Equipe</label>
                <div style={{position:'relative'}}>
                  {/* Dropdown de equipes no mesmo estilo de PersonSelect */}
                  <EquipeSelect
                    equipes={equipesDisponiveis}
                    value={formEquipeId}
                    onChange={(id)=>{ setFormEquipeId(id); setForm(f=>({...f,person_id:''})) }}
                  />
                </div>
                {formEquipeId && <p className="form-hint mt-1">{pessoasDaEquipe.length} pessoa(s) nesta equipe</p>}
              </div>

              {/* 2. Pessoa filtrada pela equipe */}
              <div className="form-group">
                <PersonSelect
                  label="2. Pessoa"
                  required
                  pessoas={pessoasDaEquipe}
                  value={form.person_id}
                  onChange={id=>setForm(f=>({...f,person_id:id}))}
                  placeholder={formEquipeId ? `Buscar em ${equipeAtual?.name??'equipe'}...` : 'Buscar pessoa...'}
                />
              </div>

              {/* 3. Local dos locais cadastrados */}
              <div className="form-group">
                <label className="form-label">3. Local</label>
                <Seletor titulo="Local" placeholder="Selecionar local..."
                  value={form.location} onChange={v=>setForm(f=>({...f,location:v}))}
                  opcoes={[{value:'',label:'Sem local'}, ...locais.map(l=>({value:l.nome, label:l.nome}))]}/>
              </div>

              {/* 4. Horário */}
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">4. Início <span className="req">*</span></label>
                  <input className="form-input" type="datetime-local" value={form.start_time} onChange={e=>setForm(f=>({...f,start_time:e.target.value}))} required min={(evento as any)?.start_date ? `${(evento as any).start_date}T00:00` : undefined} max={(evento as any)?.end_date ? `${(evento as any).end_date}T23:59` : undefined}/>
                </div>
                <div className="form-group">
                  <label className="form-label">Fim <span className="req">*</span></label>
                  <input className="form-input" type="datetime-local" value={form.end_time} onChange={e=>setForm(f=>({...f,end_time:e.target.value}))} required min={(evento as any)?.start_date ? `${(evento as any).start_date}T00:00` : undefined} max={(evento as any)?.end_date ? `${(evento as any).end_date}T23:59` : undefined}/>
                </div>
              </div>

              {/* 5. Atividade */}
              <div className="form-group">
                <label className="form-label">5. Atividade <span className="req">*</span></label>
                <input className="form-input" placeholder="Ex: Recepção, Louvor, Apoio na cozinha..." value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} required/>
              </div>

              {/* 6. Descrição */}
              <div className="form-group">
                <label className="form-label">6. Descrição</label>
                <textarea className="form-textarea" placeholder="Detalhes adicionais..." value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} style={{minHeight:70}}/>
              </div>

              <button type="submit" className="btn btn-primary btn-full" disabled={salvando}>
                {salvando?'Verificando e salvando...':editando?'Salvar':'Criar escala'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// Componente EquipeSelect - mesmo padrão visual do PersonSelect
function EquipeSelect({ equipes, value, onChange }: { equipes:{id:string;name:string;color:string}[]; value:string; onChange:(id:string)=>void }) {
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca]   = useState('')
  const ref = useState<HTMLDivElement|null>(null)

  const selecionada = equipes.find(e => e.id === value)
  const filtradas   = equipes.filter(e => !busca || e.name.toLowerCase().includes(busca.toLowerCase()))

  // Close on outside click
  useEffect(() => {
    function handler(ev:MouseEvent) {
      const el = document.getElementById('equipe-select-dropdown')
      if (el && !el.contains(ev.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div id="equipe-select-dropdown" style={{position:'relative'}}>
      <button type="button" onClick={()=>setAberto(!aberto)} style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'10px 14px',borderRadius:10,cursor:'pointer',border:`1.5px solid ${aberto?'var(--primary)':'var(--border)'}`,background:aberto?'white':'var(--bg)',fontFamily:'inherit',transition:'border-color 0.15s',boxShadow:aberto?'0 0 0 3px rgba(0,169,157,0.12)':'none'}}>
        {selecionada ? (
          <>
            <div style={{width:30,height:30,borderRadius:8,background:selecionada.color,flexShrink:0}}/>
            <span style={{flex:1,fontSize:14,fontWeight:500,color:'var(--text)',textAlign:'left'}}>{selecionada.name}</span>
            <button type="button" onClick={e=>{e.stopPropagation();onChange('');setAberto(false)}} style={{background:'none',border:'none',cursor:'pointer',color:'var(--muted-light)',padding:0,fontFamily:'inherit'}}>
              <span className="icon icon-sm">close</span>
            </button>
          </>
        ) : (
          <>
            <span className="icon icon-sm" style={{color:'var(--muted-light)'}}>shield</span>
            <span style={{flex:1,fontSize:14,color:'var(--muted-light)',textAlign:'left'}}>Todas as equipes</span>
            <span className="icon icon-sm" style={{color:'var(--muted-light)'}}>expand_more</span>
          </>
        )}
      </button>
      {aberto && (
        <div style={{position:'absolute',top:'calc(100% + 4px)',left:0,right:0,background:'white',border:'1.5px solid var(--border)',borderRadius:12,boxShadow:'0 8px 24px rgba(0,0,0,0.12)',zIndex:500,overflow:'hidden'}}>
          <div style={{padding:'10px 12px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:8}}>
            <span className="icon icon-sm" style={{color:'var(--muted-light)'}}>search</span>
            <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar equipe..." style={{border:'none',outline:'none',fontSize:14,color:'var(--text)',background:'transparent',width:'100%',fontFamily:'inherit'}}/>
          </div>
          <div style={{maxHeight:200,overflowY:'auto'}}>
            <button type="button" onClick={()=>{onChange('');setAberto(false);setBusca('')}} style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'10px 14px',background:!value?'var(--primary-light)':'none',border:'none',cursor:'pointer',fontFamily:'inherit',textAlign:'left'}}>
              <div style={{width:30,height:30,borderRadius:8,background:'var(--bg)',border:'1px solid var(--border)',flexShrink:0}}/>
              <span style={{fontSize:13,color:!value?'var(--primary-dark)':'var(--muted)'}}>Todas as equipes</span>
              {!value && <span className="icon icon-sm" style={{color:'var(--primary)',marginLeft:'auto'}}>check</span>}
            </button>
            {filtradas.map(eq=>(
              <button key={eq.id} type="button" onClick={()=>{onChange(eq.id);setAberto(false);setBusca('')}} style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'10px 14px',background:value===eq.id?'var(--primary-light)':'none',border:'none',borderBottom:'1px solid var(--border)',cursor:'pointer',fontFamily:'inherit',textAlign:'left'}}>
                <div style={{width:30,height:30,borderRadius:8,background:eq.color,flexShrink:0}}/>
                <span style={{fontSize:14,fontWeight:value===eq.id?700:400,color:value===eq.id?'var(--primary-dark)':'var(--text)'}}>{eq.name}</span>
                {value===eq.id && <span className="icon icon-sm" style={{color:'var(--primary)',marginLeft:'auto'}}>check</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
