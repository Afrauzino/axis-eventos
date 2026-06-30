import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type Item = {
  id:string; titulo:string
  hora_inicio:string; hora_fim:string
  duracao_minutos?:number|null
  cron_iniciado_em?:string|null
  cron_ajuste_segundos?:number|null
  cron_estado?:string|null
}

// Duração em segundos: usa duracao_minutos; senão diferença início/fim
function duracaoSegundos(item: Item): number {
  if (item.duracao_minutos && item.duracao_minutos>0) return item.duracao_minutos*60
  const ini = new Date(item.hora_inicio).getTime()
  const fim = new Date(item.hora_fim).getTime()
  const diff = Math.round((fim-ini)/1000)
  return diff>0 ? diff : 0
}

function fmt(seg:number): string {
  const s = Math.max(0, seg)
  const h = Math.floor(s/3600)
  const m = Math.floor((s%3600)/60)
  const sec = s%60
  const p = (n:number)=>String(n).padStart(2,'0')
  return h>0 ? `${p(h)}:${p(m)}:${p(sec)}` : `${p(m)}:${p(sec)}`
}

export default function CronometroBloco({ item, podeControlar, onClose }: { item:Item; podeControlar:boolean; onClose:()=>void }) {
  const [estado, setEstado] = useState(item.cron_estado ?? 'parado')
  const [iniciadoEm, setIniciadoEm] = useState<string|null>(item.cron_iniciado_em ?? null)
  const [ajuste, setAjuste] = useState(item.cron_ajuste_segundos ?? 0)
  const [agora, setAgora] = useState(Date.now())

  const totalSeg = duracaoSegundos(item) + ajuste

  // tick a cada segundo quando correndo
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

  async function salvar(campos: any) {
    await supabase.from('cronograma_eventos').update(campos).eq('id', item.id)
  }

  async function iniciar() {
    const ini = new Date().toISOString()
    setIniciadoEm(ini); setEstado('correndo'); setAgora(Date.now())
    await salvar({ cron_iniciado_em: ini, cron_estado:'correndo', cron_ajuste_segundos: ajuste })
  }
  async function pausar() {
    setEstado('parado')
    await salvar({ cron_estado:'parado' })
  }
  async function ajustar(delta:number) {
    const novo = ajuste + delta
    setAjuste(novo)
    await salvar({ cron_ajuste_segundos: novo })
  }
  async function encerrar() {
    setEstado('encerrado')
    await salvar({ cron_estado:'encerrado' })
    onClose()
  }

  const corBarra = zerou ? '#E53E3E' : 'var(--primary)'

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:400,display:'flex',alignItems:'flex-end',justifyContent:'center'}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:'white',borderRadius:'20px 20px 0 0',padding:'20px',width:'100%',maxWidth:480,maxHeight:'80vh',overflowY:'auto'}}>
        <div style={{width:36,height:4,background:'var(--border)',borderRadius:2,margin:'0 auto 16px'}}/>
        <p style={{fontSize:16,fontWeight:800,textAlign:'center',marginBottom:4}}>{item.titulo}</p>
        <p style={{fontSize:12,color:'var(--muted)',textAlign:'center',marginBottom:16}}>Duração: {fmt(totalSeg)}</p>

        {/* círculo vermelho piscante quando zera */}
        {zerou && (
          <div style={{display:'flex',justifyContent:'center',marginBottom:12}}>
            <div style={{width:20,height:20,borderRadius:'50%',background:'#E53E3E',animation:'pulse 1s infinite'}}/>
          </div>
        )}

        {/* tempo restante */}
        <p style={{fontSize:38,fontWeight:800,textAlign:'center',color:zerou?'#E53E3E':'var(--text)',fontVariantNumeric:'tabular-nums',marginBottom:8}}>{fmt(restante)}</p>

        {/* barra */}
        <div style={{height:14,background:'var(--bg)',borderRadius:99,overflow:'hidden',marginBottom:6}}>
          <div style={{height:'100%',width:`${pct}%`,background:corBarra,borderRadius:99,transition:'width 1s linear'}}/>
        </div>
        <p style={{fontSize:14,fontWeight:800,textAlign:'center',color:corBarra,marginBottom:18}}>{pct}%</p>

        {podeControlar ? (
          <>
            <div style={{display:'flex',gap:8,marginBottom:10}}>
              <button onClick={()=>ajustar(-60)} style={{flex:1,padding:'12px',borderRadius:10,border:'1px solid var(--border)',background:'white',cursor:'pointer',fontSize:16,fontWeight:800,fontFamily:'inherit'}}>−1 min</button>
              <button onClick={()=>ajustar(60)} style={{flex:1,padding:'12px',borderRadius:10,border:'1px solid var(--border)',background:'white',cursor:'pointer',fontSize:16,fontWeight:800,fontFamily:'inherit'}}>+1 min</button>
            </div>
            {estado!=='correndo'
              ? <button onClick={iniciar} className="btn btn-primary btn-full" style={{marginBottom:8}}><span className="icon icon-sm">play_arrow</span> Iniciar</button>
              : <button onClick={pausar} className="btn btn-ghost btn-full" style={{marginBottom:8}}><span className="icon icon-sm">pause</span> Pausar</button>
            }
            <button onClick={encerrar} className="btn btn-ghost btn-full" style={{color:'var(--danger)'}}>Encerrar bloco</button>
          </>
        ) : (
          <p style={{fontSize:12,color:'var(--muted)',textAlign:'center',padding:'8px'}}>Você pode acompanhar o tempo. Sem permissão para controlar.</p>
        )}
        <button onClick={onClose} className="btn btn-ghost btn-full" style={{marginTop:8}}>Fechar</button>
      </div>
    </div>
  )
}
