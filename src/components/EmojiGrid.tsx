import { EMOJIS_AXIS } from './AvatarPicker'

// Grade de emoji colorido — padrão ÚNICO do sistema (idêntico ao AvatarPicker).
// Use em qualquer tela que escolha emoji, para ficar exatamente igual.
export default function EmojiGrid({ value, onChange }: { value: string; onChange: (emoji: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', maxHeight: 200, overflowY: 'auto', padding: 2 }}>
      {EMOJIS_AXIS.map(e => (
        <button
          key={e}
          type="button"
          onClick={() => onChange(e)}
          style={{
            width: 40, height: 40, borderRadius: 10, fontSize: 20, cursor: 'pointer', fontFamily: 'inherit',
            border: value === e ? '2px solid var(--primary)' : '1px solid transparent',
            background: value === e ? 'var(--primary-light)' : 'var(--bg)',
          }}
        >{e}</button>
      ))}
    </div>
  )
}
