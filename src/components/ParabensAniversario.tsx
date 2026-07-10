import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { carregarConfig } from '../lib/tema'
import { enviarPush } from '../lib/push'
import Confete from './Confete'
import type { Profile } from '../App'

// No DIA do aniversário: tela cheia de Parabéns com confete + áudio (1x/dia).
// Também avisa líderes e admins. Texto é editável em Administração → Notificações.
// Com `preview`, mostra a tela na hora (pra ver/testar), sem marcar como visto.
const BUZINA = '/buzina-evento.mp3'
export const MSG_PADRAO = 'Toda a equipe do AXIS deseja um dia abençoado e cheio de alegria pra você! 🥳'
export const TITULO_PADRAO = 'Feliz aniversário'

function hojeStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function tocarAudio() { try { const a = new Audio(BUZINA); a.volume = 1; a.play().catch(() => {}) } catch {} }

type Dados = { nome: string; titulo: string; mensagem: string }

export default function ParabensAniversario({ profile, preview, onFecharPreview }: { profile: Profile; preview?: Dados | null; onFecharPreview?: () => void }) {
  const [dados, setDados] = useState<Dados | null>(preview ?? null)
  const [confete, setConfete] = useState(0)
  const chave = `axis_niver_visto_${profile.user_id}`

  useEffect(() => {
    // Modo pré-visualização (Administração → Notificações → Testar)
    if (preview) { setDados(preview); setConfete(c => c + 1); tocarAudio(); return }

    let ativo = true
    ;(async () => {
      try { if (localStorage.getItem(chave) === hojeStr()) return } catch {}
      const { data } = await supabase.from('people')
        .select('id,name,birth_date,event_id').eq('user_id', profile.user_id).not('birth_date', 'is', null).limit(1).maybeSingle()
      if (!ativo || !data?.birth_date) return
      const d = new Date()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      const bd = String(data.birth_date)
      if (!(bd.slice(5, 7) === mm && bd.slice(8, 10) === dd)) return

      // UMA VEZ por aniversário, em qualquer aparelho: tranca no servidor por
      // pessoa+ano (sql/58). Quem "ganha" o insert é o primeiro aparelho a abrir;
      // os outros veem conflito e NÃO mostram de novo nem re-avisam os líderes.
      // Se a tabela ainda não existe (SQL não rodou), cai na trava só-do-aparelho.
      let primeiro = true
      try {
        const { data: ins, error } = await supabase.from('aniversario_comemorado')
          .upsert({ user_id: profile.user_id, ano: d.getFullYear() }, { onConflict: 'user_id,ano', ignoreDuplicates: true })
          .select('user_id')
        if (error) {
          if (error.code === '42P01') primeiro = true          // tabela ainda não criada → comportamento antigo
          else primeiro = true                                  // erro transitório → não estraga a festa
        } else {
          primeiro = Array.isArray(ins) ? ins.length > 0 : !!ins // vazio = outro aparelho já comemorou
        }
      } catch {}

      // trava local do dia (atalho: evita reconsultar o servidor a cada abertura)
      try { localStorage.setItem(chave, hojeStr()) } catch {}
      if (!ativo || !primeiro) return

      const [titulo, mensagem] = await Promise.all([carregarConfig('aniversario_titulo'), carregarConfig('aniversario_mensagem')])
      if (!ativo) return
      setDados({ nome: (data.name || profile.full_name || '').split(' ')[0] || 'você', titulo: titulo || TITULO_PADRAO, mensagem: mensagem || MSG_PADRAO })
      setConfete(c => c + 1)
      tocarAudio()

      // Avisa líderes e admins (se ligado)
      const avisar = await carregarConfig('aniversario_avisar_lideres')
      if (avisar !== '0' && data.event_id) {
        try {
          const { data: teams } = await supabase.from('teams').select('leader_id,co_leader_id').eq('event_id', data.event_id)
          const lp = [...new Set((teams ?? []).flatMap((t: any) => [t.leader_id, t.co_leader_id]).filter(Boolean))]
          let leaderUsers: string[] = []
          if (lp.length) {
            const { data: ls } = await supabase.from('people').select('user_id').in('id', lp).not('user_id', 'is', null)
            leaderUsers = (ls ?? []).map((l: any) => l.user_id)
          }
          const nomeCompleto = data.name || profile.full_name || 'Alguém'
          enviarPush({ user_ids: leaderUsers, notify_admins: true, incluir_autor: true, title: '🎂 Aniversário hoje!', body: `Hoje é aniversário de ${nomeCompleto}! 🎉`, url: '/' })
        } catch {}
      }
    })()
    return () => { ativo = false }
  }, [preview, profile.user_id])

  function comemorar() { setConfete(c => c + 1); tocarAudio() }
  function fechar() {
    if (preview) { onFecharPreview?.(); return }
    setDados(null)
  }

  if (!dados) return null

  return (
    <>
      <Confete disparo={confete} />
      <div style={{ position: 'fixed', inset: 0, zIndex: 9997, background: 'linear-gradient(160deg,#ED64A6,#B83280)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 28, textAlign: 'center' }}>
        <div style={{ fontSize: 76, lineHeight: 1, marginBottom: 8 }}>🎂</div>
        <p style={{ color: 'white', fontSize: 15, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10, opacity: 0.9 }}>{dados.titulo}</p>
        <p style={{ color: 'white', fontSize: 30, fontWeight: 800, marginBottom: 14, textShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>Parabéns, {dados.nome}! 🎉</p>
        <p style={{ color: 'rgba(255,255,255,0.92)', fontSize: 15, lineHeight: 1.5, maxWidth: 340, marginBottom: 32, whiteSpace: 'pre-wrap' }}>{dados.mensagem}</p>

        <button onClick={comemorar}
          style={{ background: 'white', color: '#B83280', border: 'none', borderRadius: 99, padding: '14px 28px', fontSize: 16, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 14, boxShadow: '0 6px 20px rgba(0,0,0,0.2)' }}>
          🎉 Comemorar!
        </button>
        <button onClick={fechar}
          style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.5)', borderRadius: 99, padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          {preview ? 'Fechar pré-visualização' : 'Fechar'}
        </button>
      </div>
    </>
  )
}
