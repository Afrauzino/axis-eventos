// Miniatura quadrada de um documento — mostra a 1ª página encolhida.
// Não é foto: é a MESMA folha da impressão, só escalada. Então nunca fica
// desatualizada e não precisa gerar imagem nenhuma.
import { PX_POR_MM, type Documento } from '../tipos'
import Folha from './Folha'

export default function Miniatura({ doc, dados, lado = 130 }: {
  doc: Documento
  dados?: Record<string, any>
  lado?: number
}) {
  const pagina = doc.paginas[0]
  if (!pagina) return null

  const larguraPx = doc.papel.largura * PX_POR_MM
  const alturaPx = doc.papel.altura * PX_POR_MM
  const escala = Math.min(lado / larguraPx, lado / alturaPx)   // cabe inteira no quadrado

  return (
    <div style={{ width: lado, height: lado, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{
        width: larguraPx * escala, height: alturaPx * escala,
        position: 'relative', overflow: 'hidden', flexShrink: 0,
        boxShadow: '0 1px 6px rgba(0,0,0,0.18)', background: 'white',
      }}>
        <div style={{ transform: `scale(${escala})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }}>
          <Folha doc={doc} pagina={pagina} dados={dados} modo="papel" />
        </div>
      </div>
    </div>
  )
}
