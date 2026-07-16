import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useEvento } from '../hooks/useEvento'
import { carregarConfig } from '../lib/tema'
import PrintOverlay from './PrintOverlay'
import { getInitials } from '../utils'

// FICHA DE CADASTRO — cópia do modelo de papel que o Anderson já usa, agora
// PRÉ-PREENCHIDA com o que a pessoa informou na inscrição online. O processo é:
// a pessoa se inscreve → alguém imprime → colhe a assinatura. Quem gosta do
// físico continua com o papel; ninguém reescreve o que já está cadastrado.
//
// Diferenças que vieram do modelo dele (e NÃO do meu chute):
//   - Encontreiro: termo na FRENTE + "( ) Concordo ( ) Discordo" (1 folha).
//   - Encontrista: dados na frente + TERMO DE COMPROMISSO no VERSO (2 folhas).
//   - Controle de Pagamento: tabela em BRANCO (é preenchida à caneta).
//   - Foto: não existe no papel dele; entra porque ele pediu.
//
// Os textos dos termos vêm de Administração → Termos do evento (chaves
// termo_encontrista / termo_encontreiro). {{nome}} no texto vira o nome da pessoa.

type Pessoa = {
  id: string; name: string; photo_url: string | null; role_type: string
  phone: string | null; phone2: string | null
  contact_phone: string | null; contact_phone_dono: string | null
  contact_phone2: string | null; contact_phone2_dono: string | null
  church: string | null; sexo: string | null; birth_date: string | null
  estado_civil: string | null; cpf: string | null; rg: string | null
  cidade: string | null; estado: string | null; endereco: string | null
  bairro: string | null; cep: string | null; ano_encontro: number | null
  cargo: string | null; instagram: string | null; facebook: string | null; rede_outra: string | null
}

const EST_CIVIL: Record<string, string> = {
  solteiro: 'Solteiro(a)', casado: 'Casado(a)', divorciado: 'Divorciado(a)',
  viuvo: 'Viúvo(a)', uniao: 'União estável',
}

function dataBR(iso: string | null): string {
  if (!iso) return ''
  const [a, m, d] = iso.slice(0, 10).split('-')
  return a && m && d ? `${d}/${m}/${a}` : ''
}

// Linha do modelo de papel: rótulo em negrito + o valor JÁ PREENCHIDO sobre a
// linha. Sem valor, a linha continua lá pra preencher à caneta.
function Linha({ label, valor, flex = 1 }: { label: string; valor?: string | null; flex?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, flex, minWidth: 0 }}>
      <span style={{ fontSize: 9.5, fontWeight: 700, whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ flex: 1, minWidth: 0, borderBottom: '1px solid #111827', fontSize: 9.5, paddingBottom: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {valor && valor.trim() ? valor : ' '}
      </span>
    </div>
  )
}

function Cabecalho({ evento }: { evento: string }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: 10 }}>
      <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.02em', margin: 0, fontVariant: 'small-caps' }}>Ficha de Cadastro</p>
      <p style={{ fontSize: 19, fontWeight: 900, letterSpacing: '.01em', margin: '2px 0 0' }}>{evento}</p>
      <div style={{ borderBottom: '2px solid #111827', width: '55%', margin: '5px auto 0' }} />
    </div>
  )
}

function Pagamento({ valor }: { valor: string }) {
  return (
    <div style={{ marginTop: 8 }}>
      <p style={{ fontSize: 10.5, fontWeight: 800, margin: '0 0 4px' }}>
        Controle de Pagamento:{valor.trim() ? <span style={{ fontWeight: 700 }}> (valor: {valor})</span> : null}
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9 }}>
        <thead>
          <tr>{['DATA', 'VALOR PAGO', 'FALTA PAGAR'].map(h => (
            <th key={h} style={{ border: '1px solid #111827', padding: '3px 4px', fontWeight: 800, textAlign: 'center' }}>{h}</th>
          ))}</tr>
        </thead>
        <tbody>
          {[0, 1, 2, 3].map(i => (
            <tr key={i}>{[0, 1, 2].map(j => (
              <td key={j} style={{ border: '1px solid #111827', height: 17 }} />
            ))}</tr>
          ))}
        </tbody>
      </table>
      <p style={{ fontSize: 10.5, fontWeight: 800, textAlign: 'center', margin: '6px 0 0' }}>
        <span style={{ display: 'inline-block', width: 11, height: 11, border: '1.5px solid #111827', verticalAlign: '-1px', marginRight: 5 }} />
        Valor total pago
      </p>
    </div>
  )
}

