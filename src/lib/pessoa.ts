import { supabase } from './supabase'

// A mesma conta (user_id) tem UM cadastro em `people` POR EVENTO. Buscar só por
// user_id com maybeSingle() dá erro quando a pessoa já participou de 2+ eventos.
// Use isto: devolve o cadastro do evento informado (ou o mais recente, sem evento).
export async function minhaPessoa<T = { id: string }>(userId: string | null | undefined, eventId?: string | null, colunas = 'id'): Promise<T | null> {
  if (!userId) return null
  let q = supabase.from('people').select(colunas).eq('user_id', userId)
  if (eventId) q = q.eq('event_id', eventId)
  const { data } = await q.order('created_at', { ascending: false }).limit(1)
  return ((data ?? [])[0] as T) ?? null
}

// Todos os ids de cadastro desta conta (todos os eventos).
export async function meusPersonIds(userId: string | null | undefined): Promise<string[]> {
  if (!userId) return []
  const { data } = await supabase.from('people').select('id').eq('user_id', userId)
  return (data ?? []).map((p: any) => p.id)
}
