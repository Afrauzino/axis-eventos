import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import SubTabs from '../components/SubTabs'
import { isAdmin } from '../utils'
import { useEvento } from '../hooks/useEvento'
import type { Profile } from '../App'

export default function SaudeConfig({ profile }: { profile?: Profile }) {
  const { evento, loading: evLoading } = useEvento()
  const [corte, setCorte]   = useState(14)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg]       = useState('')
  const canEdit = isAdmin(profile?.user_role)

  useEffect(() => { if (evLoading) return; if (!evento) { setLoading(false); return }; carregar() }, [evento, evLoading])

  async function carregar() {
    if (!evento) return
    setLoading(true)
    const { data } = await supabase.from('events').select('med_corte_hora').eq('id',evento.id).maybeSingle()
    if (data && (data as any).med_corte_hora != null) setCorte((data as any).med_corte_hora)
    setLoading(false)
  }

  async function salvar() {
    if (!evento) return
    setSalvando(true); setMsg('')
    const { error } = await supabase.from('events').update({ med_corte_hora: corte }).eq('id', evento.id)
    setSalvando(false)
    setMsg(error ? ('Erro: ' + error.message) : '✓ Salvo!')
    setTimeout(()=>setMsg(m=>m==='✓ Salvo!'?'':m), 1500)
  }

  if (evLoading || loading) return <div className="page"><SubTabs group="saude"/><div className="skeleton" style={{height:120,borderRadius:14}}/></div>

  return (
    <div className="page">
      <SubTabs group="saude"/>

      <div className="section-label mb-2">Medicamento contínuo — período de doses</div>
      <div style={{background:'white',borderRadius:12,padding:'16px',boxShadow:'var(--shadow-sm)',marginBottom:16}}>
        <div className="form-group">
          <label className="form-label">Hora de corte (encerramento das doses)</label>
          <select className="form-select" value={corte} disabled={!canEdit} onChange={e=>setCorte(parseInt(e.target.value))}>
            {Array.from({length:24}, (_,h)=><option key={h} value={h}>{String(h).padStart(2,'0')}:00</option>)}
          </select>
        </div>
        {canEdit && (
          <button className="btn btn-primary btn-full" onClick={salvar} disabled={salvando} style={{marginTop:4}}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        )}
        {msg && <p style={{fontSize:12,textAlign:'center',marginTop:8,color:msg.startsWith('Erro')?'var(--danger)':'var(--success)'}}>{msg}</p>}
      </div>

      <div className="alert-box alert-info" style={{fontSize:13,lineHeight:1.6}}>
        <strong>Como funciona:</strong> ao cadastrar um medicamento contínuo, o sistema calcula automaticamente as doses
        a partir da <strong>última dose tomada</strong> + o <strong>intervalo</strong> informado, dentro de um período fixo:
        o <strong>resto do dia</strong> do preenchimento, o <strong>dia seguinte inteiro</strong>, encerrando às
        <strong> {String(corte).padStart(2,'0')}:00</strong> do dia seguinte ao dia completo.
        <br/><br/>
        Exemplo (corte {String(corte).padStart(2,'0')}:00): preenchido na sexta → doses da sexta e do sábado, encerrando domingo às {String(corte).padStart(2,'0')}:00.
      </div>
    </div>
  )
}
