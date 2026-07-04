// Motor de doses de medicamento contínuo — fonte única (usado na Ficha Médica
// e na Saúde → Configuração para recalcular).
// A janela [inicio, fim] vem da configuração do evento (data/hora inicial e
// final). Cada dose = última dose + intervalo, repetindo dentro da janela.

export type JanelaMed = { inicio: number; fim: number }  // timestamps em ms

export type MedCalc = {
  nome: string
  dosagem?: string | null
  intervalo_h: string | number
  ultima_dose: string | null   // ISO ou 'YYYY-MM-DDTHH:MM'
}

// Janela do evento: usa med_inicio/med_fim se existirem; senão cai no
// comportamento antigo (agora → daqui a 2 dias na "hora de corte", padrão 14h).
export function janelaDoEvento(ev: any): JanelaMed {
  const inicio = ev?.med_inicio ? new Date(ev.med_inicio).getTime() : Date.now()
  let fim: number
  if (ev?.med_fim) {
    fim = new Date(ev.med_fim).getTime()
  } else {
    const f = new Date()
    f.setDate(f.getDate() + 2)
    f.setHours(ev?.med_corte_hora ?? 14, 0, 0, 0)
    fim = f.getTime()
  }
  return { inicio, fim }
}

// Gera as linhas de med_agenda (doses) dentro da janela.
export function gerarDoses(
  med: MedCalc,
  personId: string,
  eventId: string,
  medCtrlId: string,
  janela: JanelaMed,
): any[] {
  const rows: any[] = []
  const iv = parseInt(String(med.intervalo_h)) || 0
  if (!med.ultima_dose || iv <= 0) return rows
  const step = iv * 3600000
  const { inicio, fim } = janela
  let t = new Date(med.ultima_dose).getTime() + step
  // pula direto para o primeiro horário dentro da janela
  if (t < inicio) { const n = Math.ceil((inicio - t) / step); t += n * step }
  let guard = 0
  while (t <= fim && guard < 1000) {
    rows.push({
      med_ctrl_id: medCtrlId, person_id: personId, event_id: eventId,
      nome: (med.nome || '').trim(), dosagem: med.dosagem || null,
      horario: new Date(t).toISOString(), entregue: false,
    })
    t += step; guard++
  }
  return rows
}
