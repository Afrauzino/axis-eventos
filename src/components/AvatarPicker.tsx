import { useState } from 'react'
import UploadFoto from './UploadFoto'

// Padrão de emojis coloridos do AXIS (a "capa" de equipes/itens)
export const EMOJIS_AXIS = [
  // Comida / cozinha
  '🍴','🍽️','👨‍🍳','🍳','🥘','🍲','☕','🥤','🍞','🧁',
  // Música / louvor
  '🎤','🎵','🎶','🎸','🎹','🥁','🎺','🎷','🎻','📻',
  // Teatro / arte
  '🎭','🎬','🎨','🖌️','🎟️','📸','🎥','✨',
  // Religião
  '🙏','⛪','✝️','📖','🕊️','😇','🛐','📿',
  // Dinheiro / financeiro
  '💰','💵','🪙','💳','🧾','💲','🏦','📊',
  // Saúde
  '⚕️','⛑️','🏥','💊','🚑','🩺','💉','❤️‍🩹','🩹','🌡️',
  // Organização / objetos
  '📋','📢','📣','🔔','🗂️','📦','🎒','🧰',
  // Limpeza / serviço
  '🧹','🧺','🧼','🚿','🛏️','🚪','🔑','🛠️',
  // Transporte / lugares
  '🚗','🚐','🏠','🏡','📍','🗺️','⛺','🌳',
  // Pessoas / grupos
  '👥','🤝','🙋','👨‍👩‍👧‍👦','💪','🫂',
  // Símbolos / destaque
  '⭐','🌟','🔥','💡','☀️','🌙','💧','🏆','🥇','❤️',
]

type Props = {
  emoji: string
  fotoUrl: string | null
  cor: string
  bucket?: string
  path?: string
  onChangeEmoji: (e: string) => void
  onChangeFoto: (url: string | null) => void
}

export default function AvatarPicker({ emoji, fotoUrl, bucket = 'team-photos', path = 'team', onChangeEmoji, onChangeFoto }: Props) {
  const [modo, setModo] = useState<'emoji' | 'foto'>(fotoUrl ? 'foto' : 'emoji')

  return (
    <div>
      {/* alternador emoji / foto */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <button
          type="button"
          onClick={() => setModo('emoji')}
          className="btn"
          style={{
            flex: 1, padding: '9px', borderRadius: 9, fontSize: 13, fontWeight: 600,
            border: modo === 'emoji' ? '2px solid var(--primary)' : '1px solid var(--border)',
            background: modo === 'emoji' ? 'var(--primary-light)' : 'white',
            color: modo === 'emoji' ? 'var(--primary-dark)' : 'var(--muted)',
          }}
        >😀 Emoji</button>
        <button
          type="button"
          onClick={() => setModo('foto')}
          style={{
            flex: 1, padding: '9px', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            border: modo === 'foto' ? '2px solid var(--primary)' : '1px solid var(--border)',
            background: modo === 'foto' ? 'var(--primary-light)' : 'white',
            color: modo === 'foto' ? 'var(--primary-dark)' : 'var(--muted)',
          }}
        >📷 Foto</button>
      </div>

      {modo === 'emoji' ? (
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', maxHeight: 200, overflowY: 'auto', padding: 2 }}>
          {EMOJIS_AXIS.map(e => (
            <button
              key={e}
              type="button"
              onClick={() => { onChangeEmoji(e); onChangeFoto(null) }}
              style={{
                width: 40, height: 40, borderRadius: 10, fontSize: 20, cursor: 'pointer', fontFamily: 'inherit',
                border: emoji === e ? '2px solid var(--primary)' : '1px solid transparent',
                background: emoji === e ? 'var(--primary-light)' : 'var(--bg)',
              }}
            >{e}</button>
          ))}
        </div>
      ) : (
        <UploadFoto
          bucket={bucket}
          path={path + '-' + Date.now()}
          currentUrl={fotoUrl}
          onUpload={(url: string) => { onChangeFoto(url) }}
          label="Enviar foto"
        />
      )}
    </div>
  )
}
