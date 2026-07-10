import { useEffect, useRef } from 'react'

// Faz o botão VOLTAR do celular FECHAR a janela/modal aberto (em vez de sair da tela).
// Uso: useVoltarFecha(aberto, () => fechar())
//
// Ao abrir, empurra um estado no histórico. O "voltar" dispara popstate → fecha o modal.
// Ao fechar pelo X/backdrop (não pelo voltar), CONSOME o estado empurrado (history.back())
// pra não deixar "fantasma" no histórico — senão o Voltar da tela vai só comendo fantasma
// e parece que travou.
//
// A trava `limpando` ignora o popstate gerado pela própria limpeza (importante no
// StrictMode do dev, que monta→desmonta→monta e antes causava o "piscar").
let limpando = false

export function useVoltarFecha(aberto: boolean, fechar: () => void) {
  const fecharRef = useRef(fechar)
  fecharRef.current = fechar
  useEffect(() => {
    if (!aberto) return
    let ativo = true
    let fechadoPeloVoltar = false
    window.history.pushState({ axisModal: true }, '')
    const onPop = () => {
      if (limpando) return                 // popstate da limpeza de outro modal — ignora
      fechadoPeloVoltar = true
      if (ativo) fecharRef.current()
    }
    window.addEventListener('popstate', onPop)
    return () => {
      ativo = false
      window.removeEventListener('popstate', onPop)
      if (!fechadoPeloVoltar) {
        // Fechou pelo X/backdrop: tira o estado que empurramos (sem disparar fechar de novo).
        limpando = true
        window.history.back()
        setTimeout(() => { limpando = false }, 0)
      }
    }
  }, [aberto])
}
