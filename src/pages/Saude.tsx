import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useVoltarFecha } from '../hooks/useVoltarFecha'
import MenuSaude from '../components/MenuSaude'
import { getInitials, fmtDataHora } from '../utils'
import { useEvento } from '../hooks/useEvento'
import PersonSelect from '../components/PersonSelect'
import CardItem from '../components/CardItem'
import type { Profile } from '../App'
import { usePermissao } from '../hooks/usePermissao'

type Atendimento = { id:string; person_id:string; medicine_name:string; reason:string|null; timestamp:string }
type Pessoa = { id:string; name:string; photo_url:string|null }

const TIPOS = ['Medicamento','Atendimento geral','Pressão arterial','Glicemia','Curativo','Febre','Outro']

export default function Saude({ profile }: { profile?: Profile }) {
  const { evento, loading: evLoading } = useEvento()
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([])
  const [pessoas, setPessoas]           = useState<Pessoa[]>([])
  const [loading, setLoading]           = useState(true)
  const [modal, setModal]               = useState(false)
  useVoltarFecha(modal, () => setModal(false))
  const [salvando, setSalvando]         = useState(false)
  const [form, setForm] = useState({ person_id:'', descricao:'', tipo:'Atendimento geral' })

  useEffect(() => { if (evLoading) return; if (!evento) { setLoading(false); return }; carregar() }, [evento, evLoading])

  async function carregar() {
    if (!evento) return
    setLoading(true)
    const [at, pe] = await Promise.all([
      supabase.from('medications').select('*').eq('event_id',evento.id).neq('reason','agendado').order('timestamp',{ascending:false}).limit(50),
      supabase.from('people').select('id,name,photo_url').eq('event_id',evento.id).order('name'),
    ])
    setAtendimentos(at.data??[])
    setPessoas(pe.data??[])
    setLoading(false)
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setSalvando(true)
    if (!evento||!form.person_id||!form.descricao) { setSalvando(false); return }
    const { data: user } = await supabase.auth.getUser()
    await supabase.from('medications').insert({
      person_id: form.person_id, event_id: evento.id,
      medicine_name: form.descricao, reason: form.tipo,
      timestamp: new Date().toISOString(),
    })
    setModal(false); setSalvando(false)
    setForm({person_id:'',descricao:'',tipo:'Atendimento geral'}); carregar()
  }

  function getPessoa(id: string) { return pessoas.find(p=>p.id===id) }


  return (
    <div className="page">
      <MenuSaude />
      <div className="section-title">Atendimentos recentes</div>

      {loading ? [1,2,3].map(i=><div key={i} className="skeleton" style={{height:68,marginBottom:8,borderRadius:14}}/>) :
      atendimentos.length===0 ? (
        <div className="empty">
          <div className="empty-icon"><span className="icon" style={{color:'var(--muted-light)'}}>medical_services</span></div>
          <p className="empty-title">Nenhum atendimento</p>
          <p className="empty-desc">Registre os atendimentos médicos do evento.</p>
        </div>
      ) : atendimentos.map(a => {
        const p = getPessoa(a.person_id)
        return (
          <CardItem
            key={a.id}
            cor="var(--primary)"
            ehPessoa
            fotoUrl={p?.photo_url}
            iniciais={getInitials(p?.name??'?')}
            titulo={p?.name ?? '—'}
            subtitulo={`${a.medicine_name}${a.reason?` · ${a.reason}`:''}`}
            direita={<span style={{fontSize:11,fontWeight:700,color:'var(--primary)',whiteSpace:'nowrap'}}>{fmtDataHora(a.timestamp)}</span>}
          />
        )
      })}

      <button className="fab" onClick={()=>setModal(true)}><span className="icon">add</span></button>

      {modal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'8px 20px 32px',maxHeight:'92vh',overflowY:'auto'}}>
            <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 0'}}/>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'18px 0 16px',borderBottom:'1px solid var(--border)',marginBottom:20}}>
              <span style={{fontSize:17,fontWeight:700}}>Registrar atendimento</span>
              <button onClick={()=>setModal(false)} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:'50%',width:32,height:32,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}><span className="icon icon-sm">close</span></button>
            </div>
            <p style={{fontSize:12,color:'var(--muted)',marginBottom:16}}>Data e hora registradas automaticamente.</p>
            <form onSubmit={salvar}>
              <div className="form-group">
                <PersonSelect label="Pessoa" required pessoas={pessoas} value={form.person_id} onChange={id=>setForm(f=>({...f,person_id:id}))} placeholder="Buscar pessoa..."/>
              </div>
              <div className="form-group">
                <label className="form-label">Tipo</label>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginTop:4}}>
                  {TIPOS.map(t=>(
                    <button key={t} type="button" onClick={()=>setForm(f=>({...f,tipo:t}))} style={{padding:'8px 10px',borderRadius:8,cursor:'pointer',fontSize:12,fontWeight:600,fontFamily:'inherit',border:`2px solid ${form.tipo===t?'var(--primary)':'var(--border)'}`,background:form.tipo===t?'var(--primary-light)':'white',color:form.tipo===t?'var(--primary-dark)':'var(--text2)',textAlign:'left'}}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Descricao <span className="req">*</span></label>
                <textarea className="form-textarea" value={form.descricao} onChange={e=>setForm(f=>({...f,descricao:e.target.value}))} required placeholder="Descreva o atendimento..." style={{minHeight:80}}/>
              </div>
              <button type="submit" className="btn btn-primary btn-full" disabled={salvando}>
                {salvando?'Registrando...':'Registrar'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
