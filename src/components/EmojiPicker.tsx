type Props = {
  value: string
  onChange: (icon: string) => void
  label?: string
}

const ICON_GRUPOS = [
  { grupo: 'Pessoas', items: [
    {i:'person',l:'Pessoa'},{i:'group',l:'Grupo'},{i:'man',l:'Homem'},{i:'woman',l:'Mulher'},
    {i:'child_care',l:'Crianca'},{i:'elderly',l:'Idoso'},{i:'supervisor_account',l:'Supervisor'},
    {i:'manage_accounts',l:'Gerenciar'},{i:'account_circle',l:'Usuario'},{i:'badge',l:'Cracha'},
    {i:'face',l:'Rosto'},{i:'sentiment_satisfied',l:'Feliz'},
  ]},
  { grupo: 'Lugares', items: [
    {i:'meeting_room',l:'Sala'},{i:'bed',l:'Cama'},{i:'wc',l:'Banheiro'},{i:'restaurant',l:'Restaurante'},
    {i:'kitchen',l:'Cozinha'},{i:'location_on',l:'Local'},{i:'home',l:'Casa'},{i:'church',l:'Igreja'},
    {i:'door_front',l:'Porta'},{i:'stairs',l:'Escadas'},{i:'yard',l:'Quintal'},{i:'cottage',l:'Cabana'},
  ]},
  { grupo: 'Teatro e Arte', items: [
    {i:'theater_comedy',l:'Teatro'},{i:'mic',l:'Microfone'},{i:'headset',l:'Fone'},
    {i:'music_note',l:'Musica'},{i:'queue_music',l:'Playlist'},{i:'palette',l:'Arte'},
    {i:'brush',l:'Pincel'},{i:'movie',l:'Filme'},{i:'photo_camera',l:'Camera'},
    {i:'videocam',l:'Video'},{i:'speaker',l:'Som'},{i:'piano',l:'Piano'},
  ]},
  { grupo: 'Objetos', items: [
    {i:'inventory_2',l:'Caixa'},{i:'backpack',l:'Mochila'},{i:'luggage',l:'Mala'},
    {i:'chair',l:'Cadeira'},{i:'table_restaurant',l:'Mesa'},{i:'construction',l:'Ferramenta'},
    {i:'volunteer_activism',l:'Doacao'},{i:'celebration',l:'Celebracao'},{i:'cake',l:'Bolo'},
    {i:'local_florist',l:'Flor'},{i:'emoji_objects',l:'Ideia'},{i:'science',l:'Ciencia'},
  ]},
  { grupo: 'Saude', items: [
    {i:'medical_services',l:'Medico'},{i:'medication',l:'Remedio'},{i:'healing',l:'Curativo'},
    {i:'monitor_heart',l:'Coracao'},{i:'local_hospital',l:'Hospital'},{i:'emergency',l:'Emergencia'},
    {i:'vaccines',l:'Vacina'},{i:'thermometer',l:'Temperatura'},{i:'bloodtype',l:'Sangue'},
    {i:'health_and_safety',l:'Saude'},{i:'psychology',l:'Mental'},{i:'spa',l:'Spa'},
  ]},
  { grupo: 'Religiao', items: [
    {i:'church',l:'Igreja'},{i:'star',l:'Estrela'},{i:'flare',l:'Luz'},{i:'wb_sunny',l:'Sol'},
    {i:'nights_stay',l:'Lua'},{i:'auto_awesome',l:'Gracas'},{i:'favorite',l:'Amor'},
    {i:'volunteer_activism',l:'Servico'},{i:'handshake',l:'Alianca'},{i:'diversity_3',l:'Comunidade'},
    {i:'groups',l:'Reuniao'},{i:'local_fire_department',l:'Fogo'},
  ]},
]

// Render Material Symbol icon correctly
function MatIcon({ name, size = 20, color = 'var(--text2)' }: { name: string; size?: number; color?: string }) {
  return (
    <span style={{
      fontFamily: "'Material Symbols Outlined'",
      fontWeight: 'normal',
      fontStyle: 'normal',
      fontSize: size,
      lineHeight: 1,
      letterSpacing: 'normal',
      textTransform: 'none',
      display: 'inline-block',
      whiteSpace: 'nowrap',
      wordWrap: 'normal',
      direction: 'ltr',
      WebkitFontSmoothing: 'antialiased',
      fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24",
      color,
      userSelect: 'none',
    }}>
      {name}
    </span>
  )
}

export default function EmojiPicker({ value, onChange, label = 'Icone' }: Props) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: 8 }}>{label}</label>

      {/* Preview */}
      {value && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, padding: '10px 14px', background: 'var(--primary-light)', borderRadius: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <MatIcon name={value} size={22} color="white" />
          </div>
          <span style={{ fontSize: 13, color: 'var(--primary-dark)', fontWeight: 600 }}>Icone selecionado</span>
          <button type="button" onClick={() => onChange('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
            Remover
          </button>
        </div>
      )}

      {/* Grade de icones */}
      {ICON_GRUPOS.map(g => (
        <div key={g.grupo} style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{g.grupo}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
            {g.items.map(item => (
              <button
                key={item.i}
                type="button"
                title={item.l}
                onClick={() => onChange(item.i)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                  padding: '8px 4px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                  border: `2px solid ${value === item.i ? 'var(--primary)' : 'transparent'}`,
                  background: value === item.i ? 'var(--primary-light)' : 'var(--bg)',
                  transition: 'all 0.12s',
                }}
              >
                <MatIcon name={item.i} size={22} color={value === item.i ? 'var(--primary)' : 'var(--text2)'} />
                <span style={{ fontSize: 9, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.2, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.l}
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