function Assinatura({ nome }: { nome: string }) {
  return (
    <div style={{ marginTop: 'auto', paddingTop: 12 }}>
      <div style={{ display: 'flex', gap: 18, alignItems: 'flex-end' }}>
        <div style={{ flex: 2, borderTop: '1px solid #111827', paddingTop: 3 }}>
          <p style={{ fontSize: 8.5, fontWeight: 700, margin: 0, textAlign: 'center' }}>Assinatura</p>
          <p style={{ fontSize: 8, color: '#4b5563', margin: 0, textAlign: 'center' }}>{nome}</p>
        </div>
        <div style={{ flex: 1, borderTop: '1px solid #111827', paddingTop: 3 }}>
          <p style={{ fontSize: 8.5, fontWeight: 700, margin: 0, textAlign: 'center' }}>Data</p>
          <p style={{ fontSize: 8, color: '#4b5563', margin: 0, textAlign: 'center' }}>____/____/________</p>
        </div>
      </div>
    </div>
  )
}

const folha: React.CSSProperties = {
  fontFamily: 'Arial, Helvetica, sans-serif', color: '#111827',
  display: 'flex', flexDirection: 'column', minHeight: '252mm',
}

// FRENTE — dados. Encontreiro leva o termo aqui (é assim no papel dele).
function Frente({ p, evento, termo, valor }: { p: Pessoa; evento: string; termo: string; valor: string }) {
  const ehEnc = p.role_type === 'encounterer'
  return (
    <div style={folha}>
      <Cabecalho evento={evento} />

      <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Linha label="Nome completo:" valor={p.name} />
          <Linha label="Cargo ministerial:" valor={p.cargo} />
          {ehEnc ? (
            <>
              <div style={{ display: 'flex', gap: 8 }}>
                <Linha label="Data de nascimento:" valor={dataBR(p.birth_date)} />
                <Linha label="Estado civil:" valor={p.estado_civil ? (EST_CIVIL[p.estado_civil] ?? p.estado_civil) : ''} />
              </div>
              <Linha label="Endereço:" valor={[p.endereco, p.bairro].filter(Boolean).join(', ')} />
              <Linha label="" valor={[p.cidade, p.estado, p.cep].filter(Boolean).join(' — ')} />
            </>
          ) : (
            <Linha label="WhatsApp:" valor={p.phone} />
          )}
        </div>
        {/* Foto — não existe no papel dele; entra porque ele pediu */}
        <div style={{ width: '26mm', height: '34mm', flexShrink: 0, border: '1.5px solid #111827', overflow: 'hidden', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {p.photo_url
            ? <img src={p.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontSize: 20, fontWeight: 800, color: '#9ca3af' }}>{getInitials(p.name)}</span>}
        </div>
      </div>

      {ehEnc && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
            <Linha label="Tel. p/ contato:" valor={p.phone} />
            <Linha label="ou" valor={p.phone2} />
          </div>
          <p style={{ fontSize: 10, fontWeight: 800, margin: '0 0 1px' }}>Tel. p/ recados ou contato de emergência:</p>
          <p style={{ fontSize: 8.2, fontStyle: 'italic', color: '#4b5563', margin: '0 0 4px' }}>
            *Ex: Tel. de familiares ou amigos (na frente do telefone coloque o nome da pessoa proprietária do número).
          </p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
            <Linha label="" valor={p.contact_phone} />
            <Linha label="pertence à:" valor={p.contact_phone_dono} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <Linha label="" valor={p.contact_phone2} />
            <Linha label="pertence à:" valor={p.contact_phone2_dono} />
          </div>

          <p style={{ fontSize: 10.5, fontWeight: 800, margin: '0 0 3px' }}>
            Redes sociais <span style={{ fontSize: 8.5, fontStyle: 'italic', fontWeight: 400 }}>(nome de perfil e o @ do instagram)</span>
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 8 }}>
            <Linha label="Facebook:" valor={p.facebook} />
            <Linha label="Instagram:" valor={p.instagram} />
            <Linha label="Outra que desejar:" valor={p.rede_outra} />
          </div>
        </>
      )}

      {/* Encontreiro: o termo vai na frente, com o Concordo/Discordo (modelo dele) */}
      {!ehEnc && termo.trim() && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 9, lineHeight: 1.45, whiteSpace: 'pre-wrap', marginBottom: 6 }}>{termo}</div>
          <p style={{ fontSize: 10.5, fontWeight: 800, margin: 0 }}>
            (&nbsp;&nbsp;) Concordo&nbsp;&nbsp;&nbsp;(&nbsp;&nbsp;) Discordo
          </p>
        </div>
      )}

      <Pagamento valor={valor} />
      <Assinatura nome={p.name} />
    </div>
  )
}

