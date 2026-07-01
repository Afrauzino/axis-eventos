import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import SubTabs from '../components/SubTabs'
import { isAdmin } from '../utils'
import type { Profile } from '../App'

type Limites = {
  limite_arquivos_gb: number
  limite_uso_mensal: number
  limite_usuarios: number
  uso_mensal_atual: number
}

export default function SaudeSistema({ profile }: { profile?: Profile }) {
  const [limites, setLimites] = useState<Limites>({ limite_arquivos_gb:4, limite_uso_mensal:100, limite_usuarios:100, uso_mensal_atual:0 })
  const [arquivosGb, setArquivosGb] = useState(0)
  const [usuariosAtivos, setUsuariosAtivos] = useState(0)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [ok, setOk] = useState('')

  const admin = isAdmin(profile?.user_role) || profile?.is_admin

  useEffect(() => { if (admin) carregar() }, [])

  async function carregar() {
    setLoading(true)
    // Limites manuais
    const { data: lim } = await supabase.from('saude_sistema_limites').select('*').eq('id',1).maybeSingle()
    if (lim) setLimites(lim)

    // MEDIÇÃO REAL — Espaço de arquivos: soma tamanho dos arquivos registrados
    let totalBytes = 0
    const [corr, mods] = await Promise.all([
      supabase.from('correio_arquivos').select('tamanho'),
      supabase.from('arquivos_modulo').select('tamanho'),
    ])
    ;(corr.data ?? []).forEach(a => totalBytes += (a.tamanho ?? 0))
    ;(mods.data ?? []).forEach(a => totalBytes += (a.tamanho ?? 0))
    setArquivosGb(totalBytes / (1024*1024*1024))

    // MEDIÇÃO REAL — Pessoas usando: usuários com conta (user_id preenchido)
    const { count } = await supabase.from('people').select('id',{count:'exact',head:true}).not('user_id','is',null)
    setUsuariosAtivos(count ?? 0)

    setLoading(false)
  }

  async function salvarLimites() {
    setSalvando(true); setOk('')
    await supabase.from('saude_sistema_limites').update({
      limite_arquivos_gb: limites.limite_arquivos_gb,
      limite_uso_mensal: limites.limite_uso_mensal,
      limite_usuarios: limites.limite_usuarios,
      uso_mensal_atual: limites.uso_mensal_atual,
      updated_at: new Date().toISOString(),
    }).eq('id',1)
    setSalvando(false); setOk('Limites salvos!')
    setTimeout(()=>setOk(''), 2500)
  }

  if (!admin) return <div className="page"><div className="empty"><p className="empty-title">Acesso restrito</p><p className="empty-sub">Apenas administradores.</p></div></div>
  if (loading) return <div className="page">{[1,2,3].map(i=><div key={i} className="skeleton" style={{height:90,marginBottom:12,borderRadius:14}}/>)}</div>

  const pctArquivos = limites.limite_arquivos_gb>0 ? Math.round((arquivosGb/limites.limite_arquivos_gb)*100) : 0
  const pctUso      = limites.limite_uso_mensal>0 ? Math.round((limites.uso_mensal_atual/limites.limite_uso_mensal)*100) : 0
  const pctUsuarios = limites.limite_usuarios>0 ? Math.round((usuariosAtivos/limites.limite_usuarios)*100) : 0
  const maiorPct = Math.max(pctArquivos, pctUso, pctUsuarios)
  const statusVerde = maiorPct < 95

  return (
    <div className="page slide-up">
      <SubTabs group="admin"/>
      {/* Status geral */}
      <div style={{background: statusVerde?'var(--success)':'#D69E2E', borderRadius:16, padding:'18px 20px', marginBottom:16, color:'white', boxShadow:'0 4px 14px rgba(0,0,0,0.15)'}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <span className="icon" style={{fontSize:32,color:'white'}}>{statusVerde?'check_circle':'warning'}</span>
          <div>
            <p style={{fontSize:16,fontWeight:800}}>{statusVerde?'Sistema saudável':'Atenção: próximo do limite'}</p>
            <p style={{fontSize:12,opacity:0.9}}>{statusVerde?'Tudo funcionando com folga.':'Ainda está seguro, mas perto do limite. Nada foi bloqueado.'}</p>
          </div>
        </div>
      </div>

      <Medidor titulo="Espaço de Arquivos" descricao={`${arquivosGb.toFixed(2)} GB de ${limites.limite_arquivos_gb} GB`} pct={pctArquivos} />
      <Medidor titulo="Uso do Sistema no Mês" descricao={`${limites.uso_mensal_atual} de ${limites.limite_uso_mensal} (${pctUso}%)`} pct={pctUso} />
      <Medidor titulo="Pessoas Usando o App" descricao={`${usuariosAtivos} de ${limites.limite_usuarios} permitidos`} pct={pctUsuarios} />

      {/* Configurar limites manuais */}
      <div style={{background:'white',borderRadius:14,padding:'16px 18px',marginTop:8,boxShadow:'var(--shadow-sm)'}}>
        <p style={{fontSize:13,fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:6}}>Definir limites</p>
        <p style={{fontSize:11,color:'var(--muted)',marginBottom:14}}>Veja os limites no painel do Supabase e digite aqui. O sistema mede o uso real automaticamente.</p>

        <Campo label="Limite de arquivos (GB)" value={limites.limite_arquivos_gb} onChange={v=>setLimites(l=>({...l,limite_arquivos_gb:v}))} />
        <Campo label="Limite de uso mensal" value={limites.limite_uso_mensal} onChange={v=>setLimites(l=>({...l,limite_uso_mensal:v}))} />
        <Campo label="Uso mensal atual (do painel)" value={limites.uso_mensal_atual} onChange={v=>setLimites(l=>({...l,uso_mensal_atual:v}))} />
        <Campo label="Limite de usuários" value={limites.limite_usuarios} onChange={v=>setLimites(l=>({...l,limite_usuarios:v}))} />

        <button className="btn btn-primary btn-full" onClick={salvarLimites} disabled={salvando} style={{marginTop:8}}>{salvando?'Salvando...':'Salvar limites'}</button>
        {ok && <p style={{fontSize:12,color:'var(--success)',fontWeight:700,textAlign:'center',marginTop:8}}>{ok}</p>}
      </div>
    </div>
  )
}

function Medidor({ titulo, descricao, pct }: { titulo:string; descricao:string; pct:number }) {
  const alerta = pct >= 95
  const cor = alerta ? '#D69E2E' : 'var(--primary)'
  return (
    <div style={{background:'white',borderRadius:14,padding:'14px 18px',marginBottom:12,boxShadow:'var(--shadow-sm)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
        <p style={{fontSize:14,fontWeight:700}}>{titulo}</p>
        <p style={{fontSize:15,fontWeight:800,color:cor}}>{pct}%</p>
      </div>
      <div style={{height:12,background:'var(--bg)',borderRadius:99,overflow:'hidden',marginBottom:6}}>
        <div style={{height:'100%',width:`${Math.min(100,pct)}%`,background:cor,borderRadius:99,transition:'width 0.5s ease'}}/>
      </div>
      <p style={{fontSize:12,color:'var(--muted)'}}>{descricao}</p>
      {alerta && <p style={{fontSize:11,color:'#D69E2E',fontWeight:700,marginTop:4}}>⚠️ Atenção: o sistema ainda está seguro, mas está próximo do limite.</p>}
    </div>
  )
}

function Campo({ label, value, onChange }: { label:string; value:number; onChange:(v:number)=>void }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <input className="form-input" type="number" value={value} onChange={e=>onChange(Number(e.target.value))} />
    </div>
  )
}
