// Barra de progresso do EVENTO — sequência simbólica e DINÂMICA (se ajusta ao
// número de blocos do cronograma; incluir/excluir item muda a variação sozinho).
//
// Regras (pedido do Anderson):
//  • Números terminando em 3 ou 7 (Pai/Filho/Espírito Santo; 7 = perfeição).
//  • Sobe com quedinhas (sobe, sobe, desce um pouco, sobe…), picos crescentes.
//  • Termina SEMPRE em 83% ao concluir o cronograma (nunca 93/100).
//  • Passos suaves — caminha pela lista 3/7 conforme a fração concluída.
//
// A MESMA fórmula está na RPC `tela_progresso` (SQL), pra a Início e a tela /tela
// mostrarem exatamente a mesma porcentagem.

const V37 = [3, 7, 13, 17, 23, 27, 33, 37, 43, 47, 53, 57, 63, 67, 73, 77, 83]

export function progressoPct(feitos: number, total: number): number {
  if (!total || total <= 0) return 0
  const F = Math.max(0, Math.min(feitos, total))
  if (F >= total) return 83            // último bloco concluído → 83%
  const last = V37.length - 1          // 16 → posição do 83
  const dip = (F % 3 === 2) ? 1 : 0    // quedinha periódica (desce uma casa)
  let k = Math.round(last * Math.pow(F / total, 0.85)) - dip
  k = Math.max(0, Math.min(last - 1, k))   // nunca chega no 83 antes do fim
  return V37[k]
}
