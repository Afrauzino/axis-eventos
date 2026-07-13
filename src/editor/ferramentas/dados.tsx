import { registrarFerramenta } from './registry'
import { obterElemento } from '../elementos'

// Liga elementos aos dados do sistema.
// Um campo novo (ex: "quarto") = adicionar aqui + no montador de dados da tela.

// Todos os campos do cadastro que dá pra ligar a um elemento (texto/foto).
// A chave TEM que bater com a chave montada em registroDe() (Impressao.tsx).
const CAMPOS: Record<string, string> = {
  nome: 'Nome',
  foto: 'Foto',
  funcao: 'Função (Encontrista/Encontreiro)',
  cargo: 'Cargo',
  equipe: 'Equipe',
  igreja: 'Igreja',
  celular: 'Celular',
  contato: 'Contato de emergência',
  sexo: 'Sexo',
  nascimento: 'Nascimento',
  cpf: 'CPF',
  rg: 'RG',
  cidade: 'Cidade',
  estado: 'UF',
  endereco: 'Endereço',
  bairro: 'Bairro',
  cep: 'CEP',
  ano: 'Ano do encontro',
  codigo: 'Código de acesso',
}

registrarFerramenta({
  id: 'dados',
  nome: 'Dados',
  icone: 'database',
  Painel: ({ doc, selecao, dispatch }) => {
    const el = doc.paginas.flatMap(p => p.elementos).find(e => e.id === selecao[0])
    const def = el ? obterElemento(el.tipo) : undefined
    const ligaveis = def?.camposLigaveis ?? []
    const porPessoa = doc.fonteDados === 'pessoas'

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700 }}>Repetir por pessoa</p>
            <p style={{ fontSize: 11, color: 'var(--muted)' }}>Imprime um modelo para cada pessoa do filtro.</p>
          </div>
          <div onClick={() => dispatch({ t: 'documento', patch: { fonteDados: porPessoa ? null : 'pessoas' } })}
            style={{ width: 44, height: 24, borderRadius: 99, background: porPessoa ? 'var(--primary)' : 'var(--border)', position: 'relative', cursor: 'pointer', flexShrink: 0 }}>
            <span style={{ position: 'absolute', top: 2, left: porPessoa ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: 'white', transition: 'left 0.2s' }} />
          </div>
        </div>

        <div style={{ height: 1, background: 'var(--border)' }} />

        {!el ? (
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Toque num elemento para ligá-lo a um campo do cadastro.</p>
        ) : ligaveis.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Este elemento não usa dados do cadastro.</p>
        ) : (
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 8 }}>Ligar a um campo</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Chip ativo={!el.props.campo} label="Texto fixo"
                onClick={() => dispatch({ t: 'patchProps', ids: [el.id], props: { campo: null } })} />
              {ligaveis.map(c => (
                <Chip key={c} ativo={el.props.campo === c} label={CAMPOS[c] ?? c}
                  onClick={() => dispatch({ t: 'patchProps', ids: [el.id], props: { campo: c } })} />
              ))}
            </div>
            {el.props.campo && (
              <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
                Na impressão vira o <b>{(CAMPOS[el.props.campo] ?? el.props.campo).toLowerCase()}</b> de cada pessoa.
              </p>
            )}
          </div>
        )}
      </div>
    )
  },
})

function Chip({ ativo, label, onClick }: { ativo: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      style={{ padding: '6px 12px', borderRadius: 99, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700,
        border: ativo ? '2px solid var(--primary)' : '1px solid var(--border)',
        background: ativo ? 'var(--primary-light)' : 'white', color: ativo ? 'var(--primary)' : 'var(--text2)' }}>
      {label}
    </button>
  )
}
