import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type Item = {
  id:string; titulo:string; hora_inicio:string; hora_fim:string
  duracao_minutos?:number|null; cron_iniciado_em?:string|null
  cron_ajuste_segundos?:number|null; cron_estado?:string|null
}

function duracaoSegundos(item: Item): number {
  if (item.duracao_minutos && item.duracao_minutos>0) return item.duracao_minutos*60
  const ini = new Date(item.hora_inicio).getTime()
  const fim = new Date(item.hora_fim).getTime()
  const diff = Math.round((fim-ini)/1000)
  return diff>0 ? diff : 0
}
function fmt(seg:number): string {
  const s = Math.max(0, seg)
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60
  const p = (n:number)=>String(n).padStart(2,'0')
  return h>0 ? `${p(h)}:${p(m)}:${p(sec)}` : `${p(m)}:${p(sec)}`
}

export default function CronometroInline({ item, podeControlar }: { item:Item; podeControlar:boolean }) {
  const [estado, setEstado] = useState(item.cron_estado ?? 'parado')
  const [iniciadoEm, setIniciadoEm] = useState<string|null>(item.cron_iniciado_em ?? null)
  const [ajuste, setAjuste] = useState(item.cron_ajuste_segundos ?? 0)
  const [agora, setAgora] = useState(Date.now())

  const totalSeg = duracaoSegundos(item) + ajuste

  useEffect(() => {
    if (estado!=='correndo') return
    const t = setInterval(()=>setAgora(Date.now()), 1000)
    return () => clearInterval(t)
  }, [estado])

  let decorrido = 0
  if (iniciadoEm) decorrido = Math.floor((agora - new Date(iniciadoEm).getTime())/1000)
  const restante = Math.max(0, totalSeg - decorrido)
  const pct = totalSeg>0 ? Math.min(100, Math.round((decorrido/totalSeg)*100)) : 0
  const zerou = estado==='correndo' && restante<=0

  async function salvar(campos:any){ await supabase.from('cronograma_eventos').update(campos).eq('id', item.id) }
  async function iniciar(e:any){ e.stopPropagation(); const ini=new Date().toISOString(); setIniciadoEm(ini); setEstado('correndo'); setAgora(Date.now()); await salvar({cron_iniciado_em:ini,cron_estado:'correndo',cron_ajuste_segundos:ajuste}) }
  async function pausar(e:any){ e.stopPropagation(); setEstado('parado'); await salvar({cron_estado:'parado'}) }
  async function ajustar(e:any,delta:number){ e.stopPropagation(); const novo=ajuste+delta; setAjuste(novo); await salvar({cron_ajuste_segundos:novo}) }
  async function encerrar(e:any){ e.stopPropagation(); setEstado('encerrado'); await salvar({cron_estado:'encerrado'}) }

  const cor = zerou ? '#E53E3E' : 'var(--primary)'
  const rodando = estado==='correndo'

  if (estado==='encerrado') return (
    <div onClick={e=>e.stopPropagation()} style={{marginTop:10,padding:'8px 10px',background:'var(--bg)',borderRadius:8,fontSize:11,color:'var(--muted)',fontWeight:600,textAlign:'center'}}>✓ Bloco encerrado</div>
  )

  return (
    <div onClick={e=>e.stopPropagation()} style={{marginTop:10,paddingTop:10,borderTop:'1px solid var(--border)'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
        <span style={{fontSize:12,color:'var(--muted)',fontWeight:600}}>{rodando?'Restante':'Duração'}: <strong style={{color:cor,fontVariantNumeric:'tabular-nums'}}>{fmt(rodando?restante:totalSeg)}</strong></span>
        <span style={{fontSize:13,fontWeight:800,color:cor}}>{pct}%</span>
      </div>
      {/* barra longa estilo financeiro */}
      <div style={{height:12,background:'var(--bg)',borderRadius:99,overflow:'hidden',marginBottom:8,border:'1px solid var(--border)'}}>
        <div style={{height:'100%',width:`${pct}%`,background:cor,borderRadius:99,transition:'width 1s linear'}}/>
      </div>

      {zerou && <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:8}}><div style={{width:12,height:12,borderRadius:'50%',background:'#E53E3E',animation:'pulse 1s infinite'}}/><span style={{fontSize:11,color:'#E53E3E',fontWeight:700}}>Tempo esgotado</span></div>}

      {podeControlar && (
        <div style={{display:'flex',gap:6}}>
          {!rodando
            ? <button onClick={iniciar} style={{flex:1,padding:'8px',borderRadius:8,border:'none',background:'var(--primary)',color:'white',cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:4}}><span className="icon" style={{fontSize:16,color:'white'}}>play_arrow</span>Iniciar</button>
            : <button onClick={pausar} style={{flex:1,padding:'8px',borderRadius:8,border:'1px solid var(--border)',background:'white',cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:'inherit'}}>Pausar</button>
          }
          <button onClick={e=>ajustar(e,-60)} style={{padding:'8px 12px',borderRadius:8,border:'1px solid var(--border)',background:'white',cursor:'pointer',fontSize:14,fontWeight:800,fontFamily:'inherit'}}>−</button>
          <button onClick={e=>ajustar(e,60)} style={{padding:'8px 12px',borderRadius:8,border:'1px solid var(--border)',background:'white',cursor:'pointer',fontSize:14,fontWeight:800,fontFamily:'inherit'}}>+</button>
          {rodando && <button onClick={encerrar} style={{padding:'8px 10px',borderRadius:8,border:'1px solid var(--border)',background:'white',color:'var(--danger)',cursor:'pointer',fontSize:11,fontWeight:700,fontFamily:'inherit'}}>Encerrar</button>}
        </div>
      )}
    </div>
  )
}
