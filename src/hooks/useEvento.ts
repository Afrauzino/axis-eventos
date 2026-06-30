import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type Evento = {
  id: string
  name: string
  status: string
  start_date: string | null
  end_date: string | null
  location: string | null
  valor_encontrista: number
  valor_encontreiro: number
}

// Cache global para não re-buscar em cada página
let cachedEvento: Evento | null = null
let cachedAt = 0

export function useEvento() {
  const [evento, setEvento] = useState<Evento | null>(cachedEvento)
  const [loading, setLoading] = useState(!cachedEvento)

  useEffect(() => {
    // Usar cache se menos de 30 segundos
    if (cachedEvento && Date.now() - cachedAt < 30000) {
      setEvento(cachedEvento)
      setLoading(false)
      return
    }

    supabase
      .from('events')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          cachedEvento = data
          cachedAt = Date.now()
          setEvento(data)
        }
        setLoading(false)
      })
  }, [])

  function invalidateCache() {
    cachedEvento = null
    cachedAt = 0
  }

  return { evento, loading, invalidateCache }
}
