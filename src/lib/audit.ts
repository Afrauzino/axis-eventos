import { supabase } from './supabase'

// Registro de Ações (Logs / Auditoria).
// Uso: registrarLog({ action:'approve', entity:'profiles', entityId:x, description:'Aprovou o usuário João', eventId })
// Nunca lança erro — auditoria jamais deve quebrar a ação principal.

type LogArgs = {
  action: string                 // create | update | delete | approve | reject | payment | medication | login | export | other
  entity: string                 // módulo/tabela afetada
  entityId?: string | null       // id do registro afetado
  description?: string           // texto legível para o admin
  eventId?: string | null        // evento atual (quando houver)
  actorName?: string | null      // nome de quem fez (se não vier, busca no profile)
  metadata?: Record<string, any> // detalhes extras (opcional)
}

export async function registrarLog(args: LogArgs): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    let actor = args.actorName ?? null
    if (!actor) {
      const { data: prof } = await supabase.from('profiles').select('name').eq('user_id', user.id).maybeSingle()
      actor = prof?.name ?? null
    }
    await supabase.from('audit_logs').insert({
      event_id:   args.eventId ?? null,
      user_id:    user.id,
      actor_name: actor,
      action:     args.action,
      entity:     args.entity,
      entity_id:  args.entityId ?? null,
      description: args.description ?? null,
      metadata:   args.metadata ?? null,
    })
  } catch {
    // silencioso de propósito
  }
}
