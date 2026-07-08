import { useEffect } from 'react'

// Faz o botão VOLTAR do celular FECHAR a janela/modal aberto (em vez de sair da tela).
// Uso: useVoltarFecha(aberto, () => fechar())
// Como funciona: ao abrir, empurra um estado no histórico. O "voltar" dispara popstate
// → fecha o modal. Se o modal fechar por outro caminho (botão X/fora), desfaz esse estado.
export function useVoltarFecha(aberto: boolean, fechar: () => void) {
  useEffect(() => {
    if (!aberto) return
    const urlAoAbrir = window.location.href
    window.history.pushState({ axisModal: true }, '')
    let fechadoPeloVoltar = false
    const onPop = () => { fechadoPeloVoltar = true; fechar() }
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      if (fechadoPeloVoltar) return
      // fechou pelo X/fora: só desfaz o estado extra SE ainda estamos na MESMA url
      // (se navegou pra outra tela, NÃO mexe no histórico pra não voltar sem querer)
      if (window.location.href === urlAoAbrir && window.history.state && (window.history.state as any).axisModal) {
        window.history.back()
      }
    }
  }, [aberto])
}
