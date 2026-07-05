import type { ReactNode } from 'react'

export type EquipeTag = {
  emoji?: string
  fotoUrl?: string | null
  cor?: string
  titulo?: string
}

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
  onEditar?: () => void       // clicar no lapis = editar
  onFoto?: () => void         // clicar na foto = ampliar (so pessoa)
  direita?: ReactNode         // conteudo no canto direito (selo/valor/status), antes do lapis
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
  const cor = props.cor || '#00A99D'
  const corReal = cor.startsWith('var(') ? '#00A99D' : cor
  const equipes = props.equipes || []
  const temBarra = props.progresso != null

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
          {props.onEditar && (
            <button
              className="card-item-edit"
              onClick={(ev) => { ev.stopPropagation(); props.onEditar!() }}
              aria-label="Editar"
            >
              <span className="icon icon-sm">edit</span>
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
    </div>
  )
}
