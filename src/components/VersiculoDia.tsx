// Versículo do dia — rotaciona de forma determinística pelo dia do ano.
// Lista embutida (sem internet). Admin pode ampliar depois se quiser.

const VERSICULOS: { t: string; r: string }[] = [
  { t: 'Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito, para que todo aquele que nele crê não pereça, mas tenha a vida eterna.', r: 'João 3:16' },
  { t: 'O Senhor é o meu pastor; nada me faltará.', r: 'Salmos 23:1' },
  { t: 'Tudo posso naquele que me fortalece.', r: 'Filipenses 4:13' },
  { t: 'Entrega o teu caminho ao Senhor; confia nele, e ele tudo fará.', r: 'Salmos 37:5' },
  { t: 'Não temas, porque eu sou contigo; não te assombres, porque eu sou o teu Deus.', r: 'Isaías 41:10' },
  { t: 'Buscai primeiro o reino de Deus, e a sua justiça, e todas estas coisas vos serão acrescentadas.', r: 'Mateus 6:33' },
  { t: 'O choro pode durar uma noite, mas a alegria vem pela manhã.', r: 'Salmos 30:5' },
  { t: 'Lançando sobre ele toda a vossa ansiedade, porque ele tem cuidado de vós.', r: '1 Pedro 5:7' },
  { t: 'Em tudo dai graças, porque esta é a vontade de Deus em Cristo Jesus para convosco.', r: '1 Tessalonicenses 5:18' },
  { t: 'O Senhor é a minha força e o meu escudo; nele confiou o meu coração.', r: 'Salmos 28:7' },
  { t: 'Confia no Senhor de todo o teu coração e não te estribes no teu próprio entendimento.', r: 'Provérbios 3:5' },
  { t: 'Posso todas as coisas, mas nem todas convêm. Tudo me é permitido, mas eu não me deixarei dominar por nenhuma.', r: '1 Coríntios 6:12' },
  { t: 'Eu vim para que tenham vida e a tenham com abundância.', r: 'João 10:10' },
  { t: 'Combati o bom combate, acabei a carreira, guardei a fé.', r: '2 Timóteo 4:7' },
  { t: 'A minha graça te basta, porque o meu poder se aperfeiçoa na fraqueza.', r: '2 Coríntios 12:9' },
  { t: 'Vinde a mim, todos os que estais cansados e oprimidos, e eu vos aliviarei.', r: 'Mateus 11:28' },
  { t: 'Porque para Deus nada é impossível.', r: 'Lucas 1:37' },
  { t: 'O amor é sofredor, é benigno; o amor não é invejoso.', r: '1 Coríntios 13:4' },
  { t: 'Deleita-te também no Senhor, e ele te concederá o que deseja o teu coração.', r: 'Salmos 37:4' },
  { t: 'Mas os que esperam no Senhor renovarão as suas forças; subirão com asas como águias.', r: 'Isaías 40:31' },
  { t: 'Seja forte e corajoso! Não se apavore, nem desanime, pois o Senhor, o seu Deus, estará com você por onde você andar.', r: 'Josué 1:9' },
  { t: 'Aquietai-vos e sabei que eu sou Deus.', r: 'Salmos 46:10' },
  { t: 'Se Deus é por nós, quem será contra nós?', r: 'Romanos 8:31' },
  { t: 'O Senhor pelejará por vós, e vós vos calareis.', r: 'Êxodo 14:14' },
  { t: 'A palavra de Deus é viva e eficaz, e mais penetrante do que espada alguma de dois gumes.', r: 'Hebreus 4:12' },
  { t: 'Bendize, ó minha alma, ao Senhor, e não te esqueças de nenhum dos seus benefícios.', r: 'Salmos 103:2' },
  { t: 'Onde estiver o teu tesouro, aí estará também o teu coração.', r: 'Mateus 6:21' },
  { t: 'E conhecereis a verdade, e a verdade vos libertará.', r: 'João 8:32' },
  { t: 'O Senhor é bom, é fortaleza no dia da angústia, e conhece os que confiam nele.', r: 'Naum 1:7' },
  { t: 'Alegrai-vos sempre no Senhor; outra vez digo: alegrai-vos.', r: 'Filipenses 4:4' },
  { t: 'Ainda que eu andasse pelo vale da sombra da morte, não temeria mal algum, porque tu estás comigo.', r: 'Salmos 23:4' },
]

function diaDoAno(): number {
  const agora = new Date()
  const inicio = new Date(agora.getFullYear(), 0, 0)
  const diff = agora.getTime() - inicio.getTime()
  return Math.floor(diff / 86400000)
}

export default function VersiculoDia() {
  const v = VERSICULOS[diaDoAno() % VERSICULOS.length]
  return (
    <div style={{ background: 'linear-gradient(135deg,#4C51BF,#553C9A)', borderRadius: 14, padding: '18px 18px 16px', marginBottom: 16, boxShadow: '0 4px 14px rgba(0,0,0,0.15)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
        <span style={{ fontSize: 16 }}>📖</span>
        <span style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Versículo do dia</span>
      </div>
      <p style={{ fontSize: 15, color: 'white', lineHeight: 1.5, fontStyle: 'italic' }}>"{v.t}"</p>
      <p style={{ fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,0.9)', marginTop: 10, textAlign: 'right' }}>— {v.r}</p>
    </div>
  )
}
