import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import SubTabs from '../components/SubTabs'
import PersonSelect from '../components/PersonSelect'
import { useEvento } from '../hooks/useEvento'
import type { Profile } from '../App'

type Perm   = { id:string; role:string|null; person_id:string|null; modulo:string; acao:string; permitido:boolean }
type Pessoa = { id:string; name:string; photo_url:string|null }

const CARGOS = [
  {role:'admin',              label:'Administrador'},
  {role:'financeiro',         label:'Financeiro'},
  {role:'coordenador',        label:'Ministrante'},
  {role:'lider',              label:'Líder Correio'},
  {role:'lider_cozinha',      label:'Líder Cozinha'},
  {role:'lider_enfermaria',   label:'Líder Enfermaria'},
  {role:'lider_financeiro',   label:'Líder Financeiro'},
  {role:'lider_intercessao',  label:'Líder Intercessão'},
  {role:'lider_limpeza',      label:'Líder Limpeza'},
  {role:'lider_logistica',    label:'Líder Logística'},
  {role:'lider_manutencao',   label:'Líder Manutenção'},
  {role:'lider_recepcao',     label:'Líder Recepção'},
  {role:'lider_som',          label:'Líder Som e Equipamentos'},
  {role:'lider_teatro',       label:'Líder Teatro'},
  {role:'lider_vision',       label:'Líder Vision / Mídia Digital'},
  {role:'encontreiro',        label:'Encontreiro'},
  {role:'aprovado',           label:'Aprovado'},
  {role:'visitante',          label:'Visitante'},
]

const MODULOS = [
  // Visualização geral
  {key:'cronograma',      label:'Cronograma',          grupo:'Geral'},
  {key:'encontristas',    label:'Encontristas',         grupo:'Geral'},
  {key:'cadastros',       label:'Cadastros',            grupo:'Geral'},
  {key:'ministracoes',    label:'Ministrações',         grupo:'Geral'},
  {key:'ranking',         label:'Ranking / Votação',    grupo:'Geral'},
  // Equipes - cada líder só vê a sua
  {key:'equipes',         label:'Equipes (ver)',         grupo:'Equipes'},
  {key:'equipes_editar',  label:'Equipes (editar)',      grupo:'Equipes'},
  {key:'escalas',         label:'Escalas (ver)',         grupo:'Equipes'},
  {key:'escalas_criar',   label:'Escalas (criar/editar)',grupo:'Equipes'},
  {key:'escalas_excluir', label:'Escalas (excluir)',    grupo:'Equipes'},
  // Teatro
  {key:'teatro',          label:'Teatro (ver)',          grupo:'Teatro'},
  {key:'teatro_editar',   label:'Teatro (editar)',       grupo:'Teatro'},
  // Alertas - líder só envia para sua equipe
  {key:'alertas',         label:'Alertas (ver)',         grupo:'Comunicação'},
  {key:'alertas_criar',   label:'Alertas (criar)',       grupo:'Comunicação'},
  {key:'alertas_criticos',label:'Alertas críticos',      grupo:'Comunicação'},
  {key:'ocorrencias',     label:'Ocorrências',          grupo:'Comunicação'},
  // Saúde - restrito
  {key:'saude',           label:'Saúde (ver)',           grupo:'Saúde'},
  {key:'saude_fichas',    label:'Fichas médicas',        grupo:'Saúde'},
  {key:'medicamentos',    label:'Medicamentos',          grupo:'Saúde'},
  // Financeiro - muito restrito
  {key:'financeiro',      label:'Financeiro (ver)',      grupo:'Financeiro'},
  {key:'financeiro_editar',label:'Financeiro (editar)', grupo:'Financeiro'},
  {key:'doacoes',         label:'Doações',              grupo:'Financeiro'},
  {key:'relatorios',      label:'Relatórios',           grupo:'Financeiro'},
  // Admin
  {key:'admin',           label:'Administração',        grupo:'Admin'},
  {key:'admin_menus',     label:'Gerenciar menus',      grupo:'Admin'},
  {key:'admin_permissoes',label:'Gerenciar permissões', grupo:'Admin'},
]

const ACOES = ['ver','criar','editar','excluir']

const GRUPOS = [...new Set(MODULOS.map(m=>m.grupo))]

