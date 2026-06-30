import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Profile } from '../App'

type Alerta = {
  id: string
  title: string
  message: string
  priority: string
  event_id: string
}

export default function CriticalAlert({ profile }: { profile: Profile }) {
  const [alerta, setAlerta] = useState<Alerta | null>(null)
  const [confirmando, setConfirmando] = useState(false)

  useEffect(() => {
    checkCritical()

    // Realtime: ouvir novos alertas criticos
    const channel = supabase
      .channel('critical-alerts')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'alerts',
        filter: `priority=eq.critico`,
      }, () => checkCritical())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  async function checkCritical() {
    // Buscar alertas criticos nao lidos pelo usuario
    const { data: lidos } = await supabase
      .from('alert_reads')
      .select('alert_id')
      .eq('user_id', profile.user_id)

    const lidosIds = (lidos ?? []).map((l: any) => l.alert_id)

    const { data: eventos } = await supabase
      .from('events')
      .select('id')
      .eq('status', 'active')
      .limit(1)

    if (!eventos?.[0]) return

    const { data: alertas } = await supabase
      .from('alerts')
      .select('*')
      .eq('event_id', eventos[0].id)
      .eq('priority', 'critico')
      .not('id', 'in', lidosIds.length > 0 ? `(${lidosIds.join(',')})` : '(00000000-0000-0000-0000-000000000000)')
      .order('created_at', { ascending: false })
      .limit(1)

    if (alertas?.[0]) setAlerta(alertas[0])
  }

  async function confirmarLeitura() {
    if (!alerta) return
    setConfirmando(true)

    await supabase.from('alert_reads').upsert({
      alert_id: alerta.id,
      user_id: profile.user_id,
      read_at: new Date().toISOString(),
    })

    setAlerta(null)
    setConfirmando(false)

    // Verificar se há mais alertas criticos
    setTimeout(checkCritical, 500)
  }

  if (!alerta) return null

  return (
    <div className="critical-overlay">
      <div className="critical-box">
        <div className="critical-icon">
          <span className="icon icon-lg" style={{ color: 'var(--danger)' }}>warning</span>
        </div>
        <h2 className="critical-title">{alerta.title}</h2>
        <p className="critical-msg">{alerta.message}</p>
        <button
          className="btn btn-danger btn-full btn-lg"
          onClick={confirmarLeitura}
          disabled={confirmando}
        >
          {confirmando ? 'Confirmando...' : 'Li e entendi — OK'}
        </button>
      </div>
    </div>
  )
}
