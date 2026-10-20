import { useEffect, useState } from 'react'
import { useEvento } from '../hooks/useEvento'
import { minhaPessoa } from '../lib/pessoa'
import FinalizarInscricao from '../components/FinalizarInscricao'
import type { Profile } from '../App'

// "Minha inscrição": assinar o termo do evento e pagar (Pix + WhatsApp do responsável).
export default function MeuPagamento({ profile }: { profile: Profile }) {
  const { evento, loading } = useEvento()
  const [personId, setPersonId] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    if (loading) return
    if (!evento?.id) { setPersonId(null); return }
    minhaPessoa(profile.user_id, evento.id).then(p => setPersonId(p?.id ?? null))
  }, [evento?.id, loading, profile.user_id])

  return (
    <div className="page slide-up" style={{ maxWidth: 520, margin: '0 auto' }}>
      {personId === undefined && <div className="skeleton" style={{ height: 220, borderRadius: 14 }} />}
      {personId === null && (
        <div className="info-section"><p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.7 }}>
          Você ainda não tem cadastro no evento atual{evento ? ` (${evento.name})` : ''}. Faça sua inscrição em “Meu perfil”.
        </p></div>
      )}
      {personId && <FinalizarInscricao personId={personId} />}
    </div>
  )
}
