import { useEffect, useState } from 'react'
import { useRegistrarChromeAdmin } from '../lib/chrome'
import { isAdmin } from '../utils'
import { toast } from '../components/Toast'
import { carregarCadastroCfg, salvarCadastroCfg, CAMPOS, type CampoCfg } from '../lib/cadastroCfg'
import type { Profile } from '../App'

// Administração → Ficha de cadastro. Por enquanto: o campo "Cargo" (lista fixa
// que a pessoa escolhe no cadastro). Modular: liga/desliga obrigatoriedade e
// ocultar o campo. Dá pra crescer pra outros campos depois.
export default function CadastroConfig({ profile }: { profile?: Profile }) {
  useRegistrarChromeAdmin()
  const admin = isAdmin(profile?.user_role) || profile?.is_admin
  const [cargos, setCargos] = useState<string[]>([])
  const [obrigatorio, setObrigatorio] = useState(false)
  const [oculto, setOculto] = useState(false)
  const [campos, setCampos] = useState<Record<string, CampoCfg>>({})
  const [carregado, setCarregado] = useState(false)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    carregarCadastroCfg(true).then(cfg => { setCargos(cfg.cargos.length ? cfg.cargos : ['']); setObrigatorio(cfg.obrigatorio); setOculto(cfg.oculto); setCampos(cfg.campos || {}); setCarregado(true) })
  }, [])

  const setCampo = (key: string, patch: CampoCfg) => setCampos(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }))

  function setCargo(i: number, v: string) { setCargos(prev => prev.map((c, idx) => idx === i ? v : c)) }
  function addCargo() { setCargos(prev => [...prev, '']) }
  function removeCargo(i: number) { setCargos(prev => prev.filter((_, idx) => idx !== i)) }
  function mover(i: number, dir: -1 | 1) {
    setCargos(prev => { const j = i + dir; if (j < 0 || j >= prev.length) return prev; const n = [...prev]; [n[i], n[j]] = [n[j], n[i]]; return n })
  }

  async function salvar() {
    setSalvando(true)
    const limpos = cargos.map(c => c.trim()).filter(Boolean)
    const ok = await salvarCadastroCfg({ cargos: limpos, obrigatorio, oculto, campos })
    setCargos(limpos.length ? limpos : [''])
    setSalvando(false)
    ok ? toast.sucesso('Ficha de cadastro salva!') : toast.falha('Não foi possível salvar.')
  }

  if (!admin) return <div className="page"><div className="empty"><p className="empty-title">Acesso restrito</p><p className="empty-desc">Apenas administradores.</p></div></div>
  if (!carregado) return <div className="page"><div className="skeleton" style={{ height: 220, borderRadius: 14 }} /></div>

  const validos = cargos.filter(c => c.trim()).length

  return (
    <div className="page">
      <div className="section-label mb-2">🪪 Campo "Cargo" no cadastro</div>
      <div style={{ background: 'white', borderRadius: 14, padding: '16px 18px', boxShadow: 'var(--shadow-sm)', marginBottom: 12 }}>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>
          A pessoa escolhe o cargo numa caixa de seleção no cadastro. Aqui você monta a lista. Se a lista ficar vazia (ou marcar "ocultar"), o campo <b>não aparece</b> — o cadastro continua igual ao de hoje.
        </p>

        {/* Lista de cargos */}
        <label className="form-label">Cargos disponíveis</label>
        {cargos.map((c, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <input className="form-input" style={{ margin: 0, flex: 1 }} value={c} onChange={e => setCargo(i, e.target.value)} placeholder={`Cargo ${i + 1} (ex.: Recepção)`} />
            <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} title="Subir" style={btnMini(i === 0)}><span className="icon icon-sm">keyboard_arrow_up</span></button>
            <button type="button" onClick={() => mover(i, 1)} disabled={i === cargos.length - 1} title="Descer" style={btnMini(i === cargos.length - 1)}><span className="icon icon-sm">keyboard_arrow_down</span></button>
            <button type="button" onClick={() => removeCargo(i)} title="Remover" style={{ ...btnMini(false), color: 'var(--danger)' }}><span className="icon icon-sm">delete</span></button>
          </div>
        ))}
        <button type="button" onClick={addCargo} style={{ width: '100%', padding: '10px', borderRadius: 10, border: '2px dashed var(--primary)', background: 'var(--primary-light)', color: 'var(--primary)', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', marginTop: 4 }}>+ Adicionar cargo</button>
        <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>{validos} cargo(s) na lista.</p>
      </div>

      {/* Modular: obrigatório / ocultar */}
      <div style={{ background: 'white', borderRadius: 14, padding: '8px 8px', boxShadow: 'var(--shadow-sm)', marginBottom: 14 }}>
        <ToggleLinha ligado={obrigatorio} onToggle={() => setObrigatorio(v => !v)} titulo="Cargo obrigatório" desc="Exige escolher um cargo pra concluir o cadastro." />
        <div style={{ height: 1, background: 'var(--border)', margin: '0 12px' }} />
        <ToggleLinha ligado={oculto} onToggle={() => setOculto(v => !v)} titulo="Ocultar o campo Cargo" desc="Esconde a caixa de cargo do cadastro (mesmo com lista preenchida)." />
      </div>

      {/* Outros campos da ficha — mostrar / obrigatório */}
      <div className="section-label mb-2">🧩 Outros campos da ficha</div>
      <div style={{ background: 'white', borderRadius: 14, padding: '8px 14px 14px', boxShadow: 'var(--shadow-sm)', marginBottom: 14 }}>
        <p style={{ fontSize: 12, color: 'var(--muted)', margin: '8px 0 6px' }}>Ligue o que quer <b>mostrar</b> no cadastro e o que é <b>obrigatório</b>. <b>Nome</b> e <b>Celular</b> são sempre obrigatórios (base do cadastro).</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 18, padding: '2px 4px 8px' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', width: 54, textAlign: 'center' }}>MOSTRAR</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', width: 54, textAlign: 'center' }}>OBRIGAT.</span>
        </div>
        {CAMPOS.map(c => {
          const mostrar = campos[c.key]?.oculto !== true
          // Foto é obrigatória por padrão (comportamento de hoje); os demais, opcional por padrão.
          const obrig = c.key === 'foto' ? campos[c.key]?.obrigatorio !== false : campos[c.key]?.obrigatorio === true
          return (
            <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 4px', borderTop: '1px solid var(--border)' }}>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600, opacity: mostrar ? 1 : 0.5 }}>{c.label}</span>
              <div style={{ width: 54, display: 'flex', justifyContent: 'center' }}>
                <Switch on={mostrar} onClick={() => setCampo(c.key, { oculto: mostrar })} />
              </div>
              <div style={{ width: 54, display: 'flex', justifyContent: 'center' }}>
                <Switch on={obrig} disabled={!mostrar} onClick={() => mostrar && setCampo(c.key, { obrigatorio: !obrig })} />
              </div>
            </div>
          )
        })}
      </div>

      <button className="btn btn-primary btn-full" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</button>
    </div>
  )
}

