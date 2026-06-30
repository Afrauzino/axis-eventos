import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type Item = {
  id:string; titulo:string; hora_inicio:string; hora_fim:string
  duracao_minutos?:number|null; cron_iniciado_em?:string|null
  cron_ajuste_segundos?:number|null; cron_estado?:string|null; cron_decorrido_segundos?:number|null
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

export default function CronometroPopup({ item, podeControlar, onClose, onUpdate }: { item:Item; podeControlar:boolean; onClose:()=>void; onUpdate?:()=>void }) {
  const [estado, setEstado] = useState(item.cron_estado ?? 'parado')
  const [iniciadoEm, setIniciadoEm] = useState<string|null>(item.cron_iniciado_em ?? null)
  const [ajuste, setAjuste] = useState(item.cron_ajuste_segundos ?? 0)
  const [acumulado, setAcumulado] = useState(item.cron_decorrido_segundos ?? 0)
  const [agora, setAgora] = useState(Date.now())
  const [addMin, setAddMin] = useState('') // campo para digitar minutos extras

  const totalSeg = duracaoBaseSeg(item) + ajuste

  useEffect(() => {
    if (estado!=='correndo') return
    const t = setInterval(()=>setAgora(Date.now()), 250)
    return () => clearInterval(t)
  }, [estado])

  // decorrido = tempo já acumulado + (se rodando) tempo desde que retomou
  let decorrido = acumulado
  if (iniciadoEm && estado==='correndo') {
    const extra = Math.floor((agora - new Date(iniciadoEm).getTime())/1000)
    decorrido = acumulado + Math.max(0, extra)
  }
  const restante = Math.max(0, totalSeg - decorrido)
  const pct = totalSeg>0 ? Math.min(100, Math.round((decorrido/totalSeg)*100)) : 0
  const zerou = decorrido>0 && restante<=0
  const jaComecou = iniciadoEm !== null || acumulado > 0

  async function salvar(campos:any){ try { await supabase.from('cronograma_eventos').update(campos).eq('id', item.id); onUpdate?.() } catch(e){} }
  async function iniciar(){
    const ini=new Date().toISOString()
    setIniciadoEm(ini); setEstado('correndo'); setAgora(Date.now())
    await salvar({cron_iniciado_em:ini,cron_estado:'correndo',cron_ajuste_segundos:ajuste, cron_decorrido_segundos:acumulado, status:'em_andamento'})
  }
  async function pausar(){
    let novoAcum = acumulado
    if (iniciadoEm) novoAcum = acumulado + Math.max(0, Math.floor((Date.now() - new Date(iniciadoEm).getTime())/1000))
    setAcumulado(novoAcum); setIniciadoEm(null); setEstado('parado')
    await salvar({cron_estado:'parado', cron_decorrido_segundos:novoAcum, cron_iniciado_em:null})
  }
  async function reiniciar(){ setIniciadoEm(null); setAjuste(0); setAcumulado(0); setEstado('parado'); setAgora(Date.now()); await salvar({cron_iniciado_em:null, cron_estado:'parado', cron_ajuste_segundos:0, cron_decorrido_segundos:0}) }
  async function ajustar(deltaSeg:number){ const novo=ajuste+deltaSeg; setAjuste(novo); await salvar({cron_ajuste_segundos:novo}) }
  async function adicionarDigitado(){ const m=Number(addMin); if(!m) return; const novo=ajuste+m*60; setAjuste(novo); setAddMin(''); await salvar({cron_ajuste_segundos:novo}) }
  async function encerrar(){ setEstado('encerrado'); await salvar({cron_estado:'encerrado', status:'concluido'}); onClose() }

  let cor = 'var(--primary)'
  if (pct >= 95) cor = '#C53030'
  else if (pct >= 90) cor = '#E53E3E'
  else if (pct >= 80) cor = '#ECC94B'
  if (zerou) cor = '#C53030'
  const rodando = estado==='correndo'

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:18}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:'white',borderRadius:20,padding:'24px 22px',width:'100%',maxWidth:440,maxHeight:'90vh',overflowY:'auto'}}>
        <p style={{fontSize:18,fontWeight:800,textAlign:'center',marginBottom:2}}>{item.titulo}</p>
        <p style={{fontSize:12,color:'var(--muted)',textAlign:'center',marginBottom:18}}>Duração total: {fmt(totalSeg)}</p>

        {zerou && (
          <div style={{display:'flex',justifyContent:'center',marginBottom:14}}>
            <div style={{width:24,height:24,borderRadius:'50%',background:'#E53E3E',animation:'pulse 1s infinite'}}/>
          </div>
        )}

        {/* tempo restante grande */}
        <p style={{fontSize:46,fontWeight:800,textAlign:'center',color:zerou?'#E53E3E':'var(--text)',fontVariantNumeric:'tabular-nums',marginBottom:10,letterSpacing:'0.02em'}}>{fmt(jaComecou ? restante : totalSeg)}</p>

        {/* barra longa */}
        <div style={{height:16,background:'var(--bg)',borderRadius:99,overflow:'hidden',marginBottom:6,border:'1px solid var(--border)'}}>
          <div style={{height:'100%',width:`${pct}%`,background:cor,borderRadius:99,transition:'width 0.25s linear'}}/>
        </div>
        <p style={{fontSize:15,fontWeight:800,textAlign:'center',color:cor,marginBottom:20}}>{pct}%</p>

        {podeControlar ? (
          <>
            {/* +2 / -2 minutos */}
            <div style={{display:'flex',gap:8,marginBottom:10}}>
              <button onClick={()=>ajustar(-120)} style={{flex:1,padding:'14px',borderRadius:12,border:'1px solid var(--border)',background:'white',cursor:'pointer',fontSize:16,fontWeight:800,fontFamily:'inherit'}}>− 2 min</button>
              <button onClick={()=>ajustar(120)} style={{flex:1,padding:'14px',borderRadius:12,border:'1px solid var(--border)',background:'white',cursor:'pointer',fontSize:16,fontWeight:800,fontFamily:'inherit'}}>+ 2 min</button>
            </div>

            {/* digitar minutos */}
            <div style={{display:'flex',gap:8,marginBottom:16}}>
              <input type="number" min="1" value={addMin} onChange={e=>setAddMin(e.target.value)} placeholder="Minutos a adicionar" style={{flex:1,padding:'12px',borderRadius:12,border:'1px solid var(--border)',fontFamily:'inherit',fontSize:14}}/>
              <button onClick={adicionarDigitado} style={{padding:'12px 18px',borderRadius:12,border:'none',background:'var(--primary)',color:'white',cursor:'pointer',fontWeight:800,fontFamily:'inherit'}}>Adicionar</button>
            </div>

            {!rodando
              ? <button onClick={iniciar} className="btn btn-primary btn-full" style={{marginBottom:8,padding:'14px'}}><span className="icon icon-sm">play_arrow</span> Iniciar</button>
              : <button onClick={pausar} className="btn btn-ghost btn-full" style={{marginBottom:8}}><span className="icon icon-sm">pause</span> Pausar</button>
            }
            <button onClick={reiniciar} className="btn btn-ghost btn-full" style={{marginBottom:8}}><span className="icon icon-sm">replay</span> Reiniciar tempo</button>
            <button onClick={encerrar} className="btn btn-ghost btn-full" style={{color:'var(--danger)'}}>Encerrar bloco</button>
          </>
        ) : (
          <p style={{fontSize:12,color:'var(--muted)',textAlign:'center',padding:'8px'}}>Você acompanha o tempo. Sem permissão para controlar.</p>
        )}
        <button onClick={onClose} className="btn btn-ghost btn-full" style={{marginTop:8}}>Fechar</button>
      </div>
    </div>
  )
}
