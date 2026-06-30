import { useEffect, useState } from 'react'

type Item = {
  hora_inicio:string; hora_fim:string
  duracao_minutos?:number|null; cron_iniciado_em?:string|null
  cron_ajuste_segundos?:number|null; cron_estado?:string|null; status?:string; cron_decorrido_segundos?:number|null
}

function duracaoBaseSeg(item: Item): number {
  if (item.duracao_minutos && item.duracao_minutos>0) return item.duracao_minutos*60
  const ini = new Date(item.hora_inicio).getTime()
  const fim = new Date(item.hora_fim).getTime()
  const diff = Math.round((fim-ini)/1000)
  return diff>0 ? diff : 0
}
function fmt(seg:number): string {
  const s = Math.max(0, Math.floor(seg))
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60
  const p = (n:number)=>String(n).padStart(2,'0')
  return h>0 ? `${p(h)}:${p(m)}:${p(sec)}` : `${p(m)}:${p(sec)}`
}

// Só EXIBE barra + tempo (sem controles). Visível a todos.
export default function CronometroDisplay({ item }: { item:Item }) {
  const [agora, setAgora] = useState(Date.now())
  const estado = item.cron_estado ?? 'parado'
  const ajuste = item.cron_ajuste_segundos ?? 0
  const totalSeg = duracaoBaseSeg(item) + ajuste

  useEffect(() => {
    if (estado!=='correndo') return
    const t = setInterval(()=>setAgora(Date.now()), 500)
    return () => clearInterval(t)
  }, [estado])

  // não mostra nada se nunca foi iniciado e está parado (mantém card limpo)
  if (estado==='parado' && !item.cron_iniciado_em && !(item.cron_decorrido_segundos)) return null
  if (estado==='encerrado' || (item as any).status==='concluido') return null

  const acumulado = item.cron_decorrido_segundos ?? 0
  let decorrido = acumulado
  if (item.cron_iniciado_em && estado==='correndo') decorrido = acumulado + Math.floor((agora - new Date(item.cron_iniciado_em).getTime())/1000)
  const restante = Math.max(0, totalSeg - decorrido)
  const pct = totalSeg>0 ? Math.min(100, Math.round((decorrido/totalSeg)*100)) : 0
  const zerou = decorrido>0 && restante<=0
  // Cores graduais: <80% normal, 80%+ amarelo, 90%+ laranja, 95%+ vermelhão
  let cor = 'var(--primary)'
  if (pct >= 95) cor = '#C53030'       // vermelhão
  else if (pct >= 90) cor = '#E53E3E'  // vermelho
  else if (pct >= 80) cor = '#ECC94B'  // amarelo
  if (zerou) cor = '#C53030'

  return (
    <div style={{marginTop:8}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4}}>
        <span style={{fontSize:12,fontWeight:700,color:cor,fontVariantNumeric:'tabular-nums'}}>{decorrido>0?fmt(restante):fmt(totalSeg)}</span>
        <span style={{fontSize:12,fontWeight:800,color:cor}}>{pct}%</span>
      </div>
      <div style={{height:10,background:'var(--bg)',borderRadius:99,overflow:'hidden',border:'1px solid var(--border)'}}>
        <div style={{height:'100%',width:`${pct}%`,background:cor,borderRadius:99,transition:'width 0.5s linear'}}/>
      </div>
      {zerou && <div style={{display:'flex',alignItems:'center',gap:5,marginTop:5}}><div style={{width:10,height:10,borderRadius:'50%',background:'#E53E3E',animation:'pulse 1s infinite'}}/><span style={{fontSize:10,color:'#E53E3E',fontWeight:700}}>Tempo esgotado</span></div>}
    </div>
  )
}
