/**
 * CadastroPessoa — componente unificado de cadastro
 * Usado em: Login (primeiro acesso), Cadastros (admin), Financeiro, etc.
 * Toda alteração aqui reflete em TODOS os lugares.
 */
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import UploadFoto from './UploadFoto'
import Seletor from './Seletor'
import { IGREJA_OPCOES } from '../lib/igrejas'
import DataHora from './DataHora'
import { formatName } from '../utils'
import { carregarCadastroCfg, cargoVisivel, campoOculto, campoObrigatorio, fotoRequerida, CADASTRO_CFG_VAZIO, type CadastroCfg } from '../lib/cadastroCfg'

export type MedCtrl = {
  nome:string; tipo:'comprimido'|'gotas'|'outros'
  dosagem:string; horario_ini:string; intervalo_h:number
}
export const MED_VAZIO: MedCtrl = { nome:'', tipo:'comprimido', dosagem:'', horario_ini:'08:00', intervalo_h:8 }
import { isMenor } from '../utils'

export type PessoaForm = {
  name: string
  phone: string
  contact_phone: string
  church: string
  ano_encontro: string
  sexo: string
  birth_date: string
  cpf: string
  rg: string
  cidade: string
  estado: string
  endereco: string
  bairro: string
  cep: string
  role_type: string
  status: string
  team_pref: string
  referencia_id: string
  cargo: string
  notes: string
  responsavel_nome: string
  responsavel_tel: string
  photo_url: string | null
  // Saúde
  diabetes: boolean
  hipertensao: boolean
  cardiopatia: boolean
  epilepsia: boolean
  ansiedade: boolean
  celiaca: boolean
  tipo_sanguineo: string
  alergias: string
  restricoes_alimentares: string
  vicios: string
  observacoes_saude: string
}

export const FORM_VAZIO: PessoaForm = {
  name:'', phone:'', contact_phone:'', church:'', ano_encontro:'',
  sexo:'', birth_date:'', cpf:'', rg:'',
  cidade:'', estado:'', endereco:'', bairro:'', cep:'',
  role_type:'encounterer', status:'inscrito',
  team_pref:'', referencia_id:'', cargo:'', notes:'',
  responsavel_nome:'', responsavel_tel:'', photo_url:null,
  diabetes:false, hipertensao:false, cardiopatia:false,
  epilepsia:false, ansiedade:false, celiaca:false,
  tipo_sanguineo:'', alergias:'', restricoes_alimentares:'',
  vicios:'', observacoes_saude:'',
}

export const ROLES = [
  { value:'encounterer', label:'Encontrista', desc:'Irá passar pelo encontro', cor:'#6B46C1', bg:'#F3F0FF' },
  { value:'worker',      label:'Encontreiro', desc:'Irá trabalhar / servir',   cor:'#00A99D', bg:'#E6F8F7' },
]

export const STATUS_OPTS = [
  { value:'inscrito',   label:'Inscrito' },
  { value:'confirmado', label:'Confirmado' },
  { value:'pendente',   label:'Pendente' },
  { value:'cancelado',  label:'Cancelado' },
]

type Props = {
  form: PessoaForm
  onChange: (f: PessoaForm) => void
  eventoId?: string
  showRole?: boolean
  showStatus?: boolean
  showTeam?: boolean
  showReferencia?: boolean
  fotoObrigatoria?: boolean
  modoSoLeitura?: boolean
  onSaudeVisit?: () => void
  usaMed?: boolean
  onUsaMedChange?: (v: boolean) => void
  meds?: MedCtrl[]
  onMedsChange?: (m: MedCtrl[]) => void
}

