import { useEffect, useState } from 'react'
import { carregarConfig, salvarConfig } from '../lib/tema'
import { useVoltarFecha } from '../hooks/useVoltarFecha'
import { toast } from './Toast'

// Playlist do Spotify embutida na tela inicial.
// O admin cola o link de uma playlist/álbum do Spotify; toca dentro do app.
// Visível a todos; edição só para admin.

const CHAVE = 'home_playlist_url'

// Converte qualquer link/URI do Spotify no endereço de EMBED do player oficial.
function spotifyEmbed(raw: string): string | null {
  if (!raw) return null
  const s = raw.trim()
  // spotify:playlist:ID
  let m = /spotify:(playlist|album|track|artist|show|episode):([A-Za-z0-9]+)/.exec(s)
  if (m) return `https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=generator`
  // https://open.spotify.com/[embed/]{tipo}/{id}
  m = /open\.spotify\.com\/(?:intl-[a-z]+\/)?(?:embed\/)?(playlist|album|track|artist|show|episode)\/([A-Za-z0-9]+)/.exec(s)
  if (m) return `https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=generator`
  return null
}

export default function PlaylistHome({ admin }: { admin: boolean }) {
  const [url, setUrl] = useState<string>('')          // link salvo
  const [carregado, setCarregado] = useState(false)
  const [editando, setEditando] = useState(false)
  const [rascunho, setRascunho] = useState('')        // link sendo digitado
  const [salvando, setSalvando] = useState(false)
  useVoltarFecha(editando, () => setEditando(false))

  useEffect(() => {
    carregarConfig(CHAVE).then(v => { setUrl(v ?? ''); setCarregado(true) })
  }, [])

  const embed = spotifyEmbed(url)

  async function salvar() {
    const limpo = rascunho.trim()
    if (limpo && !spotifyEmbed(limpo)) {
      toast.aviso('Link do Spotify inválido. Copie o link de uma playlist/álbum do Spotify.')
      return
    }
    setSalvando(true)
    const ok = await salvarConfig(CHAVE, limpo)
    setSalvando(false)
    if (!ok) { toast.falha('Não foi possível salvar a playlist.'); return }
    setUrl(limpo)
    setEditando(false)
    toast.sucesso(limpo ? 'Playlist atualizada!' : 'Playlist removida.')
  }

  function abrirEdicao() { setRascunho(url); setEditando(true) }

  // Nada salvo e sem poder editar → não ocupa espaço
  if (carregado && !embed && !admin) return null
  if (!carregado) return null

  return (
    <div style={{ background: 'white', borderRadius: 14, boxShadow: 'var(--shadow-sm)', overflow: 'hidden', marginBottom: 16 }}>
      {/* Cabeçalho na cor do sistema */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'linear-gradient(135deg,var(--primary),var(--primary-dark))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ fontSize: 20 }}>🎵</span>
          <div>
            <p style={{ fontWeight: 800, fontSize: 15, color: 'white', lineHeight: 1.1 }}>Playlist do Encontro</p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>Trilha sonora oficial</p>
          </div>
        </div>
        {admin && (
          <button onClick={abrirEdicao} title="Editar playlist"
            style={{ background: 'rgba(255,255,255,0.22)', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontFamily: 'inherit' }}>
            <span className="icon icon-sm">edit</span>
          </button>
        )}
      </div>

      {/* Player ou estado vazio (admin) */}
      {embed ? (
        <div style={{ padding: 10 }}>
          <iframe
            title="Spotify"
            src={embed}
            width="100%"
            height={352}
            frameBorder={0}
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
            style={{ borderRadius: 12, display: 'block', border: 'none' }}
          />
          {/* No app o player toca só prévia (30s) quando o usuário não está logado no Spotify.
              Este botão abre a playlist no Spotify pra ouvir completo. */}
          <a href={url} target="_blank" rel="noreferrer"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8, textDecoration: 'none', background: 'var(--primary)', color: 'white', borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: 800, fontFamily: 'inherit' }}>
            <span className="icon icon-sm">open_in_new</span> Abrir no Spotify (ouvir completo)
          </a>
        </div>
      ) : admin ? (
        <div style={{ padding: '22px 16px', textAlign: 'center' }}>
          <p style={{ fontSize: 28, marginBottom: 8 }}>🎧</p>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>Nenhuma playlist adicionada ainda.</p>
          <button onClick={abrirEdicao}
            style={{ background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 8, padding: '9px 20px', cursor: 'pointer', fontSize: 13, fontWeight: 800, fontFamily: 'inherit' }}>
            Adicionar playlist do Spotify
          </button>
        </div>
      ) : null}

      {/* Bottom-sheet de edição (admin) */}
      {editando && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 400, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
          onClick={e => e.target === e.currentTarget && setEditando(false)}>
          <div style={{ background: 'white', borderRadius: '20px 20px 0 0', padding: '8px 20px 28px', maxWidth: 480, width: '100%', margin: '0 auto', maxHeight: '88vh', overflowY: 'auto' }}>
            <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 2, margin: '12px auto 16px' }} />
            <p style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>Playlist do Spotify</p>
            <p className="form-hint" style={{ marginBottom: 14 }}>
              No Spotify: abra a playlist → <b>···</b> → <b>Compartilhar</b> → <b>Copiar link</b>. Cole aqui embaixo.
            </p>
            <label className="form-label">Link da playlist</label>
            <input className="form-input" value={rascunho} onChange={e => setRascunho(e.target.value)}
              placeholder="https://open.spotify.com/playlist/..." autoFocus style={{ marginBottom: 8 }} />
            {rascunho.trim() && !spotifyEmbed(rascunho) && (
              <p style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 8 }}>Link inválido — precisa ser um link do Spotify.</p>
            )}

            {/* Prévia */}
            {spotifyEmbed(rascunho) && (
              <div style={{ margin: '4px 0 14px' }}>
                <p className="form-label">Prévia</p>
                <iframe title="Prévia Spotify" src={spotifyEmbed(rascunho)!} width="100%" height={152} frameBorder={0}
                  allow="encrypted-media" loading="lazy" style={{ borderRadius: 12, display: 'block', border: 'none' }} />
              </div>
            )}

            <button className="btn btn-primary btn-full" onClick={salvar} disabled={salvando} style={{ marginBottom: 8 }}>
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
            {url && (
              <button className="btn btn-ghost btn-full" style={{ color: 'var(--danger)' }} onClick={() => { setRascunho(''); }}>
                Limpar link
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
