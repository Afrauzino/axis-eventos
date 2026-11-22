// Manifesto PWA de cada link do Palco ↔ Mesa (/ped, /mesa, /cel).
// Cada link vira um APP próprio na tela inicial (Android e iOS) que abre direto
// naquele pedal/monitor — por isso start_url/scope/id levam o token do link.
// Não consulta o banco: só monta o JSON. Quem não tem o token não ganha nada aqui.
export default function handler(req, res) {
  const tipo = String(req.query.tipo || '')
  const t = String(req.query.t || '').toLowerCase()
  if (!['ped', 'mesa', 'cel'].includes(tipo) || !/^[0-9a-f]{32}$/.test(t)) {
    res.status(400).json({ error: 'invalido' })
    return
  }
  const padrao = { ped: 'Pedal do palco', mesa: 'Mesa de som', cel: 'Palco ↔ Mesa' }[tipo]
  const curto = { ped: 'Pedal', mesa: 'Mesa', cel: 'Palco' }[tipo]
  const extra = String(req.query.n || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 40)
  const caminho = `/${tipo}/${t}`
  const manifest = {
    id: caminho,
    name: extra ? `${padrao} · ${extra}` : padrao,
    short_name: (extra && tipo === 'ped' ? extra : curto).slice(0, 12),
    description: 'Comunicação entre o palco e a mesa de som — AXIS Eventos',
    start_url: caminho,
    scope: caminho,
    display: 'standalone',
    display_override: ['fullscreen', 'standalone'],
    orientation: tipo === 'cel' ? 'portrait' : 'any',
    background_color: '#05070d',
    theme_color: '#05070d',
    icons: [
      { src: '/axis-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/axis-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  }
  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8')
  res.setHeader('Cache-Control', 'private, max-age=3600')
  res.setHeader('X-Robots-Tag', 'noindex')
  res.status(200).send(JSON.stringify(manifest))
}
