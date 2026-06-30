import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Profile } from '../App'

export default function Alojamento({ profile }: { profile?: Profile }) {
  const [eventoId, setEventoId] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('events').select('id').eq('status','active').limit(1)
      .then(({ data }) => {
        if (data?.[0]) setEventoId(data[0].id)
        setLoading(false)
      })
  }, [])

  if (loading) return (
    <div className="page">
      <div className="skeleton" style={{ height: 80, borderRadius: 14 }} />
    </div>
  )

  return (
    <div className="page">
      <div className="alert-box alert-info" style={{ marginBottom: 20 }}>
        Modulo Alojamento em desenvolvimento. Banco de dados configurado e pronto.
      </div>
      <div className="card">
        <p className="text-secondary text-sm">
          Este modulo sera implementado na proxima fase. Todas as tabelas necessarias ja foram criadas no banco de dados.
        </p>
      </div>
    </div>
  )
}
