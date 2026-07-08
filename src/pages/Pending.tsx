import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { carregarConfig } from '../lib/tema'
import type { Profile } from '../App'

export default function Pending({ profile }: { profile: Profile | null }) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  useEffect(() => { carregarConfig('logo_url').then(setLogoUrl) }, [])

  const st = profile?.role_status
  const titulo = st==='rejected' ? 'Acesso negado' : st==='suspended' ? 'Conta suspensa' : 'Aguardando aprovação'
  const msg = st==='rejected'
    ? 'Seu acesso foi negado pelo administrador. Entre em contato para mais informações.'
    : st==='suspended'
    ? 'Sua conta foi suspensa temporariamente. Entre em contato com o administrador.'
    : 'Seu cadastro foi recebido. Um administrador precisa aprovar seu acesso antes de você entrar no sistema.'

  return (
    <div style={{minHeight:'100vh',background:'var(--bg)',display:'flex',flexDirection:'column'}}>
      <div style={{background:'var(--primary)',padding:'56px 24px 36px',textAlign:'center'}}>
        <div style={{width:64,height:64,background:'rgba(255,255,255,0.2)',borderRadius:16,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px',overflow:'hidden',border:'1px solid rgba(255,255,255,0.3)'}}>
          {logoUrl
            ? <img src={logoUrl} alt="Logo" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
            : <span style={{fontSize:13,fontWeight:800,color:'white'}}>ECD</span>}
        </div>
        <h1 style={{fontSize:20,fontWeight:700,color:'white',marginBottom:4}}>{titulo}</h1>
        <p style={{fontSize:13,color:'rgba(255,255,255,0.8)'}}>AXIS Eventos</p>
      </div>
      <div style={{flex:1,padding:24,display:'flex',flexDirection:'column',gap:14,maxWidth:480,margin:'0 auto',width:'100%'}}>
        <div className="info-section"><p style={{fontSize:14,color:'var(--text2)',lineHeight:1.7}}>{msg}</p></div>
        {(!st||st==='pending') && <div className="alert-box alert-info">Assim que aprovado você terá acesso automaticamente. Tente entrar novamente mais tarde.</div>}
        <button className="btn btn-outline btn-full" onClick={()=>supabase.auth.signOut()} style={{marginTop:'auto'}}>Sair</button>
      </div>
    </div>
  )
}
