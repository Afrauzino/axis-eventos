import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { verificarBiometria, desativarBiometria } from '../lib/biometria'
import type { Profile } from '../App'

// Tela que trava o app na abertura até a pessoa passar a digital.
// "Entrar com senha" tira a trava e volta pro login (evita ficar preso se a digital falhar).
export default function BloqueioBiometrico({ profile, onUnlock }: { profile: Profile; onUnlock: () => void }) {
  const [tentando, setTentando] = useState(false)
  const [erro, setErro] = useState(false)

  async function tentar() {
    if (tentando) return
    setTentando(true); setErro(false)
    const ok = await verificarBiometria(profile.user_id)
    setTentando(false)
    if (ok) onUnlock()
    else setErro(true)
  }

  // Já pede a digital assim que abre
  useEffect(() => { tentar() }, [])

  async function usarSenha() {
    // desativa a trava neste aparelho e sai — a pessoa entra com senha e reativa depois
    desativarBiometria(profile.user_id)
    try { await supabase.auth.signOut() } catch {}
    window.location.href = '/'
  }

  const primeiroNome = (profile.full_name ?? '').split(' ')[0] || 'Bem-vindo'

  return (
    <div style={{position:'fixed',inset:0,background:'var(--primary)',zIndex:9999,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:24,textAlign:'center'}}>
      <img src="/axis-192.png" alt="AXIS" style={{width:76,height:76,borderRadius:20,marginBottom:20,boxShadow:'0 6px 20px rgba(0,0,0,0.25)'}}/>
      <p style={{color:'white',fontSize:20,fontWeight:800,marginBottom:4}}>Olá, {primeiroNome}</p>
      <p style={{color:'rgba(255,255,255,0.85)',fontSize:14,marginBottom:32}}>
        {erro ? 'Não deu pra ler a digital. Tente de novo.' : 'Toque para entrar com a digital'}
      </p>

      <button onClick={tentar} disabled={tentando}
        style={{width:96,height:96,borderRadius:'50%',background:'rgba(255,255,255,0.18)',border:'2px solid rgba(255,255,255,0.5)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit',marginBottom:16}}>
        <span style={{fontFamily:"'Material Symbols Outlined'",fontSize:48,color:'white',fontVariationSettings:"'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24",lineHeight:1,display:'inline-block',userSelect:'none'}}>fingerprint</span>
      </button>
      <p style={{color:'white',fontSize:14,fontWeight:700,marginBottom:40}}>{tentando ? 'Lendo digital...' : 'Entrar com a digital'}</p>

      <button onClick={usarSenha}
        style={{background:'none',border:'none',color:'rgba(255,255,255,0.9)',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit',textDecoration:'underline',padding:8}}>
        Entrar com senha
      </button>
    </div>
  )
}
