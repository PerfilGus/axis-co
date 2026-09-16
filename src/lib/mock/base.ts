/**
 * Base dos mocks.
 *
 * Tudo é determinístico: o mesmo seed produz sempre os mesmos dados. Isso
 * evita divergência entre servidor e cliente na hidratação e deixa as telas
 * estáveis entre recarregamentos.
 */

/** "Hoje" do sistema enquanto não há backend. */
export const HOJE = new Date("2026-09-15T12:00:00-03:00");

export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = ReturnType<typeof rng>;

export function escolher<T>(r: Rng, lista: readonly T[]): T {
  return lista[Math.floor(r() * lista.length)];
}

export function inteiro(r: Rng, min: number, max: number): number {
  return min + Math.floor(r() * (max - min + 1));
}

export function talvez(r: Rng, probabilidade: number): boolean {
  return r() < probabilidade;
}

/** Soma dias (aceita frações) e devolve ISO com fuso de São Paulo. */
export function maisDias(base: Date, dias: number): Date {
  return new Date(base.getTime() + dias * 86_400_000);
}

export function maisHoras(base: Date, horas: number): Date {
  return new Date(base.getTime() + horas * 3_600_000);
}

const OFFSET_BR = "-03:00";

/** ISO fixo em -03:00 para não depender do fuso de quem renderiza. */
export function iso(data: Date): string {
  const utc = new Date(data.getTime() - 3 * 3_600_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${utc.getUTCFullYear()}-${p(utc.getUTCMonth() + 1)}-${p(utc.getUTCDate())}` +
    `T${p(utc.getUTCHours())}:${p(utc.getUTCMinutes())}:${p(utc.getUTCSeconds())}${OFFSET_BR}`
  );
}

/** `aaaa-mm-dd`, para lançamentos diários. */
export function isoDia(data: Date): string {
  return iso(data).slice(0, 10);
}

/** `aaaa-mm` da competência. */
export function competencia(data: Date): string {
  return iso(data).slice(0, 7);
}

export function id(prefixo: string, n: number): string {
  return `${prefixo}_${String(n).padStart(4, "0")}`;
}
