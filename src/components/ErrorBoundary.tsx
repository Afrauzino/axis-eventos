import { Component, type ReactNode } from 'react'

/**
 * Captura erros de render de qualquer tela para o app não cair em tela branca.
 * Mostra uma mensagem amigável + botão de recarregar em vez de quebrar tudo.
 */
type Props = { children: ReactNode }
type State = { erro: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { erro: null }

  static getDerivedStateFromError(erro: Error): State {
    return { erro }
  }

  componentDidCatch(erro: Error) {
    // Erro de "chunk" (pós-deploy, cache velho no celular) → recarrega uma vez sozinho
    const m = erro?.message || ''
    if (/Loading chunk|dynamically imported module|Importing a module script failed|ChunkLoadError/i.test(m)) {
      try {
        const agora = Date.now()
        const ultimo = Number(sessionStorage.getItem('axis_reload_chunk') || '0')
        if (agora - ultimo > 15000) { sessionStorage.setItem('axis_reload_chunk', String(agora)); location.reload() }
      } catch { location.reload() }
      return
    }
    console.error('Erro de render capturado pelo ErrorBoundary:', erro)
  }

  render() {
    if (this.state.erro) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', background: '#f8fafc' }}>
          <div style={{ maxWidth: 360 }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>😕</div>
            <h1 style={{ fontSize: 18, fontWeight: 800, marginBottom: 6, color: '#111827' }}>Algo deu errado</h1>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 18 }}>
              Ocorreu um erro inesperado nesta tela. Você pode recarregar o app para continuar.
            </p>
            <button
              onClick={() => { this.setState({ erro: null }); location.reload() }}
              style={{ background: '#00A99D', color: 'white', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
            >
              Recarregar
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
