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
  const [dispAtivo, setDispAtivo] = useState(true)   // disparador ligado?
  const [dispData, setDispData] = useState('')       // data do disparo ('' = 1º dia do evento)
  const [pronto, setPronto] = useState(false)
  const [mostrar, setMostrar] = useState(false)

  useEffect(() => {
    Promise.all([
      carregarConfig('abertura_mensagem'),
      carregarConfig('disparador_ativo'),
      carregarConfig('disparador_data'),
    ]).then(([m, a, d]) => {
      setMensagem(m || MSG_ABERTURA_PADRAO)
      setDispAtivo(a !== 'false')
      setDispData(d || '')
      setPronto(true)
    })
  }, [])

  useEffect(() => {
    if (!pronto || !evento?.id) return
    // Data do disparo: a configurada OU o 1º dia do evento
    const data = (dispData || (evento.start_date ? String(evento.start_date).slice(0, 10) : '')).slice(0, 10)
    if (!data) return
    // Chave inclui a data → se o admin mudar a data, re-arma (não fica preso)
    const chave = `abertura_${evento.id}_${data}`
    if (dispAtivo && hojeLocalStr() === data && !localStorage.getItem(chave)) {
      // Marca AGORA (1ª entrada do dia): dispara UMA única vez por aparelho,
      // mesmo que feche o app antes de concluir a cerimônia.
      localStorage.setItem(chave, '1')
      setMostrar(true)
    }
  }, [pronto, evento?.id, evento?.start_date, dispAtivo, dispData])

  function concluir() { setMostrar(false) }

  if (!mostrar) return null
  return <AberturaCerimonia mensagem={mensagem || MSG_ABERTURA_PADRAO} onFechar={concluir} />
}
