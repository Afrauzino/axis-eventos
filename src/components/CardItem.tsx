import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'

export type EquipeTag = {
  emoji?: string
  fotoUrl?: string | null
  cor?: string
  titulo?: string
}

export type AcaoCard = { label: string; icon?: string; onClick: () => void; danger?: boolean }

type Props = {
  cor?: string
  emoji?: string
  fotoUrl?: string | null
  iniciais?: string
  ehPessoa?: boolean          // true = clicar na foto amplia (encontrista/encontreiro)
  titulo: string
  subtitulo?: string
  equipes?: EquipeTag[]
  progresso?: number | null
  progressoLabel?: string
  onVer?: () => void          // clicar no corpo/nome = ver informacoes
  onEditar?: () => void       // atalho: vira a ação "Editar" no menu ⋮
  onExcluir?: () => void      // atalho: vira a ação "Excluir" no menu ⋮
  acoes?: AcaoCard[]          // ações extras do menu ⋮
  onFoto?: () => void         // clicar na foto = ampliar (so pessoa)
  direita?: ReactNode         // conteudo no canto direito (selo/valor/status), antes do menu
  extra?: ReactNode
}

function tint(hex: string, a: number) {
  const h = (hex || '').replace('#', '')
  if (h.length !== 6) return 'rgba(0,169,157,' + a + ')'
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')'
}

export default function CardItem(props: Props) {
  const [menu, setMenu] = useState(false)
  const cor = props.cor || '#00A99D'
  const corReal = cor.startsWith('var(') ? '#00A99D' : cor
  const equipes = props.equipes || []
  const temBarra = props.progresso != null

  // Junta os atalhos (Editar/Excluir) com as ações extras num menu ⋮ único
  const acoes: AcaoCard[] = [
    ...(props.onEditar ? [{ label: 'Editar', icon: 'edit', onClick: props.onEditar }] : []),
    ...(props.acoes ?? []),
    ...(props.onExcluir ? [{ label: 'Excluir', icon: 'delete', onClick: props.onExcluir, danger: true }] : []),
  ]

  function clickFoto(ev: any) {
    if (props.onFoto && props.ehPessoa && props.fotoUrl) {
      ev.stopPropagation()
      props.onFoto()
    }
  }

  return (
    <div className="card-item" onClick={props.onVer}>
      <div className="card-item-bar" style={{ background: cor }} />
      <div className="card-item-wrap">
        <div className="card-item-body">
          <div
            className="card-item-avatar"
            onClick={clickFoto}
            style={{
              background: props.fotoUrl ? '#eee' : tint(corReal, 0.14),
              color: corReal,
              cursor: (props.onFoto && props.ehPessoa && props.fotoUrl) ? 'pointer' : 'inherit',
            }}
          >
            {props.fotoUrl
              ? <img src={props.fotoUrl} alt="" />
              : props.emoji
                ? <span style={{ fontSize: 27 }}>{props.emoji}</span>
                : <span style={{ fontWeight: 700, fontSize: 18 }}>{props.iniciais || ''}</span>}
          </div>
          <div className="card-item-main">
            <div className="card-item-title">{props.titulo}</div>
            {props.subtitulo && <div className="card-item-sub">{props.subtitulo}</div>}
            {equipes.length > 0 && (
              <div className="card-item-teams">
                {equipes.map((e, i) => (
                  <div
                    key={i}
                    className="card-item-team"
                    title={e.titulo || ''}
                    style={{ background: tint(e.cor || corReal, 0.16) }}
                  >
                    {e.fotoUrl
                      ? <img src={e.fotoUrl} alt="" />
                      : <span>{e.emoji || '👥'}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
          {props.direita && (
            <div className="card-item-direita" onClick={(ev) => ev.stopPropagation()}>
              {props.direita}
            </div>
          )}
          {acoes.length > 0 && (
            <button
              className="card-item-menu"
              onClick={(ev) => { ev.stopPropagation(); setMenu(true) }}
              aria-label="Opções"
            >
              <span className="icon icon-sm">more_vert</span>
            </button>
          )}
        </div>
        {temBarra && (
          <div className="card-item-barra">
            <div className="card-item-progress">
              <div style={{ width: Math.max(0, Math.min(100, props.progresso!)) + '%', background: cor }} />
            </div>
            {props.progressoLabel && (
              <div className="card-item-progress-label" style={{ color: corReal }}>{props.progressoLabel}</div>
            )}
          </div>
        )}
        {props.extra && <div className="card-item-extra">{props.extra}</div>}
      </div>

      {/* Menu ⋮ (abre de baixo) */}
      {menu && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 700, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
          onClick={(ev) => { ev.stopPropagation(); setMenu(false) }}>
          <div style={{ background: 'white', borderRadius: '20px 20px 0 0', padding: '8px 16px 22px', maxWidth: 480, width: '100%', margin: '0 auto' }} onClick={(ev) => ev.stopPropagation()}>
            <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 2, margin: '12px auto 12px' }} />
            <p style={{ fontSize: 15, fontWeight: 800, margin: '0 4px 12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{props.titulo}</p>
            {acoes.map((a, i) => (
              <button key={i} type="button"
                onClick={() => { setMenu(false); a.onClick() }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 12px', borderRadius: 10, marginBottom: 4, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', border: 'none', background: 'white' }}>
                <span className="icon" style={{ color: a.danger ? 'var(--danger)' : 'var(--primary)' }}>{a.icon ?? 'chevron_right'}</span>
                <span style={{ fontSize: 15, fontWeight: 600, color: a.danger ? 'var(--danger)' : 'var(--text)' }}>{a.label}</span>
              </button>
            ))}
            <button type="button" className="btn btn-ghost btn-full" style={{ marginTop: 6 }} onClick={() => setMenu(false)}>Fechar</button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
