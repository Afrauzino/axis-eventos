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
    if (!pronto || !evento?.start_date) return
    const start = String(evento.start_date).slice(0, 10)
    const ativa = (evento as any).contagem_ativa !== false
    const jaFez = localStorage.getItem('abertura_' + evento.id)
    if (ativa && hojeLocalStr() === start && !jaFez) setMostrar(true)
  }, [pronto, evento])

  function concluir() {
    if (evento?.id) localStorage.setItem('abertura_' + evento.id, '1')
    setMostrar(false)
  }

  if (!mostrar) return null
  return <AberturaCerimonia mensagem={mensagem || MSG_ABERTURA_PADRAO} onFechar={concluir} />
}
