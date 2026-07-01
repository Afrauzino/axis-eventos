import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import SubTabs from '../components/SubTabs'
import { useEvento } from '../hooks/useEvento'
import type { Profile } from '../App'

export default function Relatorios({ profile }: { profile?: Profile }) {
  const { evento, loading: evLoading } = useEvento()
  const [stats, setStats]   = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [exportando, setExportando] = useState('')

  useEffect(() => { if (evLoading) return; if (!evento) { setLoading(false); return }; carregar() }, [evento, evLoading])

  async function carregar() {
    if (!evento) return
    setLoading(true)
    const [enc, trb, eq, al, oc, pa, te] = await Promise.all([
      supabase.from('people').select('id,name,church,sexo,status,birth_date,cidade').eq('event_id',evento.id).eq('role_type','encounterer').order('name'),
      supabase.from('people').select('id,name,church,sexo').eq('event_id',evento.id).eq('role_type','worker').order('name'),
      supabase.from('teams').select('id,name').eq('event_id',evento.id).order('name'),
      supabase.from('alerts').select('id',{count:'exact',head:true}).eq('event_id',evento.id),
      supabase.from('occurrences').select('id',{count:'exact',head:true}).eq('event_id',evento.id),
      supabase.from('financeiro').select('valor,status').eq('event_id',evento.id),
      supabase.from('theaters').select('id,nome').eq('event_id',evento.id),
    ])
    setStats({ enc:enc.data??[], trb:trb.data??[], eq:eq.data??[], oc:oc.count??0, pa:pa.data??[], te:te.data??[] })
    setLoading(false)
  }

  function exportarCSV(data: any[], nome: string) {
    if (!data.length) return
    const keys = Object.keys(data[0])
    const csv  = [keys.join(','), ...data.map(r=>keys.map(k=>JSON.stringify(r[k]??'')).join(','))].join('\n')
    const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'})
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href=url; a.download=`${nome}-${new Date().toISOString().slice(0,10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  function exportarJSON(data: any, nome: string) {
    const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'})
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href=url; a.download=`${nome}-${new Date().toISOString().slice(0,10)}.json`; a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <div className="page">{[1,2,3].map(i=><div key={i} className="skeleton" style={{height:70,marginBottom:10,borderRadius:14}}/>)}</div>
  if (!stats) return null

  const totalPago    = stats.pa.filter((p:any)=>p.status==='pago').reduce((s:number,p:any)=>s+p.valor,0)
  const totalPendente= stats.pa.filter((p:any)=>p.status==='pendente').reduce((s:number,p:any)=>s+p.valor,0)

  const relatorios = [
    { label:'Lista de Encontristas', desc:`${stats.enc.length} registros`, icon:'group', data:stats.enc, nome:'encontristas' },
    { label:'Lista de Encontreiros', desc:`${stats.trb.length} registros`, icon:'groups', data:stats.trb, nome:'encontreiros' },
    { label:'Lista de Equipes',      desc:`${stats.eq.length} equipes`,    icon:'shield', data:stats.eq, nome:'equipes' },
    { label:'Teatros',               desc:`${stats.te.length} teatros`,    icon:'theater_comedy', data:stats.te, nome:'teatros' },
    { label:'Relatorio Financeiro',  desc:`R$ ${totalPago.toFixed(2)} pagos · R$ ${totalPendente.toFixed(2)} pendentes`, icon:'account_balance_wallet', data:stats.pa, nome:'financeiro' },
  ]

  return (
    <div className="page">
      <SubTabs group="admin"/>
      <div className="stats-grid mb-4">
        <div className="stat-card"><div className="stat-label">Encontristas</div><div className="stat-value">{stats.enc.length}</div></div>
        <div className="stat-card"><div className="stat-label">Encontreiros</div><div className="stat-value">{stats.trb.length}</div></div>
        <div className="stat-card"><div className="stat-label">Ocorrencias</div><div className="stat-value" style={{color:'var(--danger)'}}>{stats.oc}</div></div>
        <div className="stat-card"><div className="stat-label">Arrecadado</div><div className="stat-value" style={{fontSize:18,color:'var(--success)'}}>R$ {totalPago.toFixed(0)}</div></div>
      </div>

      <div className="section-label mb-3">Exportar relatorios</div>

      {relatorios.map(r=>(
        <div key={r.nome} style={{background:'white',borderRadius:14,boxShadow:'var(--shadow-sm)',marginBottom:8,padding:'14px 16px',display:'flex',alignItems:'center',gap:12}}>
          <div style={{width:44,height:44,borderRadius:12,background:'var(--primary-light)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <span className="icon" style={{color:'var(--primary)'}}>{r.icon}</span>
          </div>
          <div style={{flex:1}}>
            <p style={{fontWeight:700,fontSize:14,marginBottom:2}}>{r.label}</p>
            <p style={{fontSize:12,color:'var(--muted)'}}>{r.desc}</p>
          </div>
          <div style={{display:'flex',gap:6}}>
            <button className="btn btn-sm btn-outline" onClick={()=>exportarCSV(r.data,r.nome)}>CSV</button>
            <button className="btn btn-sm btn-ghost" onClick={()=>exportarJSON(r.data,r.nome)}>JSON</button>
          </div>
        </div>
      ))}

      <div style={{marginTop:20}}>
        <div className="section-label mb-3">Exportar tudo</div>
        <button className="btn btn-primary btn-full" onClick={()=>exportarJSON({evento,encontristas:stats.enc,encontreiros:stats.trb,equipes:stats.eq,financeiro:stats.pa,teatros:stats.te,exportado_em:new Date().toISOString()},'backup-completo')}>
          <span className="icon icon-sm">download</span> Exportar backup completo (JSON)
        </button>
      </div>
    </div>
  )
}
