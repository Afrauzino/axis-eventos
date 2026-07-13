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
      // Só desfaz o estado que empurramos se ele AINDA estiver no topo do histórico.
      // Se navegamos pra outra página com o modal aberto (ex.: clicar numa notificação
      // do sininho → navigate() substitui o nosso estado), o topo já NÃO é `axisModal`;
      // aí NÃO damos back() — senão o "voltar" desfazia a navegação (bug: clicava e
      // não ia pro lugar).
      let noTopo = true
      try { noTopo = !!(window.history.state && (window.history.state as any).axisModal) } catch { /* ignore */ }
      if (!fechadoPeloVoltar && noTopo) {
        // Fechou pelo X/backdrop/confirmar: tira o estado que empurramos (sem disparar
        // fechar de novo — nem nos modais de baixo, quando é um modal-dentro-de-modal).
        //
        // ATENÇÃO: history.back() é ASSÍNCRONO — o popstate dele chega DEPOIS. Se a gente
        // liberasse a trava num setTimeout(0), no PC (loop rápido) o timeout rodava ANTES
        // do popstate, a trava já estava solta e o "voltar" VAZAVA pro modal de baixo,
        // fechando ele (era o bug: salvar a foto fechava o cadastro inteiro).
        // Então liberamos a trava SÓ quando o popstate do nosso próprio back() chega.
        limpando = true
        const liberar = () => {
          window.removeEventListener('popstate', liberar)
          // Solta a trava só DEPOIS que todos os onPop deste MESMO popstate rodaram
          // (o setTimeout roda após o dispatch do evento). Se soltasse aqui na hora, o
          // `liberar` (registrado ANTES) rodava antes do onPop de um modal que abriu no
          // mesmo clique (ex.: seleção → impressão em Equipes): esse modal via
          // limpando=false e se fechava sozinho ("clica imprimir e fecha tudo").
          setTimeout(() => { limpando = false }, 0)
        }
        window.addEventListener('popstate', liberar)
        window.history.back()
        // rede de segurança: se o popstate não vier, solta assim mesmo.
        setTimeout(() => { if (limpando) { window.removeEventListener('popstate', liberar); limpando = false } }, 300)
      }
    }
  }, [aberto])
}
