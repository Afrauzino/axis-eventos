import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRegistrarChromeNav } from '../lib/chrome'
import { getInitials, isAdmin } from '../utils'
import { useEvento } from '../hooks/useEvento'
import { usePermissao } from '../hooks/usePermissao'
import CardItem from '../components/CardItem'
import FotoAmpliada from '../components/FotoAmpliada'
import PersonSelect from '../components/PersonSelect'
import Seletor from '../components/Seletor'
import type { Profile } from '../App'

type Elenco  = { id:string; theater_id:string; person_id:string; personagem_id:string|null; observacoes:string|null }
type Pessoa  = { id:string; name:string; photo_url:string|null }
type Teatro  = { id:string; nome:string }
type Personagem = { id:string; nome:string }

export default function TeatroAtores({ profile }: { profile?: Profile }) {
  const { evento, loading: evLoading } = useEvento()
  const [elenco, setElenco]       = useState<Elenco[]>([])
  const [fotoAmpliada, setFotoAmpliada] = useState<string|null>(null)
  const [pessoas, setPessoas]     = useState<Pessoa[]>([])
  const [teatros, setTeatros]     = useState<Teatro[]>([])
  const [personagens, setPersonagens] = useState<Personagem[]>([])
  const [loading, setLoading]     = useState(true)
  const [modal, setModal]         = useState(false)
  const [salvando, setSalvando]   = useState(false)
  const [erro, setErro]           = useState('')
  const [form, setForm] = useState({ theater_id:'', person_id:'', personagem_id:'', observacoes:'' })

  const { pode } = usePermissao(profile ?? null)
  const canEdit = (!!profile && isAdmin(profile.user_role)) || pode('teatro','editar')

  useEffect(() => { if (evLoading) return; if (!evento) { setLoading(false); return }; carregar() }, [evento, evLoading])

  async function carregar() {
    if (!evento) return
    setLoading(true)
    const [el, pe, te, pg] = await Promise.all([
      supabase.from('teatro_elenco').select('*'),
      supabase.from('people').select('id,name,photo_url').eq('event_id',evento.id).order('name'),
      supabase.from('theaters').select('id,nome').eq('event_id',evento.id).order('nome'),
      supabase.from('personagens_globais').select('*').order('nome'),
    ])
    setElenco(el.data??[])
    setPessoas(pe.data??[])
    setTeatros(te.data??[])
    setPersonagens(pg.data??[])
    setLoading(false)
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setErro(''); setSalvando(true)
    if (!form.theater_id || !form.person_id) { setErro('Teatro e ator sao obrigatorios.'); setSalvando(false); return }
    const { error } = await supabase.from('teatro_elenco').insert({ theater_id:form.theater_id, person_id:form.person_id, personagem_id:form.personagem_id||null, observacoes:form.observacoes||null })
    if (error) { setErro('Erro: '+error.message); setSalvando(false); return }
    setModal(false); setSalvando(false)
    setForm({theater_id:'',person_id:'',personagem_id:'',observacoes:''}); carregar()
  }

  async function remover(id: string) {
    if (!confirm('Remover ator deste teatro?')) return
    await supabase.from('teatro_elenco').delete().eq('id',id)
    carregar()
  }

  function getPessoa(id: string) { return pessoas.find(p=>p.id===id) }
  function getTeatro(id: string) { return teatros.find(t=>t.id===id) }
  function getPersonagem(id: string|null) { return id ? personagens.find(p=>p.id===id) : null }

  useRegistrarChromeNav('teatro')

  return (
    <div className="page">
      {loading ? [1,2,3].map(i=><div key={i} className="skeleton" style={{height:68,marginBottom:8,borderRadius:14}}/>) :
      elenco.length===0 ? (
        <div className="empty">
          <div className="empty-icon"><span className="icon" style={{color:'var(--muted-light)'}}>person_play</span></div>
          <p className="empty-title">Nenhum ator escalado</p>
          <p className="empty-desc">Escale atores para os teatros do evento.</p>
        </div>
      ) : elenco.map(e => {
        const p = getPessoa(e.person_id)
        const t = getTeatro(e.theater_id)
        const pg = getPersonagem(e.personagem_id)
        return (
          <CardItem
            key={e.id}
            cor="var(--primary)"
            ehPessoa
            fotoUrl={p?.photo_url ?? null}
            iniciais={getInitials(p?.name??'?')}
            titulo={p?.name ?? '—'}
            subtitulo={`${t?.nome??''}${pg?` · ${pg.nome}`:''}${e.observacoes?` · ${e.observacoes}`:''}`}
            direita={canEdit ? (
              <button onClick={()=>remover(e.id)} aria-label="Remover" title="Remover ator" style={{width:34,height:34,borderRadius:8,background:'var(--danger-bg)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}>
                <span className="icon icon-sm" style={{color:'var(--danger)'}}>delete</span>
              </button>
            ) : undefined}
            onFoto={()=>p?.photo_url && setFotoAmpliada(p.photo_url)}
          />
        )
      })}

      {canEdit && <button className="fab" onClick={()=>{setForm({theater_id:'',person_id:'',personagem_id:'',observacoes:''});setErro('');setModal(true)}}><span className="icon">add</span></button>}

      {modal && canEdit && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'8px 20px 32px',maxHeight:'92vh',overflowY:'auto'}}>
            <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 0'}}/>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'18px 0 16px',borderBottom:'1px solid var(--border)',marginBottom:20}}>
              <span style={{fontSize:17,fontWeight:700}}>Escalar ator</span>
              <button onClick={()=>setModal(false)} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:'50%',width:32,height:32,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}><span className="icon icon-sm">close</span></button>
            </div>
            {erro && <div className="alert-box alert-error mb-3">{erro}</div>}
            <form onSubmit={salvar}>
              <div className="form-group"><label className="form-label">Teatro <span className="req">*</span></label>
                <Seletor titulo="Selecionar teatro" placeholder="Selecionar teatro" value={form.theater_id} onChange={v=>setForm(f=>({...f,theater_id:v}))}
                  opcoes={teatros.map(t=>({value:t.id,label:t.nome}))}/>
              </div>
              <div className="form-group">
                <PersonSelect label="Ator" required pessoas={pessoas} value={form.person_id} onChange={id=>setForm(f=>({...f,person_id:id}))} placeholder="Buscar ator..."/>
              </div>
              <div className="form-group"><label className="form-label">Personagem</label>
                <Seletor titulo="Personagem" placeholder="Sem personagem" value={form.personagem_id} onChange={v=>setForm(f=>({...f,personagem_id:v}))}
                  opcoes={[{value:'',label:'Sem personagem'}, ...personagens.map(p=>({value:p.id,label:p.nome}))]}/>
              </div>
              <div className="form-group"><label className="form-label">Observacoes</label>
                <input className="form-input" value={form.observacoes} onChange={e=>setForm(f=>({...f,observacoes:e.target.value}))} placeholder="Ex: Narrador, figurino especial..."/>
              </div>
              <button type="submit" className="btn btn-primary btn-full" disabled={salvando}>
                {salvando?'Salvando...':'Escalar ator'}
              </button>
            </form>
          </div>
        </div>
      )}
      <FotoAmpliada url={fotoAmpliada} onClose={()=>setFotoAmpliada(null)} />
    </div>
  )
}
