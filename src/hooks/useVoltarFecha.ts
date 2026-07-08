import { useEffect, useRef } from 'react'

// Faz o botão VOLTAR do celular FECHAR a janela/modal aberto (em vez de sair da tela).
// Uso: useVoltarFecha(aberto, () => fechar())
//
// Ao abrir, empurra um estado no histórico. O "voltar" dispara popstate → fecha o modal
// (e o próprio voltar já consome o estado que empurramos).
// NÃO desfazemos o estado na limpeza de propósito: isso causava "piscar" (o modal abria e
// fechava na hora, principalmente em dev/StrictMode, por causa do history.back() do cleanup).
export function useVoltarFecha(aberto: boolean, fechar: () => void) {
  const fecharRef = useRef(fechar)
  fecharRef.current = fechar
  useEffect(() => {
    if (!aberto) return
    let ativo = true
    window.history.pushState({ axisModal: true }, '')
    const onPop = () => { if (ativo) fecharRef.current() }
    window.addEventListener('popstate', onPop)
    return () => {
      ativo = false
      window.removeEventListener('popstate', onPop)
    }
  }, [aberto])
}
