import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import Confete from './Confete'
import type { Profile } from '../App'

// No DIA do aniversário da pessoa, ao abrir o app: tela cheia de Parabéns
// com confete + áudio (reaproveita o que já existe). Aparece 1x por dia.
const BUZINA = '/buzina-evento.mp3'

function hojeStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function ParabensAniversario({ profile }: { profile: Profile }) {
  const [nome, setNome] = useState<string | null>(null)
  const [confete, setConfete] = useState(0)
  const chave = `axis_niver_visto_${profile.user_id}`

  useEffect(() => {
    let ativo = true
    ;(async () => {
      // Já mostrei hoje? então não repete
      try { if (localStorage.getItem(chave) === hojeStr()) return } catch {}
      const { data } = await supabase.from('people')
        .select('name,birth_date').eq('user_id', profile.user_id).not('birth_date', 'is', null).limit(1).maybeSingle()
      if (!ativo || !data?.birth_date) return
      const d = new Date()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      const bd = String(data.birth_date)
      if (bd.slice(5, 7) === mm && bd.slice(8, 10) === dd) {
        setNome((data.name || profile.full_name || '').split(' ')[0] || 'você')
        setConfete(c => c + 1)
        // tenta tocar o áudio (pode ser bloqueado sem toque — aí o botão garante)
        try { const a = new Audio(BUZINA); a.volume = 1; a.play().catch(() => {}) } catch {}
      }
    })()
    return () => { ativo = false }
  }, [profile.user_id])

  function comemorar() {
    setConfete(c => c + 1)
    try { const a = new Audio(BUZINA); a.volume = 1; a.play().catch(() => {}) } catch {}
  }

  function fechar() {
    try { localStorage.setItem(chave, hojeStr()) } catch {}
    setNome(null)
  }

  if (!nome) return null

  return (
    <>
      <Confete disparo={confete} />
      <div style={{ position: 'fixed', inset: 0, zIndex: 9997, background: 'linear-gradient(160deg,#ED64A6,#B83280)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 28, textAlign: 'center' }}>
        <div style={{ fontSize: 76, lineHeight: 1, marginBottom: 8 }}>🎂</div>
        <p style={{ color: 'white', fontSize: 15, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10, opacity: 0.9 }}>Feliz aniversário</p>
        <p style={{ color: 'white', fontSize: 30, fontWeight: 800, marginBottom: 14, textShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>Parabéns, {nome}! 🎉</p>
        <p style={{ color: 'rgba(255,255,255,0.92)', fontSize: 15, lineHeight: 1.5, maxWidth: 340, marginBottom: 32 }}>
          Toda a equipe do AXIS deseja um dia abençoado e cheio de alegria pra você! 🥳
        </p>

        <button onClick={comemorar}
          style={{ background: 'white', color: '#B83280', border: 'none', borderRadius: 99, padding: '14px 28px', fontSize: 16, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 14, boxShadow: '0 6px 20px rgba(0,0,0,0.2)' }}>
          🎉 Comemorar!
        </button>
        <button onClick={fechar}
          style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.5)', borderRadius: 99, padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          Fechar
        </button>
      </div>
    </>
  )
}