function Switch({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={on}
      style={{ width: 44, height: 26, borderRadius: 99, background: on ? 'var(--success)' : 'var(--border)', position: 'relative', flexShrink: 0, border: 'none', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1, transition: 'background .15s', fontFamily: 'inherit' }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: 'white', transition: 'left .15s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
    </button>
  )
}

const btnMini = (disabled: boolean): React.CSSProperties => ({ background: 'white', border: '1px solid var(--border)', borderRadius: 8, width: 34, height: 34, cursor: disabled ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', flexShrink: 0, opacity: disabled ? 0.4 : 1, fontFamily: 'inherit' })

function ToggleLinha({ ligado, onToggle, titulo, desc }: { ligado: boolean; onToggle: () => void; titulo: string; desc: string }) {
  return (
    <button onClick={onToggle} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 700 }}>{titulo}</p>
        <p style={{ fontSize: 11, color: 'var(--muted)' }}>{desc}</p>
      </div>
      <span style={{ width: 44, height: 26, borderRadius: 99, background: ligado ? 'var(--success)' : 'var(--border)', position: 'relative', flexShrink: 0, transition: 'background .15s' }}>
        <span style={{ position: 'absolute', top: 3, left: ligado ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: 'white', transition: 'left .15s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
      </span>
    </button>
  )
}
