import Seletor from './Seletor'
import { useIgrejas, OUTROS } from '../lib/igrejas'

// Campo "Igreja": caixa de seleção única (lista gerenciável) + "Outros".
// Ao escolher "Outros", abre um campo de texto pra digitar o nome.
// O valor guardado em `church` é o nome da igreja (padrão OU o texto digitado);
// "Outros" sem texto fica gravado como 'Outros'.
export default function SeletorIgreja({ value, onChange, disabled }: {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  const { nomeadas } = useIgrejas()
  const ehNomeada = nomeadas.includes(value)
  const selecionado = value === '' ? '' : (ehNomeada ? value : OUTROS)   // '' | nome | 'Outros'
  const opcoes = [...nomeadas.map(n => ({ value: n, label: n })), { value: OUTROS, label: 'Outros (digitar)' }]

  return (
    <>
      <Seletor titulo="Igreja" placeholder="Selecionar igreja" disabled={disabled}
        value={selecionado}
        onChange={v => onChange(v === OUTROS ? (ehNomeada ? OUTROS : (value || OUTROS)) : v)}
        opcoes={opcoes} />
      {selecionado === OUTROS && (
        <input className="form-input" style={{ marginTop: 8 }} placeholder="Digite o nome da igreja"
          value={value === OUTROS ? '' : value} disabled={disabled}
          onChange={e => onChange(e.target.value.trim() === '' ? OUTROS : e.target.value)} />
      )}
    </>
  )
}
