import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import MenuSaude from '../components/MenuSaude'
import DataHora from '../components/DataHora'
import { toast } from '../components/Toast'
import { gerarDoses, type JanelaMed } from '../lib/doses'
import { isAdmin } from '../utils'
import { useEvento } from '../hooks/useEvento'
import type { Profile } from '../App'

export default function SaudeConfig({ profile }: { profile?: Profile }) {
  const { evento, loading: evLoading } = useEvento()
  const [inicio, setInicio] = useState('')   // 'YYYY-MM-DDTHH:MM'
  const [fim, setFim]       = useState('')
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const canEdit = isAdmin(profile?.user_role)

  useEffect(() => { if (evLoading) return; if (!evento) { setLoading(false); return }; carregar() }, [evento, evLoading])

  async function carregar() {
    if (!evento) return
    setLoading(true)
    const { data } = await supabase.from('events').select('med_inicio,med_fim,start_date,end_date').eq('id', evento.id).maybeSingle()
    const d: any = data ?? {}
    // Usa o que já foi salvo; se vazio, sugere a partir das datas do evento
    setInicio(d.med_inicio ?? (d.start_date ? `${d.start_date}T08:00` : ''))
    setFim(d.med_fim ?? (d.end_date ? `${d.end_date}T14:00` : ''))
    setLoading(false)
  }

  // Recalcula as doses de TODOS os medicamentos contínuos dentro da janela.
  // Mantém o histórico já entregue e não duplica horários.
  async function recalcular(jan: JanelaMed): Promise<number> {
    if (!evento) return 0
    const { data: meds } = await supabase.from('med_controlados').select('*').eq('event_id', evento.id)
    let total = 0
    for (const m of meds ?? []) {
      const { data: entregues } = await supabase.from('med_agenda').select('horario').eq('med_ctrl_id', m.id).eq('entregue', true)
      const jaEntregues = new Set((entregues ?? []).map((e: any) => new Date(e.horario).getTime()))
      await supabase.from('med_agenda').delete().eq('med_ctrl_id', m.id).eq('entregue', false)
      const doses = gerarDoses(
        { nome: m.nome, dosagem: m.dosagem, intervalo_h: m.intervalo_h, ultima_dose: m.ultima_dose },
        m.person_id, evento.id, m.id, jan,
      ).filter(d => !jaEntregues.has(new Date(d.horario).getTime()))
      if (doses.length) { await supabase.from('med_agenda').insert(doses); total += doses.length }
    }
    return total
  }

  async function salvar() {
    if (!evento) return
    if (!inicio || !fim) { toast.aviso('Preencha a data/hora inicial e a final.'); return }
    if (new Date(fim).getTime() <= new Date(inicio).getTime()) { toast.aviso('A data/hora final precisa ser depois da inicial.'); return }
    setSalvando(true)
    const { error } = await supabase.from('events').update({ med_inicio: inicio, med_fim: fim }).eq('id', evento.id)
    if (error) { setSalvando(false); toast.falha('Não foi possível salvar.', error); return }
    const total = await recalcular({ inicio: new Date(inicio).getTime(), fim: new Date(fim).getTime() })
    setSalvando(false)
    toast.sucesso(`Salvo! ${total} dose(s) recalculada(s) no período.`)
  }

  if (evLoading || loading) return <div className="page"><div className="skeleton" style={{height:160,borderRadius:14}}/></div>

  return (
    <div className="page">
      <MenuSaude />

      <div className="section-label mb-2">Medicamento contínuo — período de doses</div>
      <div style={{background:'white',borderRadius:12,padding:'16px',boxShadow:'var(--shadow-sm)',marginBottom:16}}>
        <div className="form-group">
          <label className="form-label">Início (data e hora)</label>
          <DataHora modo="datetime" value={inicio} disabled={!canEdit} onChange={setInicio}/>
        </div>
        <div className="form-group">
          <label className="form-label">Fim (data e hora)</label>
          <DataHora modo="datetime" value={fim} disabled={!canEdit} onChange={setFim}/>
        </div>
        {canEdit && (
          <button className="btn btn-primary btn-full" onClick={salvar} disabled={salvando} style={{marginTop:4}}>
            {salvando ? 'Salvando e recalculando...' : 'Salvar e recalcular doses'}
          </button>
        )}
      </div>

      <div className="alert-box alert-info" style={{fontSize:13,lineHeight:1.6}}>
        <strong>Como funciona:</strong> defina a <strong>data e hora inicial</strong> e a <strong>final</strong> do
        período em que os medicamentos serão entregues. Ao salvar, o sistema recalcula as doses de todos os
        medicamentos contínuos: parte da <strong>última dose tomada</strong> + o <strong>intervalo</strong> de cada
        remédio e repete os horários <strong>dentro desse período</strong>. As doses já <strong>entregues</strong> são
        preservadas (o histórico nunca é apagado).
      </div>
    </div>
  )
}
