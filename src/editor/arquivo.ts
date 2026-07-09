// Abre o seletor de imagem do aparelho (galeria/câmera) e devolve o arquivo.
// Fica separado pra o editor não depender de nada do app.

export function escolherImagem(): Promise<File | null> {
  return new Promise(resolve => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.style.display = 'none'
    input.onchange = () => { resolve(input.files?.[0] ?? null); input.remove() }
    // se o usuário cancelar, o onchange não dispara — limpa depois de um tempo
    window.addEventListener('focus', () => setTimeout(() => { if (!input.files?.length) { resolve(null); input.remove() } }, 600), { once: true })
    document.body.appendChild(input)
    input.click()
  })
}
