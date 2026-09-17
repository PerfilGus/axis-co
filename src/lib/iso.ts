/**
 * Datas em ISO com o fuso de São Paulo.
 *
 * O Brasil não tem horário de verão desde 2019: o deslocamento é sempre -03:00,
 * e a conversão é aritmética — nunca depende do fuso de quem renderiza.
 */

const OFFSET_BR = "-03:00";

/** ISO fixo em -03:00. */
export function iso(data: Date): string {
  const local = new Date(data.getTime() - 3 * 3_600_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${local.getUTCFullYear()}-${p(local.getUTCMonth() + 1)}-${p(local.getUTCDate())}` +
    `T${p(local.getUTCHours())}:${p(local.getUTCMinutes())}:${p(local.getUTCSeconds())}${OFFSET_BR}`
  );
}

/** `aaaa-mm-dd` em São Paulo. */
export function isoDia(data: Date): string {
  return iso(data).slice(0, 10);
}

/** Agora, em ISO de São Paulo. */
export function agoraISO(): string {
  return iso(new Date());
}
