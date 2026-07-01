import PersonSelect from '../components/PersonSelect'
import { useEffect, useState } from 'react'
import AvatarPicker from '../components/AvatarPicker'
import { supabase } from '../lib/supabase'
import SubTabs from '../components/SubTabs'
import { getInitials, isAdmin, formatName } from '../utils'
import { useEvento } from '../hooks/useEvento'
import type { Profile } from '../App'

type Equipe  = { id:string; name:string; color:string; leader_id:string|null; co_leader_id:string|null; equipe_saude:boolean; equipe_cardapio?:boolean }
type Pessoa  = { id:string; name:string; role_type:string; photo_url:string|null; user_id:string|null }
type Vinculo = { person_id:string; team_id:string }

const CORES = ['#00A99D','#E8821A','#6B46C1','#2F855A','#D53F8C','#2B6CB0','#C05621','#1A202C','#C53030','#D69E2E']

export default function Equipes({ profile }: { profile?: Profile }) {
  const { evento, loading: evLoading } = useEvento()
  const [equipes, setEquipes]   = useState<Equipe[]>([])
  const [pessoas, setPessoas]   = useState<Pessoa[]>([])
  const [vinculos, setVinculos] = useState<Vinculo[]>([])
  const [loading, setLoading]   = useState(true)
  const [expandida, setExpandida] = useState<string|null>(null)
  const [modal, setModal]       = useState(false)
  const [editando, setEditando] = useState<Equipe|null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro]         = useState('')
  const [form, setForm] = useState({ name:'', color:'#00A99D', leader_id:'', co_leader_id:'', equipe_saude:false, equipe_cardapio:false, emoji:'', foto_url:null })

  // Modal de adicionar membro — multipla selecao
  const [modalMembro, setModalMembro] = useState<string|null>(null) // team_id
  const [pessoasSel, setPessoasSel]   = useState<string[]>([])

  const canEdit = profile && isAdmin(profile.user_role)

  useEffect(() => { if (evLoading) return; if (!evento) { setLoading(false); return }; setLoading(true); carregar() }, [evento, evLoading])

  async function carregar() {
    if (!evento) return
    const [eq, pe, vi] = await Promise.all([
      supabase.from('teams').select('*').eq('event_id', evento.id).order('name'),
      supabase.from('people').select('id,name,role_type,photo_url,user_id').eq('event_id', evento.id).eq('role_type','worker').not('user_id','is',null).order('name'),
      supabase.from('people_teams').select('person_id,team_id'),
    ])
    setEquipes(eq.data ?? [])
    setPessoas(pe.data ?? [])
    setVinculos(vi.data ?? [])
    setLoading(false)
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setErro(''); setSalvando(true)
    if (!evento || !form.name.trim()) { setErro('Nome obrigatorio.'); setSalvando(false); return }
    const payload = { name:formatName(form.name), color:form.color, leader_id:form.leader_id||null, co_leader_id:form.co_leader_id||null, equipe_saude:form.equipe_saude, equipe_cardapio:form.equipe_cardapio, emoji:form.emoji||null, foto_url:(form as any).foto_url||null }
    let err
    if (editando) { const r=await supabase.from('teams').update(payload).eq('id',editando.id); err=r.error }
    else { const r=await supabase.from('teams').insert({...payload,event_id:evento.id}); err=r.error }
    if (err) { setErro('Erro: '+err.message); setSalvando(false); return }

    // Promover lider automaticamente + adicionar como MEMBRO da equipe
    if (!err && (editando || true)) {
      // descobrir o id da equipe (recém-criada ou editada)
      let teamId = editando?.id
      if (!teamId) {
        const { data: nova } = await supabase.from('teams')
          .select('id').eq('name', formatName(form.name)).eq('event_id', evento?.id)
          .order('created_at',{ascending:false}).limit(1).maybeSingle()
        teamId = nova?.id
      }
      for (const lid of [form.leader_id, form.co_leader_id]) {
        if (!lid) continue
        const p = pessoas.find(x=>x.id===lid)
        if (p?.user_id) {
          await supabase.from('profiles').update({user_role:'lider'}).eq('user_id',p.user_id).in('user_role',['aprovado','encontreiro'])
        }
        // adiciona o líder como membro da equipe (se ainda não for)
        if (teamId) {
          const { data: jaTem } = await supabase.from('people_teams')
            .select('id').eq('person_id', lid).eq('team_id', teamId).maybeSingle()
          if (!jaTem) await supabase.from('people_teams').insert({ person_id: lid, team_id: teamId })
        }
      }
    }

    setModal(false); setSalvando(false); setEditando(null)
    setForm({name:'',color:'#00A99D',leader_id:'',co_leader_id:'',equipe_saude:false,equipe_cardapio:false,emoji:'',foto_url:null})
    carregar()
  }

  async function excluir(id: string) {
    if (!confirm('Remover esta equipe? Os membros nao serao excluidos.')) return
    await supabase.from('teams').delete().eq('id',id)
    setExpandida(null); carregar()
  }

  async function excluirEquipe(id: string) {
    if (!confirm('Excluir esta equipe? Os membros não serão excluídos, apenas desvinculados.')) return
    await supabase.from('people_teams').delete().eq('team_id', id)
    await supabase.from('teams').delete().eq('id', id)
    setExpandida(null); carregar()
  }

  async function adicionarMembros() {
    if (!pessoasSel.length || !modalMembro) return
    const novos = pessoasSel
      .filter(id => !vinculos.some(v=>v.person_id===id && v.team_id===modalMembro))
      .map(id => ({ person_id:id, team_id:modalMembro! }))
    if (novos.length > 0) await supabase.from('people_teams').insert(novos)
    setPessoasSel([])
    setModalMembro(null)
    carregar()
  }

  function togglePessoa(id: string) {
    setPessoasSel(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id])
  }

  async function removerMembro(personId: string, teamId: string) {
    await supabase.from('people_teams').delete().eq('person_id',personId).eq('team_id',teamId)
    carregar()
  }

  function getMembros(teamId: string) {
    const ids = vinculos.filter(v=>v.team_id===teamId).map(v=>v.person_id)
    return pessoas.filter(p=>ids.includes(p.id))
  }

  function getEquipesDaPessoa(personId: string) {
    const ids = vinculos.filter(v=>v.person_id===personId).map(v=>v.team_id)
    return equipes.filter(e=>ids.includes(e.id))
  }

  const totalVinculados = new Set(vinculos.map(v=>v.person_id)).size
  const semEquipe = pessoas.filter(p=>!vinculos.some(v=>v.person_id===p.id))

  return (
    <div className="page">
      <SubTabs group="equipes"/>
      <div className="stats-grid mb-4">
        <div className="stat-card"><div className="stat-label">Equipes</div><div className="stat-value">{equipes.length}</div></div>
        <div className="stat-card">
          <div className="stat-label">Sem equipe</div>
          <div className="stat-value" style={{color:semEquipe.length>0?'var(--warning)':'var(--success)'}}>{semEquipe.length}</div>
        </div>
      </div>

      {semEquipe.length>0 && <div className="alert-box alert-warning mb-3">{semEquipe.length} encontreiro(s) sem equipe.</div>}

      {loading ? [1,2,3].map(i=><div key={i} className="skeleton" style={{height:72,marginBottom:8,borderRadius:14}}/>) :
      equipes.length===0 ? (
        <div className="empty">
          <div className="empty-icon"><span className="icon" style={{color:'var(--muted-light)'}}>shield</span></div>
          <p className="empty-title">Nenhuma equipe</p>
          <p className="empty-desc">Crie as equipes para organizar os encontreiros.</p>
          {canEdit && <button className="btn btn-primary btn-sm" onClick={()=>setModal(true)}>Criar primeira equipe</button>}
        </div>
      ) : equipes.map(eq=>{
        const membros  = getMembros(eq.id)
        const lider    = pessoas.find(p=>p.id===eq.leader_id)
        const colider  = pessoas.find(p=>p.id===eq.co_leader_id)
        const aberta   = expandida===eq.id

        return (
          <div key={eq.id} style={{background:'white',borderRadius:12,boxShadow:'0 1px 5px rgba(0,0,0,0.12)',marginBottom:10,overflow:'hidden',display:'flex'}}>
            <div style={{width:6,alignSelf:'stretch',background:eq.color,flexShrink:0}}/>
            <div style={{flex:1,minWidth:0}}>
            {/* Cabecalho */}
            <button style={{width:'100%',display:'flex',alignItems:'center',gap:14,padding:'16px 15px',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',textAlign:'left'}}
              onClick={()=>setExpandida(aberta?null:eq.id)}>
              <div style={{width:58,height:58,borderRadius:'50%',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',background:(eq as any).foto_url?'#eee':eq.color+'24'}}>
                {(eq as any).foto_url
                  ? <img src={(eq as any).foto_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                  : <span style={{fontSize:27}}>{(eq as any).emoji||'👥'}</span>}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <p style={{fontWeight:700,fontSize:15,marginBottom:2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{eq.name}</p>
                <p style={{fontSize:12,color:'var(--muted)'}}>{membros.length} {membros.length===1?'membro':'membros'}{lider?` · Lider: ${lider.name.split(' ')[0]}`:''}{eq.equipe_saude?' · Saude':''}</p>
              </div>
              {canEdit && (
                <button onClick={e=>{e.stopPropagation();setEditando(eq);setForm({name:eq.name,color:eq.color,leader_id:eq.leader_id??'',co_leader_id:eq.co_leader_id??'',equipe_saude:eq.equipe_saude,equipe_cardapio:(eq as any).equipe_cardapio??false,emoji:(eq as any).emoji??'',foto_url:(eq as any).foto_url??null});setErro('');setModal(true)}}
                  style={{width:34,height:34,borderRadius:8,background:'var(--bg)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--muted)',fontFamily:'inherit',flexShrink:0}} aria-label="Editar">
                  <span className="icon icon-sm">edit</span>
                </button>
              )}
              <span className="icon icon-sm" style={{color:'var(--muted-light)',transform:aberta?'rotate(90deg)':'none',transition:'transform 0.2s',flexShrink:0}}>chevron_right</span>
            </button>

            {/* Expandido */}
            {aberta && (
              <div style={{borderTop:'1px solid var(--border)',padding:'14px 16px'}}>
                {/* Lideranca */}
                {(lider||colider) && (
                  <div style={{marginBottom:14}}>
                    <p className="section-label">Lideranca</p>
                    <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
                      {[{p:lider,label:'Lider',cor:'var(--info)'},{p:colider,label:'Co-lider',cor:'var(--muted)'}].filter(x=>x.p).map(({p,label,cor})=>p&&(
                        <div key={p.id} style={{display:'flex',alignItems:'center',gap:8,background:'var(--bg)',borderRadius:99,padding:'6px 12px 6px 6px'}}>
                          <div style={{width:28,height:28,borderRadius:'50%',background:cor,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'white'}}>{getInitials(p.name)}</div>
                          <div><p style={{fontSize:12,fontWeight:700}}>{p.name.split(' ')[0]}</p><p style={{fontSize:10,color:cor}}>{label}</p></div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Membros */}
                <p className="section-label">Membros ({membros.length})</p>
                {membros.length===0 ? (
                  <p style={{fontSize:13,color:'var(--muted)',fontStyle:'italic',marginBottom:12}}>Nenhum membro ainda.</p>
                ) : (
                  <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:14}}>
                    {membros.map(m=>{
                      const outrasEquipes = getEquipesDaPessoa(m.id).filter(e=>e.id!==eq.id)
                      return (
                        <div key={m.id} style={{display:'flex',alignItems:'center',gap:10,background:'var(--bg)',borderRadius:10,padding:'8px 10px'}}>
                          <div style={{width:34,height:34,borderRadius:'50%',background:eq.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:'white',overflow:'hidden',flexShrink:0}}>
                            {m.photo_url?<img src={m.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:getInitials(m.name)}
                          </div>
                          <div style={{flex:1,minWidth:0}}>
                            <p style={{fontSize:13,fontWeight:600}}>{m.name}</p>
                            {outrasEquipes.length>0 && (
                              <p style={{fontSize:11,color:'var(--muted)'}}>Tambem em: {outrasEquipes.map(e=>e.name).join(', ')}</p>
                            )}
                          </div>
                          {canEdit && (
                            <button onClick={()=>removerMembro(m.id,eq.id)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--muted-light)',fontSize:18,padding:'0 4px',fontFamily:'inherit',lineHeight:1}}>×</button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Botao adicionar membro */}
                {canEdit && (
                  <button className="btn btn-outline btn-sm" style={{marginBottom:14}} onClick={()=>{setModalMembro(eq.id);setPessoasSel([])}}>
                    <span className="icon icon-sm">person_add</span> Adicionar membro
                  </button>
                )}

                {canEdit && (
                  <button onClick={()=>excluir(eq.id)} style={{display:'block',background:'var(--danger-bg)',color:'var(--danger)',border:'none',borderRadius:8,padding:'8px 14px',cursor:'pointer',fontSize:13,fontWeight:600,fontFamily:'inherit'}}>
                    Excluir equipe
                  </button>
                )}
              </div>
            )}
            </div>
          </div>
        )
      })}

      {canEdit && <button className="fab" onClick={()=>{setEditando(null);setForm({name:'',color:'#00A99D',leader_id:'',co_leader_id:'',equipe_saude:false,equipe_cardapio:false,emoji:'',foto_url:null});setErro('');setModal(true)}}><span className="icon">add</span></button>}

      {/* Modal criar/editar equipe */}
      {modal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'8px 20px 32px',maxHeight:'92vh',overflowY:'auto'}}>
            <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 0'}}/>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'18px 0 16px',borderBottom:'1px solid var(--border)',marginBottom:20}}>
              <span style={{fontSize:17,fontWeight:700}}>{editando?'Editar equipe':'Nova equipe'}</span>
              <button onClick={()=>setModal(false)} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:'50%',width:32,height:32,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}><span className="icon icon-sm">close</span></button>
            </div>
            {erro && <div className="alert-box alert-error mb-3">{erro}</div>}
            <form onSubmit={salvar}>
              <div className="form-group"><label className="form-label">Nome da equipe <span className="req">*</span></label>
                <input className="form-input" placeholder="Ex: Equipe Cozinha" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Capa da equipe (emoji ou foto)</label>
                <AvatarPicker
                  emoji={form.emoji}
                  fotoUrl={(form as any).foto_url ?? null}
                  cor={form.color}
                  bucket="team-photos"
                  path={'team-'+(editando?.id ?? 'novo')}
                  onChangeEmoji={(em)=>setForm(f=>({...f,emoji:em, foto_url:null} as any))}
                  onChangeFoto={(url)=>setForm(f=>({...f,foto_url:url, emoji:url?'':f.emoji} as any))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Cor</label>
                <div style={{display:'flex',gap:8,flexWrap:'wrap',paddingTop:4}}>
                  {CORES.map(c=><button key={c} type="button" onClick={()=>setForm(f=>({...f,color:c}))} style={{width:34,height:34,borderRadius:8,background:c,border:'none',cursor:'pointer',boxShadow:form.color===c?`0 0 0 3px white, 0 0 0 5px ${c}`:'none',transition:'box-shadow 0.15s'}}/>)}
                </div>
              </div>
              <div className="form-group">
                <PersonSelect label="Lider" pessoas={pessoas} value={form.leader_id} onChange={id=>setForm(f=>({...f,leader_id:id}))} placeholder="Buscar lider..."/>
                <p className="form-hint mt-1">Ao selecionar, recebe permissoes de lider automaticamente.</p>
              </div>
              <div className="form-group">
                <PersonSelect label="Co-lider" pessoas={pessoas} value={form.co_leader_id} onChange={id=>setForm(f=>({...f,co_leader_id:id}))} placeholder="Buscar co-lider..."/>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:12,padding:'12px 0',marginBottom:4}}>
                <input type="checkbox" id="saude" checked={form.equipe_saude} onChange={e=>setForm(f=>({...f,equipe_saude:e.target.checked}))} style={{width:18,height:18,cursor:'pointer',accentColor:'var(--primary)'}}/>
                <label htmlFor="saude" style={{fontSize:14,fontWeight:500,cursor:'pointer'}}>Esta e a equipe de saude</label>
              </div>
              <p className="form-hint mb-4">Membros da equipe de saude tem acesso ao modulo de saude.</p>
              <div style={{display:'flex',alignItems:'center',gap:12,padding:'12px 0',marginBottom:4}}>
                <input type="checkbox" id="cardapio" checked={form.equipe_cardapio} onChange={e=>setForm(f=>({...f,equipe_cardapio:e.target.checked}))} style={{width:18,height:18,cursor:'pointer',accentColor:'var(--primary)'}}/>
                <label htmlFor="cardapio" style={{fontSize:14,fontWeight:500,cursor:'pointer'}}>Esta e a equipe de cardapios (cozinha)</label>
              </div>
              <p className="form-hint mb-4">Membros recebem os cardapios do dia em Minhas Atividades.</p>
              <button type="submit" className="btn btn-primary btn-full" disabled={salvando}>
                {salvando?'Salvando...':editando?'Salvar alteracoes':'Criar equipe'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal adicionar membro */}
      {modalMembro && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={e=>e.target===e.currentTarget&&setModalMembro(null)}>
          <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'8px 20px 32px',maxHeight:'70vh',overflowY:'auto'}}>
            <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 0'}}/>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'18px 0 16px',borderBottom:'1px solid var(--border)',marginBottom:16}}>
              <span style={{fontSize:17,fontWeight:700}}>Adicionar membro</span>
              <button onClick={()=>setModalMembro(null)} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:'50%',width:32,height:32,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}><span className="icon icon-sm">close</span></button>
            </div>
            <p className="form-hint mb-3">Uma pessoa pode pertencer a multiplas equipes. O sistema controla conflitos de horario nas escalas.</p>

            {/* Lista de pessoas para selecionar */}
            <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:16}}>
              {[...pessoas].sort((a,b)=>{ const aEq=vinculos.some(v=>v.person_id===a.id); const bEq=vinculos.some(v=>v.person_id===b.id); if(!aEq&&bEq) return -1; if(aEq&&!bEq) return 1; return 0 }).map(p=>{
                const jaMembro = vinculos.some(v=>v.person_id===p.id && v.team_id===modalMembro)
                const equipesDela = getEquipesDaPessoa(p.id)
                return (
                  <button key={p.id} onClick={()=>!jaMembro&&togglePessoa(p.id)}
                    style={{display:'flex',alignItems:'center',gap:12,padding:'10px 12px',borderRadius:10,border:`2px solid ${pessoasSel.includes(p.id)?'var(--primary)':jaMembro?'var(--border)':'var(--border)'}`,background:jaMembro?'var(--bg)':pessoasSel.includes(p.id)?'var(--primary-light)':'white',cursor:jaMembro?'default':'pointer',fontFamily:'inherit',textAlign:'left',opacity:jaMembro?0.5:1,transition:'all 0.12s'}}>
                    <div style={{width:36,height:36,borderRadius:'50%',background:'var(--primary)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:'white',flexShrink:0}}>
                      {getInitials(p.name)}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <p style={{fontSize:13,fontWeight:equipesDela.length===0&&!jaMembro?700:600,color:equipesDela.length===0&&!jaMembro?'var(--danger)':'var(--text)'}}>{p.name}</p>
                      {equipesDela.length===0&&!jaMembro && <p style={{fontSize:11,color:'var(--danger)',fontWeight:700}}>Sem equipe</p>}
                      {equipesDela.length>0 && <p style={{fontSize:11,color:'var(--muted)'}}>{equipesDela.map(e=>e.name).join(', ')}</p>}
                      {jaMembro && <p style={{fontSize:11,color:'var(--primary)',fontWeight:600}}>Já é membro</p>}
                    </div>
                    {pessoasSel.includes(p.id) && <span className="icon icon-sm" style={{color:'var(--primary)',flexShrink:0}}>check_circle</span>}
                  </button>
                )
              })}
            </div>

            <button className="btn btn-primary btn-full" disabled={!pessoasSel.length} onClick={adicionarMembros}>
              <span className="icon icon-sm">person_add</span>
              {pessoasSel.length > 0 ? `Adicionar ${pessoasSel.length} pessoa(s)` : 'Selecione as pessoas'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
