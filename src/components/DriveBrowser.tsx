import { useEffect, useState } from 'react'

// Explorador de pastas do Google Drive DENTRO do app (usa a API do Drive com uma
// chave). Navega subpastas aqui mesmo, tem Voltar, breadcrumb e +/- de tamanho.
// Arquivos (pdf, música, vídeo...) abrem com o link direto (o dispositivo abre
// com o app dele: galeria/player/leitor de pdf).

type Item = { id: string; name: string; mimeType: string; thumbnailLink?: string; webViewLink?: string; webContentLink?: string }
const FOLDER = 'application/vnd.google-apps.folder'

function iconFor(mime: string): string {
  if (mime.includes('pdf')) return '📄'
  if (mime.startsWith('audio')) return '🎵'
  if (mime.startsWith('video')) return '🎬'
  if (mime.startsWith('image')) return '🖼️'
  if (mime.includes('spreadsheet') || mime.includes('sheet') || mime.includes('excel')) return '📊'
  if (mime.includes('presentation') || mime.includes('powerpoint')) return '📽️'
  if (mime.includes('document') || mime.includes('word')) return '📝'
  return '📎'
}

export default function DriveBrowser({ rootId, rootName = 'Mídia', apiKey }: { rootId: string; rootName?: string; apiKey: string }) {
  const [pilha, setPilha] = useState<{ id: string; name: string }[]>([{ id: rootId, name: rootName }])
  const [itens, setItens] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [col, setCol] = useState(130)
  const [falhou, setFalhou] = useState<Set<string>>(new Set())

  useEffect(() => { setPilha([{ id: rootId, name: rootName }]) }, [rootId, rootName])

  const atual = pilha[pilha.length - 1]

  useEffect(() => {
    let ativo = true
    setLoading(true); setErro('')
    const q = `'${atual.id}' in parents and trashed=false`
    const fields = 'files(id,name,mimeType,thumbnailLink,webViewLink,webContentLink)'
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&key=${apiKey}` +
      `&fields=${encodeURIComponent(fields)}&orderBy=folder,name&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true`
    fetch(url).then(r => r.json()).then(j => {
      if (!ativo) return
      if (j.error) { setErro(j.error?.message || 'Não foi possível ler a pasta.'); setItens([]) }
      else setItens(j.files ?? [])
      setLoading(false)
    }).catch(() => { if (ativo) { setErro('Erro de conexão com o Google Drive.'); setLoading(false) } })
    return () => { ativo = false }
  }, [atual.id, apiKey])

  function abrir(it: Item) {
    if (it.mimeType === FOLDER) { setPilha(p => [...p, { id: it.id, name: it.name }]); return }
    // Link direto: o dispositivo abre com a ferramenta dele (galeria/player/pdf).
    const link = it.webContentLink || it.webViewLink || `https://drive.google.com/uc?id=${it.id}`
    window.open(link, '_blank', 'noopener')
  }
  function voltar() { setPilha(p => (p.length > 1 ? p.slice(0, -1) : p)) }

  return (
    <div>
      {/* Voltar + caminho + tamanho */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <button onClick={voltar} disabled={pilha.length <= 1} className="btn btn-ghost btn-sm" style={{ opacity: pilha.length <= 1 ? 0.5 : 1 }}>
          <span className="icon icon-sm">arrow_back</span> Voltar
        </button>
        <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {pilha.map((p, i) => (
            <span key={p.id + i}>
              {i > 0 && ' / '}
              <button onClick={() => setPilha(pk => pk.slice(0, i + 1))}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: i === pilha.length - 1 ? 'var(--text)' : 'var(--primary)', fontWeight: i === pilha.length - 1 ? 700 : 500, fontFamily: 'inherit', fontSize: 12 }}>{p.name}</button>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setCol(c => Math.max(80, c - 40))} className="btn btn-ghost btn-sm" title="Diminuir" style={{ minWidth: 36, fontWeight: 800, fontSize: 18, padding: '2px 8px', lineHeight: 1 }}>−</button>
          <button onClick={() => setCol(c => Math.min(320, c + 40))} className="btn btn-ghost btn-sm" title="Aumentar" style={{ minWidth: 36, fontWeight: 800, fontSize: 18, padding: '2px 8px', lineHeight: 1 }}>+</button>
        </div>
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, padding: '24px 0' }}>Carregando...</p>
      ) : erro ? (
        <div className="alert-box alert-error" style={{ fontSize: 13 }}>{erro}</div>
      ) : itens.length === 0 ? (
        <div className="empty"><p className="empty-title">Pasta vazia</p></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${col}px, 1fr))`, gap: 10 }}>
          {itens.map(it => {
            const pasta = it.mimeType === FOLDER
            const temThumb = !!it.thumbnailLink && !falhou.has(it.id)
            return (
              <button key={it.id} onClick={() => abrir(it)}
                style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 8, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ width: '100%', aspectRatio: '1', borderRadius: 8, background: pasta ? 'var(--primary-light)' : 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {pasta
                    ? <span style={{ fontSize: Math.round(col * 0.4) }}>📁</span>
                    : temThumb
                      ? <img src={it.thumbnailLink} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setFalhou(s => new Set(s).add(it.id))} />
                      : <span style={{ fontSize: Math.round(col * 0.36) }}>{iconFor(it.mimeType)}</span>}
                </div>
                <span style={{ fontSize: Math.max(11, Math.round(col * 0.1)), fontWeight: pasta ? 700 : 500, width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}>{it.name}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
