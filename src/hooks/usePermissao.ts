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
          // user_id -> people.id -> people_teams.team_id
          const { data: pessoa } = await supabase.from('people')
            .select('id').eq('user_id', profile.user_id).maybeSingle()
          if (pessoa) {
            cachePersonId[profile.user_id] = pessoa.id
            setMyPersonId(pessoa.id)
            const { data: vinculos } = await supabase.from('people_teams')
              .select('team_id').eq('person_id', pessoa.id)
            const teamIds = (vinculos ?? []).map(v => v.team_id)
            cacheTeams[profile.user_id] = teamIds
            setMyTeams(teamIds)
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

    // Permissão individual (autorização explícita extra — só soma, nunca nega)
    const ind = myPersonId ? perms.some(p => p.person_id === myPersonId && p.modulo === modulo && p.acao === acao && p.permitido) : false
    if (ind) return true

    // Alguma equipe do usuário libera esta ação?
    const equipeLibera = perms.some(p =>
      p.team_id && myTeams.includes(p.team_id) &&
      p.modulo === modulo && p.acao === acao && p.permitido
    )
    if (equipeLibera) return true

    // "Editar implica visualizar": se pede 'ver' e a equipe tem 'editar', libera ver
    if (acao === 'ver') {
      const temEditar = perms.some(p =>
        p.team_id && myTeams.includes(p.team_id) &&
        p.modulo === modulo && p.acao === 'editar' && p.permitido
      )
      if (temEditar) return true
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
