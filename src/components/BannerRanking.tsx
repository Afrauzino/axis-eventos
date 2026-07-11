import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { carregarConfig } from '../lib/tema'

// Banner na tela Início: aparece enquanto a votação do Ranking está ABERTA.
export default function BannerRanking() {
  const [aberto, setAberto] = useState(false)
  const navigate = useNavigate()
  useEffect(() => { let a = true; carregarConfig('ranking_aberto').then(v => { if (a) setAberto(v === '1') }); return () => { a = false } }, [])
  if (!aberto) return null
  return (
    <button onClick={() => navigate('/ranking')}
      style={{ width: '100%', textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', border: 'none', background: 'linear-gradient(135deg,#F6AD55,#ED8936)', borderRadius: 14, padding: '14px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 4px 14px rgba(237,137,54,0.35)' }}>
      <span style={{ fontSize: 28 }}>🏆</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 15, fontWeight: 800, color: 'white' }}>Votação do Ranking aberta!</p>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.92)' }}>Toque para votar nos destaques do encontro.</p>
      </div>
      <span style={{ fontFamily: "'Material Symbols Outlined'", fontSize: 22, color: 'white', fontVariationSettings: "'FILL' 0, 'wght' 400" }}>chevron_right</span>
    </button>
  )
}
