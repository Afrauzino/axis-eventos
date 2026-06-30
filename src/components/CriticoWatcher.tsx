import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { formatName } from '../utils'
import type { Profile } from '../App'

// Vigia alertas CRÍTICOS não lidos e exibe em tela cheia automaticamente (tempo real via polling)
type Critico = { dest_id:string; remetente_nome:string|null; texto:string|null; foto_url:string|null }

export default function CriticoWatcher({ profile }: { profile: Profile }) {
  const [critico, setCritico] = useState<Critico|null>(null)
  const personId = useRef<string|null>(null)

  useEffect(() => {
    let timer: any
    let ativo = true
    async function init() {
      const { data: p } = await supabase.from('people').select('id').eq('user_id', profile.user_id).maybeSingle()
      personId.current = p?.id ?? null
      checar()
      timer = setInterval(checar, 15000) // a cada 15s
    }
    async function checar() {
      if (!ativo || !personId.current || critico) return
      const { data } = await supabase.from('alertas_lideres_dest')
        .select('id,lido,alertas_lideres(remetente_nome,texto,foto_url,nivel)')
        .eq('destinatario_id', personId.current).eq('lido', false).order('id',{ascending:false})
      const crit = (data ?? []).find((d:any) => d.alertas_lideres?.nivel==='critico')
      if (crit) {
        const a:any = crit.alertas_lideres
        setCritico({ dest_id:(crit as any).id, remetente_nome:a.remetente_nome, texto:a.texto, foto_url:a.foto_url })
      }
    }
    init()
    return () => { ativo=false; clearInterval(timer) }
  }, [profile.user_id, critico])

  async function confirmar() {
    if (critico?.dest_id) await supabase.from('alertas_lideres_dest').update({ lido:true, lido_em:new Date().toISOString() }).eq('id', critico.dest_id)
    setCritico(null)
  }

  if (!critico) return null
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(180,0,0,0.97)',zIndex:9999,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:24,animation:'pulse 1.5s infinite'}}>
      <p style={{color:'white',fontSize:14,fontWeight:800,letterSpacing:'0.12em',marginBottom:14}}>🚨 ALERTA CRÍTICO</p>
      <p style={{color:'white',fontSize:13,opacity:0.85,marginBottom:10}}>{critico.remetente_nome?formatName(critico.remetente_nome):'Líder'}</p>
      {critico.texto && <p style={{color:'white',fontSize:22,fontWeight:700,textAlign:'center',marginBottom:18,maxWidth:440,lineHeight:1.4}}>{critico.texto}</p>}
      {critico.foto_url && <img src={critico.foto_url} alt="" style={{maxWidth:'100%',maxHeight:'55vh',objectFit:'contain',borderRadius:12,marginBottom:22}}/>}
      <button onClick={confirmar} style={{minWidth:200,padding:'14px 24px',background:'white',color:'var(--danger)',border:'none',borderRadius:12,fontWeight:800,fontSize:15,cursor:'pointer',fontFamily:'inherit'}}>OK, confirmar leitura</button>
    </div>
  )
}
