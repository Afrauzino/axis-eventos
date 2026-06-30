import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { isAdmin } from '../utils'
import type { Profile } from '../App'

type Perm = {
  id:string; role:string|null; person_id:string|null; team_id:string|null
  modulo:string; acao:string; permitido:boolean
}

// Cache global
let cachePerms: Perm[] | null = null
let cacheTeams: Record<string,string[]> = {}  // user_id -> [team_id]
let cachePersonId: Record<string,string> = {}  // user_id -> people.id

// Limpa o cache de permissões (chamar após mudar permissões no Admin)
export function limparCachePermissoes() {
  cachePerms = null
  cacheTeams = {}
  cachePersonId = {}
}

export function usePermissao(profile: Profile | null) {
  const [perms, setPerms]   = useState<Perm[]>(cachePerms ?? [])
  const [myTeams, setMyTeams] = useState<string[]>([])
  const [myPersonId, setMyPersonId] = useState<string|null>(null)
  const [carregado, setCarregado] = useState(false)

  useEffect(() => {
    if (!profile) { setCarregado(true); return }
    load()
  }, [profile?.user_id])

  async function load() {
    try {
      // Carregar todas as permissões (cargo, pessoa e equipe)
      if (!cachePerms) {
        const { data } = await supabase.from('permissoes').select('*')
        cachePerms = data ?? []
      }
      setPerms(cachePerms)

      // Descobrir de quais equipes o usuário faz parte
      if (profile) {
        if (cachePersonId[profile.user_id]) {
          setMyPersonId(cachePersonId[profile.user_id])
          setMyTeams(cacheTeams[profile.user_id] ?? [])
        } else {
          // user_id -> people.id (TODOS os registros desta pessoa, não importa o evento)
          const { data: pessoas } = await supabase.from('people')
            .select('id').eq('user_id', profile.user_id)
          const personIds = (pessoas ?? []).map(p => p.id)
          if (personIds.length > 0) {
            // usa o primeiro como "principal", mas considera todos nas buscas
            cachePersonId[profile.user_id] = personIds[0]
            setMyPersonId(personIds[0])

            // Equipes: membro (people_teams) OU líder/co-líder (teams)
            const [vinculos, lideradas] = await Promise.all([
              supabase.from('people_teams').select('team_id').in('person_id', personIds),
              supabase.from('teams').select('id').or(
                personIds.map(id => `leader_id.eq.${id},co_leader_id.eq.${id}`).join(',')
              ),
            ])
            const teamIds = new Set<string>()
            ;(vinculos.data ?? []).forEach(v => teamIds.add(v.team_id))
            ;(lideradas.data ?? []).forEach(t => teamIds.add(t.id))
            const arr = Array.from(teamIds)
            cacheTeams[profile.user_id] = arr
            setMyTeams(arr)
            // guarda todos os personIds para o "pode" considerar permissão individual em qualquer registro
            ;(cachePersonId as any)[profile.user_id + ':all'] = personIds as any
          }
        }
      }
    } catch {}
    setCarregado(true)
  }

  // REGRA AXIS: Admin tem TUDO. Demais: liberação por equipe (acumulativa) + individual.
  // "Editar implica visualizar. Visualizar não implica editar."
  function pode(modulo: string, acao: string = 'ver'): boolean {
    if (!profile) return false
    if (isAdmin(profile.user_role) || profile.is_admin) return true

    // Todos os person_ids desta pessoa (caso haja registro por evento)
    const allIds: string[] = (cachePersonId as any)[profile.user_id + ':all'] ?? (myPersonId ? [myPersonId] : [])

    // Permissão individual (qualquer registro person_id desta pessoa)
    const ind = perms.some(p => p.person_id && allIds.includes(p.person_id) && p.modulo === modulo && p.acao === acao && p.permitido)
    if (ind) return true

    // Alguma equipe do usuário libera esta ação?
    const equipeLibera = perms.some(p =>
      p.team_id && myTeams.includes(p.team_id) &&
      p.modulo === modulo && p.acao === acao && p.permitido
    )
    if (equipeLibera) return true

    // "Editar implica visualizar": se pede 'ver' e tem 'editar', libera ver
    if (acao === 'ver') {
      const temEditarInd = perms.some(p => p.person_id && allIds.includes(p.person_id) && p.modulo === modulo && p.acao === 'editar' && p.permitido)
      const temEditarEq = perms.some(p => p.team_id && myTeams.includes(p.team_id) && p.modulo === modulo && p.acao === 'editar' && p.permitido)
      if (temEditarInd || temEditarEq) return true
    }

    return false
  }

  function recarregar() {
    cachePerms = null
    cacheTeams = {}
    cachePersonId = {}
    load()
  }

  return { pode, carregado, recarregar, myTeams }
}
