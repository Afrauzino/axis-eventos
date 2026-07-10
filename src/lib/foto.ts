// Fotos NÃO-destrutivas: além do recorte exibido, guardamos a foto ORIGINAL inteira.
// Convenção de nome: exibição = ".../algo.jpg"  →  original = ".../algo__orig.jpg".
// Assim dá pra reenquadrar a partir da original e baixá-la, sem perder nada.

const SUF = '__orig'

// URL da original a partir da URL de exibição (o recorte). Mantém o ?t= de cache.
export function urlOriginal(url: string): string {
  const [base, q] = url.split('?')
  if (base.toLowerCase().endsWith(`${SUF}.jpg`)) return url
  const orig = base.replace(/\.jpg$/i, `${SUF}.jpg`)
  return q ? `${orig}?${q}` : orig
}

// Caminho (dentro do bucket) da original a partir do caminho de exibição.
export function pathOriginal(path: string): string {
  return path.replace(/\.jpg$/i, `${SUF}.jpg`)
}

// A imagem carrega? (fotos antigas não têm original — aí caímos na de exibição.)
export function imagemCarrega(url: string): Promise<boolean> {
  return new Promise(res => {
    const img = new Image()
    img.onload = () => res(true)
    img.onerror = () => res(false)
    img.src = url
  })
}

// Baixa uma imagem no aparelho.
export async function baixarImagem(url: string, nome = 'foto-original.jpg'): Promise<boolean> {
  try {
    const r = await fetch(url, { mode: 'cors' })
    if (!r.ok) return false
    const blob = await r.blob()
    const obj = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = obj; a.download = nome
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(obj), 2000)
    return true
  } catch { return false }
}
