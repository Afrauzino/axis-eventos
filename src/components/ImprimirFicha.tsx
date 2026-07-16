import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useEvento } from '../hooks/useEvento'
import { carregarConfig } from '../lib/tema'
import PrintOverlay from './PrintOverlay'
import { getInitials } from '../utils'

// FICHA DE INSCRIÇÃO — UMA POR FOLHA, com foto, os dados da pessoa, os TERMOS
// e o VALOR, e a linha de assinatura no pé.
//
// Encontrista e encontreiro são coisas diferentes: cada um tem o SEU texto de
// termo e o SEU valor. Os dois vêm de `configuracoes` (chave/valor) e são
// editados em Administração → Ficha de inscrição — nada hardcoded aqui, porque
// termo e preço mudam a cada encontro.
//
// Fica no Cadastros de propósito: quem cadastra imprime, sem precisar de acesso
// ao Administrativo.

type Pessoa = {
  id: string; name: string; photo_url: string | null; role_type: string
  phone: string | null; contact_phone: string | null; church: string | null
  sexo: string | null; birth_date: string | null; cpf: string | null; rg: string | null
  cidade: string | null; estado: string | null; endereco: string | null
  bairro: string | null; cep: string | null; ano_encontro: number | null
  cargo: string | null; instagram: string | null; facebook: string | null
}

const ROLE_LABEL: Record<string, string> = { encounterer: 'ENCONTRISTA', worker: 'ENCONTREIRO' }

// Data BR sem cair na armadilha do fuso (birth_date vem 'YYYY-MM-DD')
function dataBR(iso: string | null): string {
  if (!iso) return ''
  const [a, m, d] = iso.slice(0, 10).split('-')
  return a && m && d ? `${d}/${m}/${a}` : ''
}
const naoInformado = '—'
const ou = (v: string | null | undefined) => (v && String(v).trim()) ? String(v).trim() : naoInformado

