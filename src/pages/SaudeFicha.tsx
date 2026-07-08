import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useVoltarFecha } from '../hooks/useVoltarFecha'
import { useRegistrarChromeNav } from '../lib/chrome'
import FichaMedica from '../components/FichaMedica'
import CardItem from '../components/CardItem'
import FotoAmpliada from '../components/FotoAmpliada'
import { getInitials } from '../utils'
import { useEvento } from '../hooks/useEvento'
import type { Profile } from '../App'

type Ficha = {
  id:string; person_id:string
  diabetes:boolean; hipertensao:boolean; cardiopatia:boolean; epilepsia:boolean; ansiedade:boolean
  tipo_sanguineo:string|null; plano_saude:string|null
  alergias:string|null; medicamentos:string|null; restricoes_alimentares:string|null
  medico_nome:string|null; medico_tel:string|null
  contato_emergencia_nome:string|null; contato_emergencia_telefone:string|null
  observacoes:string|null
  medicamento_controlado:string|null
  med_controlado_como:string|null
  med_controlado_horario:string|null
}
type Pessoa = { id:string; name:string; photo_url:string|null }

export default function SaudeFicha({ profile }: { profile?: Profile }) {
  const { evento, loading: evLoading } = useEvento()
  const [fichas, setFichas]     = useState<Ficha[]>([])
  const [pessoas, setPessoas]   = useState<Pessoa[]>([])
  const [loading, setLoading]   = useState(true)
  const [filtro, setFiltro]     = useState<'todos'|'com'|'sem'>('todos')
  const [busca, setBusca]       = useState('')
  const [aberta, setAberta]     = useState<Pessoa|null>(null)
  useVoltarFecha(!!aberta, () => setAberta(null))
  const [fotoAmpliada, setFotoAmpliada] = useState<string|null>(null)

  useEffect(() => { if (evLoading) return; if (!evento) { setLoading(false); return }; carregar() }, [evento, evLoading])

  async function carregar() {
    if (!evento) return
    setLoading(true)
    const [fi, pe] = await Promise.all([
      supabase.from('saude_fichas').select('*').eq('event_id',evento.id),
      supabase.from('people').select('id,name,photo_url').eq('event_id',evento.id).order('name'),
    ])
    setFichas(fi.data??[])
    setPessoas(pe.data??[])
    setLoading(false)
  }

  function getPessoa(id:string) { return pessoas.find(p=>p.id===id) }
  const comFicha  = fichas.map(f=>f.person_id)
  const semFicha  = pessoas.filter(p=>!comFicha.includes(p.id))

  // Filtro + busca
  const listagem = (() => {
    let base = filtro==='sem' ? semFicha : filtro==='com' ? fichas.map(f=>getPessoa(f.person_id)).filter(Boolean) as Pessoa[] : pessoas
    if (busca) base = base.filter(p=>p.name.toLowerCase().includes(busca.toLowerCase()))
    return base
  })()

  function flagsFicha(f:any): string[] {
    if (!f) return []
    const flags:string[] = []
    if (f.restricao_alimentar ?? f.restricoes_alimentares) flags.push('Restrição alimentar')
    if (f.alergia_medicamentos ?? f.alergias) flags.push('Alergia a medicamentos')
    if (f.toma_controlado ?? f.medicamento_controlado) flags.push('💊')
    return flags
  }
  function badgePessoa(pid:string) {
    const f = fichas.find(x=>x.person_id===pid)
    if (!f) return <span className="badge badge-warning" style={{fontSize:10}}>Sem ficha</span>
    const fl = flagsFicha(f)
    return fl.length > 0
      ? <span className="badge badge-danger" style={{fontSize:10}}>{fl.length===1?fl[0]:`${fl.length} alertas`}</span>
      : <span className="badge badge-success" style={{fontSize:10}}>Ok</span>
  }

  useRegistrarChromeNav('saude', {
    busca: { value: busca, onChange: setBusca, placeholder: 'Buscar pessoa...' },
    grupos: [{ chave:'ficha', label:'Ficha', opcoes:[{value:'todos',label:'Todos'},{value:'com',label:'Com ficha'},{value:'sem',label:'Sem ficha'}] }],
    valores: { ficha: filtro },
    onFiltro: (_,v)=>setFiltro(v as any),
  }, [busca, filtro])

  return (
    <div className="page">
      {loading ? [1,2,3].map(i=><div key={i} className="skeleton" style={{height:68,marginBottom:8,borderRadius:14}}/>) :
      listagem.map(p => {
        const f = fichas.find(x=>x.person_id===p.id)
        const fl = flagsFicha(f)
        return (
        <CardItem
          key={p.id}
          cor="var(--primary)"
          ehPessoa
          fotoUrl={p.photo_url}
          iniciais={getInitials(p.name)}
          titulo={p.name}
          subtitulo={!f ? 'Sem ficha' : fl.length ? fl.join(' · ') : 'Sem alertas'}
          direita={badgePessoa(p.id)}
          onVer={()=>setAberta(p)}
          onFoto={()=>p.photo_url && setFotoAmpliada(p.photo_url)}
        />
        )
      })}

      <FotoAmpliada url={fotoAmpliada} onClose={()=>setFotoAmpliada(null)} />

      {/* Ficha médica (componente reutilizável, fonte única) */}
      {aberta && evento && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',flexDirection:'column',justifyContent:'flex-end'}} onClick={e=>e.target===e.currentTarget&&setAberta(null)}>
          <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'8px 20px 28px',maxHeight:'92vh',overflowY:'auto'}}>
            <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'12px auto 16px'}}/>
            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16}}>
              <div style={{width:52,height:52,borderRadius:'50%',background:'var(--primary-light)',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',flexShrink:0}}>
                {aberta.photo_url?<img src={aberta.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:18,fontWeight:700,color:'var(--primary)'}}>{getInitials(aberta.name)}</span>}
              </div>
              <p style={{flex:1,fontSize:17,fontWeight:700}}>{aberta.name}</p>
              <button onClick={()=>setAberta(null)} style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:'50%',width:32,height:32,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}><span className="icon icon-sm">close</span></button>
            </div>
            <FichaMedica personId={aberta.id} eventId={evento.id} startOpen onSaved={()=>{ carregar(); setAberta(null) }}/>
            <button className="btn btn-ghost btn-full" onClick={()=>setAberta(null)}>Fechar</button>
          </div>
        </div>
      )}

    </div>
  )
}