export default function PermissoesAdmin({ profile }: { profile?: Profile }) {
  const { evento, loading: evLoading } = useEvento()
  const [permissoes, setPermissoes] = useState<Perm[]>([])
  const [pessoas, setPessoas]       = useState<Pessoa[]>([])
  const [loading, setLoading]       = useState(true)
  const [aba, setAba]               = useState<'roles'|'pessoas'>('roles')
  const [roleSel, setRoleSel]       = useState('encontreiro')
  const [personSel, setPersonSel]   = useState('')
  const [salvando, setSalvando]     = useState(false)
  const [grupoAberto, setGrupoAberto] = useState<string|null>('Geral')

  useEffect(() => { carregar() }, [evento])

  async function carregar() {
    setLoading(true)
    const [pe, pm] = await Promise.all([
      evento ? supabase.from('people').select('id,name,photo_url').eq('event_id',evento.id).order('name') : Promise.resolve({data:[]}),
      supabase.from('permissoes').select('*'),
    ])
    setPessoas((pe as any).data ?? [])
    setPermissoes(pm.data ?? [])
    setLoading(false)
  }

  function getPerm(role:string|null, personId:string|null, modulo:string, acao:string): boolean|null {
    const p = permissoes.find(p=>
      p.modulo===modulo && p.acao===acao &&
      (role ? p.role===role && !p.person_id : p.person_id===personId && !p.role)
    )
    return p ? p.permitido : null
  }

  async function togglePerm(role:string|null, personId:string|null, modulo:string, acao:string) {
    setSalvando(true)
    const atual = getPerm(role, personId, modulo, acao)
    const existing = permissoes.find(p=>
      p.modulo===modulo && p.acao===acao &&
      (role ? p.role===role && !p.person_id : p.person_id===personId && !p.role)
    )
    if (atual === null) {
      const {data} = await supabase.from('permissoes').insert({role:role??null,person_id:personId??null,modulo,acao,permitido:true}).select().single()
      if (data) setPermissoes(prev=>[...prev,data])
    } else if (atual === true && existing) {
      await supabase.from('permissoes').update({permitido:false}).eq('id',existing.id)
      setPermissoes(prev=>prev.map(p=>p.id===existing.id?{...p,permitido:false}:p))
    } else if (existing) {
      await supabase.from('permissoes').delete().eq('id',existing.id)
      setPermissoes(prev=>prev.filter(p=>p.id!==existing.id))
    }
    setSalvando(false)
  }

  function CellPerm({ role, personId, modulo, acao }: { role:string|null; personId:string|null; modulo:string; acao:string }) {
    const val = getPerm(role, personId, modulo, acao)
    return (
      <button type="button" onClick={()=>togglePerm(role,personId,modulo,acao)}
        title={val===true?'Permitido → clique para bloquear':val===false?'Bloqueado → clique para remover':'Herda padrão → clique para permitir'}
        style={{width:30,height:30,borderRadius:6,border:`1.5px solid ${val===true?'var(--success)':val===false?'var(--danger)':'var(--border)'}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontFamily:'inherit',background:val===true?'var(--success-bg)':val===false?'var(--danger-bg)':'var(--bg)'}}>
        {val===true && <span className="icon" style={{fontSize:14,color:'var(--success)'}}>check</span>}
        {val===false && <span className="icon" style={{fontSize:14,color:'var(--danger)'}}>block</span>}
        {val===null && <span style={{fontSize:10,color:'var(--muted)'}}>—</span>}
      </button>
    )
  }

  const pessoa = pessoas.find(p=>p.id===personSel)

  return (
    <div className="page">
      <SubTabs group="admin"/>
      <div className="alert-box alert-info mb-3" style={{fontSize:12}}>
        <strong>✓</strong> Permitido &nbsp;·&nbsp; <strong>✗</strong> Bloqueado &nbsp;·&nbsp; <strong>—</strong> Herda padrão do cargo<br/>
        Permissão individual sempre sobrescreve a do cargo.
      </div>

      <div className="tabs mb-3">
        <button className={`tab ${aba==='roles'?'active':''}`} onClick={()=>setAba('roles')}>Por Cargo</button>
        <button className={`tab ${aba==='pessoas'?'active':''}`} onClick={()=>setAba('pessoas')}>Por Pessoa</button>
      </div>

      {aba==='roles' && (
        <>
          <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:16}}>
            {CARGOS.map(cg=>(
              <button key={cg.role} onClick={()=>setRoleSel(cg.role)}
                style={{padding:'6px 12px',borderRadius:20,cursor:'pointer',fontFamily:'inherit',fontSize:11,fontWeight:600,border:`2px solid ${roleSel===cg.role?'var(--primary)':'var(--border)'}`,background:roleSel===cg.role?'var(--primary-light)':'white',color:roleSel===cg.role?'var(--primary-dark)':'var(--text2)'}}>
                {cg.label}
              </button>
            ))}
          </div>

          {loading ? <div className="skeleton" style={{height:200,borderRadius:14}}/> : (
            <div>
              {GRUPOS.map(grupo=>(
                <div key={grupo} style={{marginBottom:8}}>
                  <button type="button" onClick={()=>setGrupoAberto(grupoAberto===grupo?null:grupo)}
                    style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',background:'var(--bg)',border:'1px solid var(--border)',borderRadius:grupoAberto===grupo?'10px 10px 0 0':10,cursor:'pointer',fontFamily:'inherit',fontWeight:700,fontSize:13}}>
                    {grupo}
                    <span className="icon icon-sm">{grupoAberto===grupo?'expand_less':'expand_more'}</span>
                  </button>
                  {grupoAberto===grupo && (
                    <div style={{background:'white',border:'1px solid var(--border)',borderTop:'none',borderRadius:'0 0 10px 10px',overflow:'auto'}}>
                      <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                        <thead>
                          <tr style={{background:'var(--bg)'}}>
                            <th style={{padding:'8px 14px',textAlign:'left',fontWeight:700,fontSize:12,whiteSpace:'nowrap'}}>Módulo</th>
                            {ACOES.map(a=><th key={a} style={{padding:'8px 6px',fontWeight:700,fontSize:10,textTransform:'uppercase',color:'var(--muted)',textAlign:'center',minWidth:36}}>{a}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {MODULOS.filter(m=>m.grupo===grupo).map(m=>(
                            <tr key={m.key} style={{borderTop:'1px solid var(--border)'}}>
                              <td style={{padding:'7px 14px',fontWeight:500,fontSize:12,whiteSpace:'nowrap'}}>{m.label}</td>
                              {ACOES.map(a=>(
                                <td key={a} style={{padding:'5px 6px',textAlign:'center'}}>
                                  <CellPerm role={roleSel} personId={null} modulo={m.key} acao={a}/>
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {aba==='pessoas' && (
        <>
          <div className="form-group mb-4">
            <PersonSelect label="Selecionar pessoa" pessoas={pessoas} value={personSel} onChange={setPersonSel} placeholder="Buscar pessoa..."/>
          </div>
          {personSel && (
            <>
              <div style={{background:'var(--primary-light)',borderRadius:12,padding:'10px 14px',marginBottom:16,display:'flex',alignItems:'center',gap:10}}>
                <div style={{width:36,height:36,borderRadius:'50%',background:'var(--primary)',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',flexShrink:0}}>
                  {pessoa?.photo_url?<img src={pessoa.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:13,fontWeight:700,color:'white'}}>{pessoa?.name.slice(0,2).toUpperCase()}</span>}
                </div>
                <p style={{fontWeight:700,fontSize:14,color:'var(--primary-dark)'}}>{pessoa?.name} — permissões individuais</p>
              </div>
              <div>
                {GRUPOS.map(grupo=>(
                  <div key={grupo} style={{marginBottom:8}}>
                    <button type="button" onClick={()=>setGrupoAberto(grupoAberto===grupo?null:grupo)}
                      style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',background:'var(--bg)',border:'1px solid var(--border)',borderRadius:grupoAberto===grupo?'10px 10px 0 0':10,cursor:'pointer',fontFamily:'inherit',fontWeight:700,fontSize:13}}>
                      {grupo}
                      <span className="icon icon-sm">{grupoAberto===grupo?'expand_less':'expand_more'}</span>
                    </button>
                    {grupoAberto===grupo && (
                      <div style={{background:'white',border:'1px solid var(--border)',borderTop:'none',borderRadius:'0 0 10px 10px',overflow:'auto'}}>
                        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                          <thead>
                            <tr style={{background:'var(--bg)'}}>
                              <th style={{padding:'8px 14px',textAlign:'left',fontWeight:700,fontSize:12}}>Módulo</th>
                              {ACOES.map(a=><th key={a} style={{padding:'8px 6px',fontWeight:700,fontSize:10,textTransform:'uppercase',color:'var(--muted)',textAlign:'center',minWidth:36}}>{a}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {MODULOS.filter(m=>m.grupo===grupo).map(m=>(
                              <tr key={m.key} style={{borderTop:'1px solid var(--border)'}}>
                                <td style={{padding:'7px 14px',fontWeight:500,fontSize:12}}>{m.label}</td>
                                {ACOES.map(a=>(
                                  <td key={a} style={{padding:'5px 6px',textAlign:'center'}}>
                                    <CellPerm role={null} personId={personSel} modulo={m.key} acao={a}/>
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