function Campo({ label, valor, larg }: { label: string; valor: string; larg?: string }) {
  return (
    <div style={{ width: larg ?? 'auto', flex: larg ? 'none' : 1, minWidth: 0 }}>
      <p style={{ fontSize: 7.5, fontWeight: 700, color: '#6b7280', letterSpacing: '.06em', margin: 0 }}>{label}</p>
      <p style={{ fontSize: 10.5, fontWeight: 600, color: '#111827', margin: '1px 0 0',
        borderBottom: '1px solid #d1d5db', paddingBottom: 2, minHeight: 14,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{valor}</p>
    </div>
  )
}

function Ficha({ p, evento, termos, valor }: { p: Pessoa; evento: string; termos: string; valor: string }) {
  const ehEnc = p.role_type === 'encounterer'
  const cor = ehEnc ? '#6B46C1' : '#00A99D'
  return (
    <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', color: '#111827', display: 'flex', flexDirection: 'column', minHeight: '252mm' }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `2.5px solid ${cor}`, paddingBottom: 6, marginBottom: 10 }}>
        <div>
          <p style={{ fontSize: 15, fontWeight: 900, letterSpacing: '-0.01em', margin: 0 }}>{evento}</p>
          <p style={{ fontSize: 9.5, color: '#6b7280', margin: '1px 0 0' }}>Ficha de inscrição</p>
        </div>
        <span style={{ fontSize: 11, fontWeight: 900, color: 'white', background: cor, padding: '4px 12px', borderRadius: 6, letterSpacing: '.08em' }}>
          {ROLE_LABEL[p.role_type] ?? p.role_type.toUpperCase()}
        </span>
      </div>

      {/* Foto + identificação */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <div style={{ width: '30mm', height: '40mm', flexShrink: 0, border: `1.5px solid ${cor}`, borderRadius: 4, overflow: 'hidden', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {p.photo_url
            ? <img src={p.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontSize: 26, fontWeight: 800, color: '#9ca3af' }}>{getInitials(p.name)}</span>}
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div>
            <p style={{ fontSize: 7.5, fontWeight: 700, color: '#6b7280', letterSpacing: '.06em', margin: 0 }}>NOME COMPLETO</p>
            <p style={{ fontSize: 15, fontWeight: 800, margin: '1px 0 0', borderBottom: '1px solid #d1d5db', paddingBottom: 2 }}>{p.name}</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Campo label="NASCIMENTO" valor={dataBR(p.birth_date) || naoInformado} />
            <Campo label="SEXO" valor={p.sexo === 'M' ? 'Masculino' : p.sexo === 'F' ? 'Feminino' : naoInformado} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Campo label="CPF" valor={ou(p.cpf)} />
            <Campo label="RG" valor={ou(p.rg)} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Campo label="CELULAR" valor={ou(p.phone)} />
            <Campo label="CONTATO DE EMERGÊNCIA" valor={ou(p.contact_phone)} />
          </div>
        </div>
      </div>

      {/* Endereço */}
      <p style={{ fontSize: 8.5, fontWeight: 800, color: cor, letterSpacing: '.08em', margin: '0 0 5px' }}>ENDEREÇO</p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 7 }}>
        <Campo label="RUA, NÚMERO, COMPLEMENTO" valor={ou(p.endereco)} />
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <Campo label="BAIRRO" valor={ou(p.bairro)} />
        <Campo label="CIDADE" valor={ou(p.cidade)} />
        <Campo label="UF" valor={ou(p.estado)} larg="14mm" />
        <Campo label="CEP" valor={ou(p.cep)} larg="24mm" />
      </div>

      {/* Igreja / extras */}
      <p style={{ fontSize: 8.5, fontWeight: 800, color: cor, letterSpacing: '.08em', margin: '0 0 5px' }}>IGREJA E CONTATO</p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 7 }}>
        <Campo label="IGREJA" valor={ou(p.church)} />
        <Campo label="ANO QUE PASSOU PELO ENCONTRO" valor={p.ano_encontro ? String(p.ano_encontro) : naoInformado} larg="42mm" />
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <Campo label="INSTAGRAM" valor={ou(p.instagram)} />
        <Campo label="FACEBOOK" valor={ou(p.facebook)} />
        {!ehEnc && <Campo label="CARGO / FUNÇÃO" valor={ou(p.cargo)} />}
      </div>

      {/* VALOR */}
      {valor.trim() && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, border: `1.5px solid ${cor}`, borderRadius: 6, padding: '8px 12px', marginBottom: 10, background: cor + '10' }}>
          <span style={{ fontSize: 8.5, fontWeight: 800, color: cor, letterSpacing: '.08em' }}>VALOR A SER PAGO</span>
          <span style={{ fontSize: 17, fontWeight: 900, color: '#111827' }}>{valor}</span>
        </div>
      )}

      {/* TERMOS */}
      {termos.trim() && (
        <div style={{ flex: 1, marginBottom: 10 }}>
          <p style={{ fontSize: 8.5, fontWeight: 800, color: cor, letterSpacing: '.08em', margin: '0 0 4px' }}>
            TERMOS {ehEnc ? '— ENCONTRISTA' : '— ENCONTREIRO'}
          </p>
          <div style={{ border: '1px solid #d1d5db', borderRadius: 4, padding: '8px 10px', fontSize: 8.6, lineHeight: 1.5, color: '#374151', whiteSpace: 'pre-wrap' }}>
            {termos}
          </div>
        </div>
      )}

      {/* ASSINATURA — sempre no pé da folha */}
      <div style={{ marginTop: 'auto', paddingTop: 14 }}>
        <p style={{ fontSize: 8.6, color: '#374151', margin: '0 0 18px', lineHeight: 1.5 }}>
          Declaro que li e aceito os termos acima, e que as informações desta ficha são verdadeiras.
        </p>
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-end' }}>
          <div style={{ flex: 2 }}>
            <div style={{ borderTop: '1px solid #111827', paddingTop: 3 }}>
              <p style={{ fontSize: 8.5, fontWeight: 700, margin: 0 }}>Assinatura</p>
              <p style={{ fontSize: 8, color: '#6b7280', margin: 0 }}>{p.name}</p>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ borderTop: '1px solid #111827', paddingTop: 3 }}>
              <p style={{ fontSize: 8.5, fontWeight: 700, margin: 0 }}>Data</p>
              <p style={{ fontSize: 8, color: '#6b7280', margin: 0 }}>____/____/________</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ImprimirFicha({ onClose, pessoaId }: { onClose: () => void; pessoaId?: string }) {
  const { evento } = useEvento()
  const [lista, setLista] = useState<Pessoa[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'todos' | 'encounterer' | 'worker'>('todos')
  const [cfg, setCfg] = useState<{ tEnc: string; tWor: string; vEnc: string; vWor: string }>({ tEnc: '', tWor: '', vEnc: '', vWor: '' })

  useEffect(() => {
    if (!evento) { setLoading(false); return }
    let ativo = true
    ;(async () => {
      const campos = 'id,name,photo_url,role_type,phone,contact_phone,church,sexo,birth_date,cpf,rg,cidade,estado,endereco,bairro,cep,ano_encontro,cargo'
      // instagram/facebook só existem depois do sql/81 — sem eles a ficha ainda sai
      let r: any = await supabase.from('people').select(campos + ',instagram,facebook').eq('event_id', evento.id).order('name')
      if (r.error) {
        const r2 = await supabase.from('people').select(campos).eq('event_id', evento.id).order('name')
        r = { data: (r2.data ?? []).map((p: any) => ({ ...p, instagram: null, facebook: null })) }
      }
      // Reaproveita os termos que o Anderson JÁ escreve em Administração → Termos
      // (chaves termo_encontrista / termo_encontreiro, que já existiam). Os valores
      // são novos e ficam ao lado deles, na mesma tela.
      const [tEnc, tWor, vEnc, vWor] = await Promise.all([
        carregarConfig('termo_encontrista'),
        carregarConfig('termo_encontreiro'),
        carregarConfig('valor_encontrista'),
        carregarConfig('valor_encontreiro'),
      ])
      if (!ativo) return
      setCfg({ tEnc: tEnc ?? '', tWor: tWor ?? '', vEnc: vEnc ?? '', vWor: vWor ?? '' })
      setLista((r.data ?? []).filter((p: any) => !pessoaId || p.id === pessoaId))
      setLoading(false)
    })()
    return () => { ativo = false }
  }, [evento, pessoaId])

  const visiveis = lista.filter(p => filtro === 'todos' || p.role_type === filtro)
  const nome = evento?.name ? evento.name.toUpperCase() : 'ENCONTRO'

  return (
    <PrintOverlay titulo={pessoaId ? 'Ficha de inscrição' : `Fichas — ${visiveis.length} folha(s)`} onClose={onClose}>
      {!pessoaId && (
        <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#6b7280' }}>Imprimir</span>
          <div style={{ display: 'flex', background: '#eef1f4', borderRadius: 10, padding: 3 }}>
            {([['todos', 'Todos'], ['encounterer', 'Encontristas'], ['worker', 'Encontreiros']] as const).map(([v, l]) => (
              <button key={v} type="button" onClick={() => setFiltro(v)}
                style={{ border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, padding: '6px 12px', borderRadius: 8, background: filtro === v ? 'white' : 'transparent', color: filtro === v ? '#111827' : '#6b7280', boxShadow: filtro === v ? '0 1px 3px rgba(0,0,0,0.12)' : 'none' }}>
                {l}
              </button>
            ))}
          </div>
          <span style={{ fontSize: 11.5, color: '#6b7280' }}>· uma ficha por folha</span>
        </div>
      )}

      {loading ? (
        <p style={{ textAlign: 'center', color: '#6b7280', fontSize: 13, padding: '30px 0' }}>Carregando...</p>
      ) : visiveis.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#6b7280', fontSize: 13, padding: '30px 0' }}>Ninguém para imprimir com esse filtro.</p>
      ) : visiveis.map((p, i) => (
        // print-break em TODAS menos a última → exatamente 1 ficha por folha
        <div key={p.id} className={i < visiveis.length - 1 ? 'print-break' : undefined}>
          <Ficha
            p={p}
            evento={nome}
            termos={p.role_type === 'encounterer' ? cfg.tEnc : cfg.tWor}
            valor={p.role_type === 'encounterer' ? cfg.vEnc : cfg.vWor}
          />
        </div>
      ))}
    </PrintOverlay>
  )
}