// VERSO — só do encontrista: o TERMO DE COMPROMISSO (é assim no papel dele)
function Verso({ p, evento, termo }: { p: Pessoa; evento: string; termo: string }) {
  return (
    <div style={{ ...folha, textAlign: 'center' }}>
      <p style={{ fontSize: 14, fontWeight: 900, letterSpacing: '.06em', margin: '10mm 0 8mm' }}>TERMO DE COMPROMISSO</p>
      <div style={{ fontSize: 11, lineHeight: 1.7, whiteSpace: 'pre-wrap', textAlign: 'center', padding: '0 8mm' }}>
        {termo.replace(/\{\{\s*nome\s*\}\}/gi, p.name)}
      </div>
      <div style={{ margin: '16mm auto 0', width: '70%' }}>
        <div style={{ borderTop: '1px solid #111827', paddingTop: 4 }}>
          <p style={{ fontSize: 9.5, fontWeight: 700, margin: 0 }}>Assinatura do declarante</p>
          <p style={{ fontSize: 9, color: '#4b5563', margin: 0 }}>{p.name}</p>
        </div>
      </div>
      <div style={{ marginTop: 'auto', paddingTop: 10 }}>
        <p style={{ fontSize: 15, fontWeight: 900, margin: 0 }}>{evento}</p>
      </div>
    </div>
  )
}

