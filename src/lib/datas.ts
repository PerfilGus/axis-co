/**
 * Regras de data da operação.
 *
 * O corte da fila de autorização é o dia útil anterior: o que foi agendado
 * hoje ainda pode mudar, e o que ficou para trás precisa sair.
 */

/** Último dia útil antes de `referencia`, às 23h59. */
export function diaUtilAnterior(referencia = new Date()): Date {
  const d = new Date(referencia);
  d.setHours(23, 59, 59, 999);
  do {
    d.setDate(d.getDate() - 1);
  } while (d.getDay() === 0 || d.getDay() === 6);
  return d;
}

export function ehFimDeSemana(data: Date): boolean {
  const dia = data.getDay();
  return dia === 0 || dia === 6;
}

/** Início do mês corrente, para os indicadores de competência. */
export function inicioDoMes(referencia = new Date()): Date {
  const d = new Date(referencia);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** `aaaa-mm-dd` no fuso local, para preencher `<input type="date">`. */
export function paraCampoData(data: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${data.getFullYear()}-${p(data.getMonth() + 1)}-${p(data.getDate())}`;
}

/** Converte o valor de um `<input type="date">` em ISO, ao meio-dia local. */
export function deCampoData(valor: string): string {
  const [ano, mes, dia] = valor.split("-").map(Number);
  return new Date(ano, (mes ?? 1) - 1, dia ?? 1, 12, 0, 0).toISOString();
}
