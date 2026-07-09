import { useEffect, useState } from 'react'
import { useEvento } from '../hooks/useEvento'
import { carregarConfig } from '../lib/tema'
import AberturaCerimonia from './AberturaCerimonia'

// "Portão" do dia do evento: se hoje é o 1º dia e a contagem está ativa, bloqueia
// o app inteiro até a pessoa passar pela cerimônia de abertura (uma vez por
// aparelho). Mensagem vem de configurações (chave abertura_mensagem).

export const MSG_ABERTURA_PADRAO = 'Chegou o grande dia! 🙌\nPrepare seu coração — o encontro vai começar.'

function hojeLocalStr(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export default function AberturaGate() {
  const { evento } = useEvento()
  const [mensagem, setMensagem] = useState('')
  const [pronto, setPronto] = useState(false)
  const [mostrar, setMostrar] = useState(false)

  useEffect(() => {
    carregarConfig('abertura_mensagem').then(v => { setMensagem(v || MSG_ABERTURA_PADRAO); setPronto(true) })
  }, [])

  useEffect(() => {
    if (!pronto || !evento?.id || !evento?.start_date) return
    const start = String(evento.start_date).slice(0, 10)
    const ativa = (evento as any).contagem_ativa !== false
    const chave = 'abertura_' + evento.id
    const jaFez = localStorage.getItem(chave)
    if (ativa && hojeLocalStr() === start && !jaFez) {
      // Marca AGORA (na 1ª entrada do dia): dispara UMA única vez por aparelho,
      // mesmo que a pessoa feche o app antes de concluir a cerimônia.
      localStorage.setItem(chave, '1')
      setMostrar(true)
    }
  }, [pronto, evento?.id, (evento as any)?.start_date, (evento as any)?.contagem_ativa])

  function concluir() { setMostrar(false) }

  if (!mostrar) return null
  return <AberturaCerimonia mensagem={mensagem || MSG_ABERTURA_PADRAO} onFechar={concluir} />
}