export default function ImprimirFicha({ onClose, pessoaId }: { onClose: () => void; pessoaId?: string }) {
  const { evento } = useEvento()
  const [lista, setLista] = useState<Pessoa[]>([])
  const [loading, setLoading] = useState(true)
  const [tipo, setTipo] = useState<'todos' | 'encounterer' | 'worker'>('todos')
  const [cidade, setCidade] = useState('todas')
  const [cfg, setCfg] = useState({ tEnc: '', tWor: '', vEnc: '', vWor: '' })

  useEffect(() => {
    if (!evento) { setLoading(false); return }
    let ativo = true
    ;(async () => {
      const base = 'id,name,photo_url,role_type,phone,contact_phone,church,sexo,birth_date,cpf,rg,cidade,estado,endereco,bairro,cep,ano_encontro,cargo'
      const novos = ',instagram,facebook,rede_outra,estado_civil,phone2,contact_phone_dono,contact_phone2,contact_phone2_dono'
      // sql/81 e 83 podem não ter rodado — sem eles a ficha ainda sai (campos em branco)
      let r: any = await supabase.from('people').select(base + novos).eq('event_id', evento.id).order('name')
      if (r.error) {
        const r2 = await supabase.from('people').select(base).eq('event_id', evento.id).order('name')
        r = { data: (r2.data ?? []).map((p: any) => ({ ...p, instagram: null, facebook: null, rede_outra: null, estado_civil: null, phone2: null, contact_phone_dono: null, contact_phone2: null, contact_phone2_dono: null })) }
      }
      const [tEnc, tWor, vEnc, vWor] = await Promise.all([
        carregarConfig('termo_encontrista'), carregarConfig('termo_encontreiro'),
        carregarConfig('valor_encontrista'), carregarConfig('valor_encontreiro'),
      ])
      if (!ativo) return
      setCfg({ tEnc: tEnc ?? '', tWor: tWor ?? '', vEnc: vEnc ?? '', vWor: vWor ?? '' })
      setLista((r.data ?? []).filter((p: any) => !pessoaId || p.id === pessoaId))
      setLoading(false)
    })()
    return () => { ativo = false }
  }, [evento, pessoaId])

  // Cidades que realmente existem na lista (pra imprimir "por cidade")
  const cidades = [...new Set(lista.map(p => (p.cidade || '').trim()).filter(Boolean))].sort()
  const visiveis = lista
    .filter(p => tipo === 'todos' || p.role_type === tipo)
    .filter(p => cidade === 'todas' || (p.cidade || '').trim() === cidade)

  // Monta as folhas: encontreiro = 1; encontrista = frente + verso (termo)
  const folhas: { p: Pessoa; verso: boolean }[] = []
  for (const p of visiveis) {
    folhas.push({ p, verso: false })
    if (p.role_type === 'encounterer' && (cfg.tEnc || '').trim()) folhas.push({ p, verso: true })
  }
  const nome = evento?.name ? evento.name.toUpperCase() : 'ENCONTRO COM DEUS'

  return (
    <PrintOverlay titulo={pessoaId ? 'Ficha de cadastro' : `Fichas — ${folhas.length} folha(s)`} onClose={onClose}>
      {!pessoaId && (
        <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', background: '#eef1f4', borderRadius: 10, padding: 3 }}>
            {([['todos', 'Todos'], ['encounterer', 'Encontristas'], ['worker', 'Encontreiros']] as const).map(([v, l]) => (
              <button key={v} type="button" onClick={() => setTipo(v)}
                style={{ border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, padding: '6px 12px', borderRadius: 8, background: tipo === v ? 'white' : 'transparent', color: tipo === v ? '#111827' : '#6b7280', boxShadow: tipo === v ? '0 1px 3px rgba(0,0,0,0.12)' : 'none' }}>{l}</button>
            ))}
          </div>
          {cidades.length > 0 && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: '#6b7280' }}>
              Cidade
              <select className="form-input" value={cidade} onChange={e => setCidade(e.target.value)} style={{ width: 'auto', padding: '5px 8px', fontSize: 12.5 }}>
                <option value="todas">Todas</option>
                {cidades.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          )}
          <span style={{ fontSize: 11.5, color: '#6b7280' }}>
            {visiveis.length} pessoa(s) · {folhas.length} folha(s) · encontrista leva o termo no verso
          </span>
        </div>
      )}

      {loading ? (
        <p style={{ textAlign: 'center', color: '#6b7280', fontSize: 13, padding: '30px 0' }}>Carregando...</p>
      ) : folhas.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#6b7280', fontSize: 13, padding: '30px 0' }}>Ninguém para imprimir com esse filtro.</p>
      ) : folhas.map((f, i) => (
        <div key={f.p.id + (f.verso ? '-v' : '-f')} className={i < folhas.length - 1 ? 'print-break' : undefined}>
          {f.verso
            ? <Verso p={f.p} evento={nome} termo={cfg.tEnc} />
            : <Frente p={f.p} evento={nome}
                termo={f.p.role_type === 'encounterer' ? cfg.tEnc : cfg.tWor}
                valor={f.p.role_type === 'encounterer' ? cfg.vEnc : cfg.vWor} />}
        </div>
      ))}
    </PrintOverlay>
  )
}
