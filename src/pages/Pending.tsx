import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { carregarConfig } from '../lib/tema'
import CadastroPessoa, { FORM_VAZIO, type PessoaForm } from '../components/CadastroPessoa'
import { validarCadastroFaltando, fotoRequerida, carregarCadastroCfg } from '../lib/cadastroCfg'
import { toast } from '../components/Toast'
import { formatName } from '../utils'
import { notificarRegra } from '../lib/notifRegras'
import type { Profile } from '../App'

export default function Pending({ profile }: { profile: Profile | null }) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [rejMsg, setRejMsg] = useState<string | null>(null)
  const [refazendo, setRefazendo] = useState(false)
  const [cadForm, setCadForm] = useState<PessoaForm>(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)

  const st = profile?.role_status
  useEffect(() => { carregarConfig('logo_url').then(setLogoUrl) }, [])
  useEffect(() => {
    if (st === 'rejected' && profile?.user_id) {
      supabase.from('profiles').select('rejeicao_msg').eq('user_id', profile.user_id).maybeSingle()
        .then(({ data }) => setRejMsg((data as any)?.rejeicao_msg ?? null))
    }
  }, [st, profile?.user_id])

  async function abrirRefazer() {
    if (!profile?.user_id) return
    const { data } = await supabase.from('people').select('*').eq('user_id', profile.user_id).order('created_at', { ascending: false }).limit(1)
    const d: any = (data ?? [])[0] ?? {}
    setCadForm({
      ...FORM_VAZIO,
      name: d.name ?? '', phone: d.phone ?? '', contact_phone: d.contact_phone ?? '',
      church: d.church ?? '', ano_encontro: d.ano_encontro ? String(d.ano_encontro) : '',
      sexo: d.sexo ?? '', birth_date: d.birth_date ?? '', cpf: d.cpf ?? '', rg: d.rg ?? '',
      cidade: d.cidade ?? '', estado: d.estado ?? '', endereco: d.endereco ?? '', bairro: d.bairro ?? '', cep: d.cep ?? '',
      role_type: d.role_type ?? 'encounterer', cargo: d.cargo ?? '', notes: d.notes ?? '',
      responsavel_nome: d.responsavel_nome ?? '', responsavel_tel: d.responsavel_tel ?? '',
      photo_url: d.photo_url ?? null,
    })
    setRefazendo(true)
  }

  async function salvarRefazer() {
    if (!cadForm.name.trim()) { toast.aviso('O nome é obrigatório.'); return }
    if (fotoRequerida(await carregarCadastroCfg()) && !cadForm.photo_url) { toast.aviso('A foto é obrigatória.'); return }
    const faltam = await validarCadastroFaltando(cadForm)
    if (faltam.length) { toast.aviso('Preencha: ' + faltam.join(', ') + '.'); return }
    setSalvando(true)
    const payload = {
      name: formatName(cadForm.name),
      phone: (cadForm.phone || '').replace(/\D/g, '') || cadForm.phone || '',
      contact_phone: cadForm.contact_phone || '',
      church: (cadForm.church || '').trim(), ano_encontro: cadForm.ano_encontro || '',
      sexo: cadForm.sexo || '', birth_date: cadForm.birth_date || '', cpf: cadForm.cpf || '', rg: cadForm.rg || '',
      cidade: cadForm.cidade || '', estado: cadForm.estado || '', endereco: cadForm.endereco || '', bairro: cadForm.bairro || '', cep: cadForm.cep || '',
      cargo: cadForm.cargo || '', responsavel_nome: cadForm.responsavel_nome || '', responsavel_tel: cadForm.responsavel_tel || '',
      notes: cadForm.notes || '', photo_url: cadForm.photo_url || null,
    }
    const { error } = await supabase.rpc('atualizar_meu_cadastro', { p: payload })
    if (error) { setSalvando(false); toast.falha('Não foi possível salvar. Rode o sql/59/68.', error); return }
    const { error: e2 } = await supabase.rpc('reenviar_meu_cadastro')
    setSalvando(false)
    if (e2) { toast.falha('Falta rodar o sql/72_reprovacao.sql no Supabase.', e2); return }
    toast.sucesso('Cadastro reenviado! Agora é só aguardar a aprovação.')
    // Avisa os admins que um cadastro corrigido voltou pra fila de aprovação
    // (é como uma inscrição nova: precisa reaprovar).
    try { notificarRegra('insc_nova', { notify_admins: true, title: 'Cadastro reenviado para aprovação', body: `${formatName(cadForm.name)} corrigiu e reenviou o cadastro.`, url: '/minhas-atividades' }) } catch {}
    setTimeout(() => window.location.reload(), 1000)
  }

  // ===== Tela de REFAZER (cadastro completo) =====
  if (refazendo) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: 'var(--primary)', padding: '20px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setRefazendo(false)} aria-label="Voltar" style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, width: 34, height: 34, cursor: 'pointer', color: 'white', fontFamily: 'inherit' }}><span className="icon">arrow_back</span></button>
          <div><p style={{ fontSize: 16, fontWeight: 800, color: 'white' }}>Refazer meu cadastro</p><p style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>Corrija o que foi pedido e reenvie</p></div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, maxWidth: 520, margin: '0 auto', width: '100%' }}>
          {rejMsg && <div style={{ background: 'var(--warning-bg,#FFFBEB)', border: '1px solid #F6E05E', borderRadius: 12, padding: '12px 14px', marginBottom: 16, fontSize: 14, lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: rejMsg }} />}
          <CadastroPessoa form={cadForm} onChange={setCadForm} showRole={false} />
          <button className="btn btn-primary btn-full" style={{ marginTop: 16 }} onClick={salvarRefazer} disabled={salvando}>{salvando ? 'Enviando...' : 'Reenviar cadastro'}</button>
        </div>
      </div>
    )
  }

  const titulo = st === 'blocked' ? 'Conta bloqueada' : st === 'rejected' ? 'Cadastro não aprovado' : st === 'suspended' ? 'Conta suspensa' : 'Aguardando aprovação'
  const msgPadrao = st === 'blocked'
    ? 'Sua conta foi bloqueada pelo administrador. Entre em contato para reativar o seu acesso.'
    : st === 'suspended'
    ? 'Sua conta foi suspensa temporariamente. Entre em contato com o administrador.'
    : 'Seu cadastro foi recebido. Um administrador precisa aprovar seu acesso antes de você entrar no sistema.'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: 'var(--primary)', padding: '56px 24px 36px', textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, background: 'rgba(255,255,255,0.2)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.3)' }}>
          {logoUrl ? <img src={logoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 13, fontWeight: 800, color: 'white' }}>ECD</span>}
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'white', marginBottom: 4 }}>{titulo}</h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>AXIS Eventos</p>
      </div>
      <div style={{ flex: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 480, margin: '0 auto', width: '100%' }}>
        {st === 'rejected' ? (
          <>
            {rejMsg
              ? <div style={{ background: 'white', borderRadius: 12, boxShadow: 'var(--shadow-sm)', padding: '16px 18px', fontSize: 15, lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: rejMsg }} />
              : <div className="info-section"><p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.7 }}>Seu cadastro precisa de ajustes. Toque abaixo para refazer.</p></div>}
            <button className="btn btn-primary btn-full" onClick={abrirRefazer}><span className="icon icon-sm">refresh</span> Refazer meu cadastro</button>
          </>
        ) : (
          <>
            <div className="info-section"><p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.7 }}>{msgPadrao}</p></div>
            {(!st || st === 'pending') && <div className="alert-box alert-info">Assim que aprovado você terá acesso automaticamente. Tente entrar novamente mais tarde.</div>}
          </>
        )}
        <button className="btn btn-outline btn-full" onClick={() => supabase.auth.signOut()} style={{ marginTop: 'auto' }}>Sair</button>
      </div>
    </div>
  )
}