export default function CadastroPessoa({
  form, onChange, eventoId,
  showRole=true, showStatus=false, showTeam=false,
  showReferencia=false, fotoObrigatoria=false, modoSoLeitura=false,
  onSaudeVisit, usaMed=false, onUsaMedChange, meds=[], onMedsChange,
}: Props) {
  const [equipes, setEquipes] = useState<{id:string;name:string;color:string}[]>([])
  const [refs,    setRefs]    = useState<{id:string;name:string;photo_url:string|null}[]>([])
  const [cadCfg,  setCadCfg]  = useState<CadastroCfg>(CADASTRO_CFG_VAZIO)
  useEffect(() => { carregarCadastroCfg().then(setCadCfg) }, [])
  // Config por campo: mostrar? e "*" de obrigatório
  const mostra = (key: string) => !campoOculto(cadCfg, key)
  const obg = (key: string) => campoObrigatorio(cadCfg, key) ? <span className="req">*</span> : null
  const aba: string = 'geral' // Saúde removida do primeiro acesso (preenchida depois no módulo Saúde)
  const [refSearch, setRefSearch] = useState('')
  const [refOpen, setRefOpen]   = useState(false)

  function calcHorarios(ini: string, intH: number) {
    const [h,m] = ini.split(':').map(Number)
    return Array.from({length:Math.round(24/intH)},(_,i)=>{
      const tot=(h*60+m)+i*intH*60
      return `${String(Math.floor(tot/60)%24).padStart(2,'0')}:${String(tot%60).padStart(2,'0')}`
    }).join(' · ')
  }
  function addMed() { onMedsChange?.([...meds, {...MED_VAZIO}]) }
  function removeMed(i:number) { onMedsChange?.(meds.filter((_,idx)=>idx!==i)) }
  function updMed(i:number, field:keyof MedCtrl, val:string|number) {
    onMedsChange?.(meds.map((med,idx)=>idx===i?{...med,[field]:val}:med))
  }

  useEffect(() => {
    if (!eventoId) return
    if (showTeam) {
      supabase.from('teams').select('id,name,color').eq('event_id',eventoId).order('name')
        .then(({data})=>setEquipes(data??[]))
    }
    if (showReferencia) {
      supabase.from('people').select('id,name,photo_url').eq('event_id',eventoId).eq('role_type','worker').order('name')
        .then(({data})=>setRefs(data??[]))
    }
  }, [eventoId, showTeam, showReferencia])

  const s = (field: keyof PessoaForm, val: string) => onChange({...form, [field]:val})

  const inp = (field: keyof PessoaForm, props: Record<string,any> = {}) => (
    <input
      className="form-input"
      value={form[field] as string}
      onChange={e=>s(field, e.target.value)}
      disabled={modoSoLeitura}
      {...props}
    />
  )

  return (
    <div>
      {/* Saúde NÃO aparece no primeiro acesso (bloco abaixo fica inativo — aba é sempre 'geral') */}
      {aba==='saude' && (
        <div>
          <p className="section-label mb-2">Condições de saúde</p>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:16}}>
            {([
              ['diabetes',    'Diabetes'],
              ['hipertensao', 'Hipertensão'],
              ['cardiopatia', 'Cardiopatia'],
              ['epilepsia',   'Epilepsia'],
              ['ansiedade',   'Ansiedade/Depressão'],
              ['celiaca',     'Doença Celíaca'],
            ] as const).map(([field,label])=>(
              <button key={field} type="button" disabled={modoSoLeitura}
                onClick={()=>onChange({...form,[field]:!form[field]})}
                style={{padding:'10px 8px',borderRadius:10,cursor:modoSoLeitura?'default':'pointer',fontWeight:600,fontSize:12,fontFamily:'inherit',textAlign:'left',display:'flex',alignItems:'center',gap:8,
                  border:`2px solid ${form[field]?'var(--primary)':'var(--border)'}`,
                  background:form[field]?'var(--primary-light)':'white',
                  color:form[field]?'var(--primary)':'var(--text2)'}}>
                <span style={{fontSize:16}}>{form[field]?'☑':'☐'}</span>
                {label}
              </button>
            ))}
          </div>

          <div className="form-group">
            <label className="form-label">Tipo sanguíneo</label>
            <select className="form-select" value={form.tipo_sanguineo} onChange={e=>s('tipo_sanguineo',e.target.value)} disabled={modoSoLeitura}>
              <option value="">Não sei</option>
              {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Alergias a medicamentos</label>
            <textarea className="form-textarea" value={form.alergias}
              onChange={e=>s('alergias',e.target.value)} disabled={modoSoLeitura}
              placeholder="Ex: Dipirona, Penicilina, AAS..." style={{minHeight:60}}/>
          </div>

          <div className="form-group">
            <label className="form-label">Restrições alimentares</label>
            <textarea className="form-textarea" value={form.restricoes_alimentares}
              onChange={e=>s('restricoes_alimentares',e.target.value)} disabled={modoSoLeitura}
              placeholder="Ex: Vegetariano, intolerante à lactose, sem glúten..." style={{minHeight:60}}/>
          </div>

          <div className="form-group">
            <label className="form-label">Tem algum vício? Qual(is)?</label>
            <textarea className="form-textarea" value={form.vicios}
              onChange={e=>s('vicios',e.target.value)} disabled={modoSoLeitura}
              placeholder="Ex: Tabagismo, álcool..." style={{minHeight:50}}/>
          </div>

          <div className="form-group">
            <label className="form-label">Observações gerais de saúde</label>
            <textarea className="form-textarea" value={form.observacoes_saude}
              onChange={e=>s('observacoes_saude',e.target.value)} disabled={modoSoLeitura}
              style={{minHeight:70}}/>
          </div>

          {/* MEDICAMENTOS CONTÍNUOS */}
          {onUsaMedChange && (
            <>
              <p className="section-label mb-2" style={{marginTop:20}}>💊 Medicamentos contínuos</p>
              <div style={{background:'var(--bg)',borderRadius:10,padding:'12px 14px',marginBottom:8}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:usaMed?12:0}}>
                  <p style={{fontSize:13,fontWeight:600}}>Faz uso de medicamento contínuo?</p>
                  <div style={{display:'flex',gap:8}}>
                    {(['Não','Sim'] as const).map((label)=>(
                      <button key={label} type="button" disabled={modoSoLeitura}
                        onClick={()=>onUsaMedChange(label==='Sim')}
                        style={{padding:'4px 14px',borderRadius:20,cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:'inherit',
                          border:`1.5px solid ${(label==='Sim')===usaMed?'var(--primary)':'var(--border)'}`,
                          background:(label==='Sim')===usaMed?'var(--primary-light)':'white',
                          color:(label==='Sim')===usaMed?'var(--primary)':'var(--text2)'}}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {usaMed && (
                  <>
                    {meds.map((med,i)=>(
                      <div key={i} style={{background:'white',borderRadius:10,padding:'12px',marginBottom:8,border:'1px solid var(--border)'}}>
                        <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                          <p style={{fontSize:12,fontWeight:700,color:'var(--primary)'}}>Medicamento {i+1}</p>
                          <button type="button" onClick={()=>removeMed(i)}
                            style={{background:'var(--danger-bg)',color:'var(--danger)',border:'none',borderRadius:6,padding:'2px 8px',cursor:'pointer',fontSize:11,fontFamily:'inherit'}}>
                            Remover
                          </button>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Nome do medicamento</label>
                          <input className="form-input" value={med.nome} onChange={e=>updMed(i,'nome',e.target.value)} placeholder="Ex: Ritalina, Clonazepam..."/>
                        </div>
                        <div className="form-grid-2">
                          <div className="form-group"><label className="form-label">Tipo</label>
                            <select className="form-select" value={med.tipo} onChange={e=>updMed(i,'tipo',e.target.value)}>
                              <option value="comprimido">Comprimido</option>
                              <option value="gotas">Gotas</option>
                              <option value="outros">Outros</option>
                            </select>
                          </div>
                          <div className="form-group"><label className="form-label">Dosagem</label>
                            <input className="form-input" value={med.dosagem} onChange={e=>updMed(i,'dosagem',e.target.value)} placeholder="Ex: 10mg"/>
                          </div>
                        </div>
                        <div className="form-grid-2">
                          <div className="form-group"><label className="form-label">Horário inicial</label>
                            <DataHora modo="time" value={med.horario_ini} onChange={v=>updMed(i,'horario_ini',v)}/>
                          </div>
                          <div className="form-group"><label className="form-label">Intervalo</label>
                            <select className="form-select" value={med.intervalo_h} onChange={e=>updMed(i,'intervalo_h',Number(e.target.value))}>
                              <option value={4}>A cada 4h</option>
                              <option value={6}>A cada 6h</option>
                              <option value={8}>A cada 8h</option>
                              <option value={12}>A cada 12h</option>
                              <option value={24}>1× ao dia</option>
                            </select>
                          </div>
                        </div>
                        <div style={{background:'var(--primary-light)',borderRadius:8,padding:'6px 10px'}}>
                          <p style={{fontSize:10,fontWeight:700,color:'var(--primary)',marginBottom:2}}>Horários gerados automaticamente:</p>
                          <p style={{fontSize:12,color:'var(--primary)'}}>{calcHorarios(med.horario_ini,med.intervalo_h)}</p>
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={addMed}
                      style={{width:'100%',padding:'10px',borderRadius:10,border:'2px dashed var(--primary)',background:'var(--primary-light)',color:'var(--primary)',cursor:'pointer',fontSize:13,fontWeight:700,fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                      + Adicionar medicamento
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ABA GERAL */}
      {aba==='geral' && <>
      {/* FOTO */}
      {mostra('foto') && (
      <div style={{display:'flex',justifyContent:'center',marginBottom:20}}>
        <div style={{position:'relative'}}>
          <UploadFoto
            bucket="pessoas"
            path={`pessoa-${Date.now()}`}
            currentUrl={form.photo_url}
            onUpload={url=>onChange({...form,photo_url:url})}
            label="Adicionar foto"
            size={96}
            shape="circle"
          />
          {(fotoObrigatoria || fotoRequerida(cadCfg)) && !form.photo_url && (
            <div style={{position:'absolute',bottom:-4,left:'50%',transform:'translateX(-50%)',background:'var(--danger)',color:'white',fontSize:9,fontWeight:700,padding:'2px 8px',borderRadius:99,whiteSpace:'nowrap'}}>
              Obrigatória
            </div>
          )}
        </div>
      </div>
      )}

      {/* FUNÇÃO NO EVENTO */}
      {showRole && (
        <div className="form-group">
          <label className="form-label">Função no evento <span className="req">*</span></label>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:4}}>
            {ROLES.map(r=>(
              <button key={r.value} type="button" disabled={modoSoLeitura}
                onClick={()=>s('role_type',r.value)}
                style={{padding:'10px 8px',borderRadius:10,cursor:modoSoLeitura?'default':'pointer',fontFamily:'inherit',display:'flex',flexDirection:'column',alignItems:'center',gap:2,border:`2px solid ${form.role_type===r.value?r.cor:'var(--border)'}`,background:form.role_type===r.value?r.bg:'white',color:form.role_type===r.value?r.cor:'var(--text2)'}}>
                <span style={{fontWeight:700,fontSize:13}}>{r.label}</span>
                <span style={{fontSize:11,fontWeight:600,opacity:0.85}}>{r.desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* DADOS PESSOAIS */}
      <p className="section-label mb-2" style={{marginTop:16}}>Dados pessoais</p>

      <div className="form-group">
        <label className="form-label">Nome completo <span className="req">*</span></label>
        {/* ao sair do campo já mostra o nome arrumado — "MARIA DA SILVA" vira "Maria da Silva" */}
        {inp('name',{required:true,placeholder:'Nome como no documento',
          onBlur:(e:React.FocusEvent<HTMLInputElement>)=>s('name', formatName(e.target.value))})}
      </div>

      <div className="form-grid-2">
        <div className="form-group">
          <label className="form-label">Celular <span className="req">*</span></label>
          {inp('phone',{required:true,type:'tel',placeholder:'(11) 99999-9999'})}
        </div>
        {mostra('contact_phone') && (
        <div className="form-group">
          <label className="form-label">Contato de emergência {obg('contact_phone')}</label>
          {inp('contact_phone',{type:'tel',placeholder:'(11) 99999-9999'})}
        </div>
        )}
      </div>

      <div className="form-grid-2">
        {mostra('sexo') && (
        <div className="form-group">
          <label className="form-label">Sexo {obg('sexo')}</label>
          <Seletor titulo="Sexo" placeholder="Selecionar" disabled={modoSoLeitura}
            value={form.sexo} onChange={v=>s('sexo',v)}
            opcoes={[{value:'M',label:'Masculino'},{value:'F',label:'Feminino'}]}/>
        </div>
        )}
        {mostra('birth_date') && (
        <div className="form-group">
          <label className="form-label">Nascimento {obg('birth_date')}</label>
          <DataHora modo="date" value={form.birth_date} onChange={v=>s('birth_date',v)} disabled={modoSoLeitura}/>
        </div>
        )}
      </div>

      {form.birth_date && isMenor(form.birth_date) && (
        <div style={{background:'#FFF3E0',borderRadius:10,padding:'12px 14px',marginBottom:12,border:'1px solid #FBD38D'}}>
          <p style={{fontSize:12,fontWeight:700,color:'#C05621',marginBottom:8}}>⚠ Menor de idade — dados do responsável:</p>
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Nome do responsável</label>
              {inp('responsavel_nome')}
            </div>
            <div className="form-group">
              <label className="form-label">Telefone</label>
              {inp('responsavel_tel',{type:'tel'})}
            </div>
          </div>
        </div>
      )}

      {(mostra('cpf') || mostra('rg')) && (
      <div className="form-grid-2">
        {mostra('cpf') && (
        <div className="form-group">
          <label className="form-label">CPF {obg('cpf')}</label>
          {inp('cpf',{placeholder:'000.000.000-00'})}
        </div>
        )}
        {mostra('rg') && (
        <div className="form-group">
          <label className="form-label">RG {obg('rg')}</label>
          {inp('rg')}
        </div>
        )}
      </div>
      )}

      {/* ENDEREÇO */}
      {(mostra('endereco') || mostra('bairro') || mostra('cep') || mostra('cidade') || mostra('estado')) && (
        <p className="section-label mb-2" style={{marginTop:16}}>Endereço</p>
      )}

      {mostra('endereco') && (
      <div className="form-group">
        <label className="form-label">Endereço {obg('endereco')}</label>
        {inp('endereco',{placeholder:'Rua, número, complemento'})}
      </div>
      )}
      {(mostra('bairro') || mostra('cep')) && (
      <div className="form-grid-2">
        {mostra('bairro') && (
        <div className="form-group">
          <label className="form-label">Bairro {obg('bairro')}</label>
          {inp('bairro')}
        </div>
        )}
        {mostra('cep') && (
        <div className="form-group">
          <label className="form-label">CEP {obg('cep')}</label>
          {inp('cep',{placeholder:'00000-000'})}
        </div>
        )}
      </div>
      )}
      {(mostra('cidade') || mostra('estado')) && (
      <div className="form-grid-2">
        {mostra('cidade') && (
        <div className="form-group">
          <label className="form-label">Cidade {obg('cidade')}</label>
          {inp('cidade')}
        </div>
        )}
        {mostra('estado') && (
        <div className="form-group">
          <label className="form-label">Estado {obg('estado')}</label>
          <Seletor titulo="Estado (UF)" placeholder="UF" sheet disabled={modoSoLeitura}
            value={form.estado} onChange={v=>s('estado',v)}
            opcoes={[{value:'',label:'Nenhum'}, ...['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(uf=>({value:uf,label:uf}))]}/>
        </div>
        )}
      </div>
      )}

      {/* EVENTO */}
      {(mostra('church') || mostra('ano_encontro')) && (
        <p className="section-label mb-2" style={{marginTop:16}}>Evento</p>
      )}

      {(mostra('church') || mostra('ano_encontro')) && (
      <div className="form-group">
        {mostra('church') && <>
          <label className="form-label">Igreja {obg('church')}</label>
          <Seletor titulo="Igreja" placeholder="Selecionar igreja" disabled={modoSoLeitura}
            value={form.church} onChange={v=>s('church',v)} opcoes={IGREJA_OPCOES}/>
        </>}
        {mostra('ano_encontro') && <>
          <label className="form-label" style={{marginTop:mostra('church')?12:0}}>Ano que passou pelo encontro {obg('ano_encontro')}</label>
          {inp('ano_encontro',{type:'number',placeholder:'Ex: 2024',min:'1990',max:'2100'})}
        </>}
      </div>
      )}

      {/* CARGO — lista fixa configurável em Administração (só aparece se houver cargos e não estiver oculto) */}
      {cargoVisivel(cadCfg) && (
        <div className="form-group">
          <label className="form-label">Cargo {cadCfg.obrigatorio && <span className="req">*</span>}</label>
          <Seletor titulo="Cargo" placeholder="Selecionar cargo" sheet disabled={modoSoLeitura}
            value={form.cargo} onChange={v=>s('cargo',v)}
            opcoes={[{value:'',label:'Nenhum'}, ...cadCfg.cargos.map(c=>({value:c,label:c}))]}/>
        </div>
      )}

      {showStatus && (
        <div className="form-group">
          <label className="form-label">Status</label>
          <Seletor titulo="Status" disabled={modoSoLeitura}
            value={form.status} onChange={v=>s('status',v)} opcoes={STATUS_OPTS}/>
        </div>
      )}

      {showTeam && equipes.length > 0 && (
        <div className="form-group">
          <label className="form-label">Equipe de interesse</label>
          <p style={{fontSize:11,color:'var(--muted)',marginBottom:4}}>Sujeito a aprovação do administrador</p>
          <Seletor titulo="Equipe de interesse" placeholder="Nenhuma preferência" disabled={modoSoLeitura}
            value={form.team_pref} onChange={v=>s('team_pref',v)}
            opcoes={[{value:'',label:'Nenhuma preferência'}, ...equipes.map(e=>({value:e.id,label:e.name}))]}/>
        </div>
      )}

      {showReferencia && refs.length > 0 && (
        <div className="form-group">
          <label className="form-label">Quem te indicou? (opcional)</label>
          {/* Campo clicável que abre a lista */}
          <button type="button" disabled={modoSoLeitura}
            onClick={()=>{ if (!modoSoLeitura) { setRefOpen(v=>!v); setRefSearch('') } }}
            style={{width:'100%',textAlign:'left',background:'white',border:'1px solid var(--border)',borderRadius:8,padding:'10px 12px',cursor:'pointer',fontFamily:'inherit',fontSize:13,color:form.referencia_id?'var(--text)':'var(--muted)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <span>{form.referencia_id ? refs.find(r=>r.id===form.referencia_id)?.name ?? 'Selecionar' : 'Nenhum — toque para ver a lista'}</span>
            <span className="icon icon-sm" style={{color:'var(--muted)'}}>{refOpen?'expand_less':'expand_more'}</span>
          </button>
          {/* Lista expansível com busca */}
          {refOpen && (
            <div style={{border:'1px solid var(--border)',borderRadius:8,marginTop:4,background:'white',boxShadow:'var(--shadow)',zIndex:10,position:'relative'}}>
              <div style={{padding:'8px 10px',borderBottom:'1px solid var(--border)'}}>
                <input
                  className="form-input"
                  placeholder="Buscar encontreiro..."
                  value={refSearch}
                  onChange={e=>setRefSearch(e.target.value)}
                  style={{margin:0}}
                />
              </div>
              <div style={{maxHeight:200,overflowY:'auto'}}>
                <button type="button" onClick={()=>{s('referencia_id','');setRefOpen(false)}}
                  style={{width:'100%',textAlign:'left',padding:'10px 12px',background:'none',border:'none',cursor:'pointer',fontSize:13,color:'var(--muted)',fontFamily:'inherit',borderBottom:'1px solid var(--border)'}}>
                  Não informar
                </button>
                {refs.filter(r=>r.name.toLowerCase().includes(refSearch.toLowerCase())).map(r=>(
                  <button key={r.id} type="button"
                    onClick={()=>{s('referencia_id',r.id);setRefOpen(false)}}
                    style={{width:'100%',textAlign:'left',padding:'10px 12px',background:form.referencia_id===r.id?'var(--primary-light)':'none',border:'none',cursor:'pointer',fontSize:13,fontFamily:'inherit',color:form.referencia_id===r.id?'var(--primary)':'var(--text)',display:'flex',alignItems:'center',gap:10,borderBottom:'1px solid var(--border)'}}>
                    <div style={{width:32,height:32,borderRadius:'50%',background:'var(--primary-light)',flexShrink:0,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center'}}>
                      {r.photo_url
                        ? <img src={r.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                        : <span style={{fontSize:11,fontWeight:700,color:'var(--primary)'}}>{r.name.slice(0,2).toUpperCase()}</span>
                      }
                    </div>
                    {r.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {mostra('notes') && (
      <div className="form-group">
        <label className="form-label">Observações {obg('notes')}</label>
        <textarea className="form-textarea" value={form.notes} onChange={e=>s('notes',e.target.value)} disabled={modoSoLeitura} style={{minHeight:60}}/>
      </div>
      )}
      </>}
    </div>
  )
}
