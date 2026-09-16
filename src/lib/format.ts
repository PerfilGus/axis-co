import type { Centavos, DataISO } from "@/lib/types";

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const brlCompacto = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});
const numero = new Intl.NumberFormat("pt-BR");

/** `123456` → `R$ 1.234,56` */
export function formatBRL(centavos: Centavos): string {
  return brl.format(centavos / 100);
}

/** `1234567` → `R$ 12,3 mil` — só para cards de indicador. */
export function formatBRLCompacto(centavos: Centavos): string {
  return brlCompacto.format(centavos / 100);
}

export function formatNumero(valor: number): string {
  return numero.format(valor);
}

/** Base points → `15,5%` */
export function formatBps(bps: number, casas = 2): string {
  return `${(bps / 100).toFixed(casas).replace(".", ",")}%`;
}

export function formatPercentual(fracao: number, casas = 1): string {
  return `${(fracao * 100).toFixed(casas).replace(".", ",")}%`;
}

/** `2026-03-14T…` → `14/03/2026` */
export function formatData(iso: DataISO | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

/** `14/03/2026 às 18:22` */
export function formatDataHora(iso: DataISO | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} às ${d.toLocaleTimeString(
    "pt-BR",
    { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" },
  )}`;
}

/** `14 de março` */
export function formatDataCurta(iso: DataISO | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    timeZone: "America/Sao_Paulo",
  });
}

/** `há 3 dias`, `em 2 horas` */
export function formatRelativo(iso: DataISO | null, agora = new Date()): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diff = d.getTime() - agora.getTime();
  const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
  const minutos = Math.round(diff / 60000);
  if (Math.abs(minutos) < 60) return rtf.format(minutos, "minute");
  const horas = Math.round(minutos / 60);
  if (Math.abs(horas) < 24) return rtf.format(horas, "hour");
  const dias = Math.round(horas / 24);
  if (Math.abs(dias) < 30) return rtf.format(dias, "day");
  return rtf.format(Math.round(dias / 30), "month");
}

export function formatTelefone(valor: string): string {
  const d = valor.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return valor;
}

export function formatCPF(valor: string | null): string {
  if (!valor) return "—";
  const d = valor.replace(/\D/g, "");
  if (d.length !== 11) return valor;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function formatCEP(valor: string): string {
  const d = valor.replace(/\D/g, "");
  if (d.length !== 8) return valor;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

/** `aaaa-mm` → `março de 2026` */
export function formatCompetencia(competencia: string): string {
  const [ano, mes] = competencia.split("-").map(Number);
  const d = new Date(Date.UTC(ano, (mes ?? 1) - 1, 1));
  return d.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

/** `1.234,56` ou `1234,56` → `123456` centavos. Devolve `null` se não der. */
export function parseBRL(texto: string): Centavos | null {
  const limpo = texto.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  if (limpo === "" || limpo === "-") return null;
  const numero = Number(limpo);
  if (!Number.isFinite(numero)) return null;
  return Math.round(numero * 100);
}

/** Máscara progressiva de telefone, para digitação. */
export function mascaraTelefone(valor: string): string {
  const d = valor.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function mascaraCPF(valor: string): string {
  const d = valor.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function mascaraCEP(valor: string): string {
  const d = valor.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

/** Apenas dígitos — o que vai para o modelo. */
export function digitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

/* ----------------------------------------------------------------
   Formatadores portados do axis-tracking. Mantêm o formato exato da
   tela original — ver referencia/axis-tracking/INVENTARIO.md §4.
   ---------------------------------------------------------------- */

/** `dd/mm/aaaa hh:mm` — painel de detalhe e CSV (`fmtDateTime`). */
export function formatDataHoraCurta(iso: DataISO | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** `dd/mm hh:mm` — timeline de eventos (`fmtEventDateTime`). */
export function formatDataHoraEvento(iso: DataISO | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** `há X min` · `há Xh` · `há Xd` — card e painel (`fmtRelative`). */
export function formatHa(iso: DataISO | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const min = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.round(h / 24)}d`;
}

/* ----------------------------------------------------------------
   Campos de formulário: o valor do modelo vira texto editável e volta.
   ---------------------------------------------------------------- */

/** `123456` → `1.234,56`, para preencher um campo de dinheiro. */
export function centavosParaCampo(centavos: Centavos | null): string {
  if (centavos === null) return "";
  return (centavos / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** `350` → `3,5`, para preencher um campo de percentual. */
export function bpsParaCampo(bps: number | null): string {
  if (bps === null) return "";
  return String(bps / 100).replace(".", ",");
}

/** `3,5` ou `3.5%` → `350` base points. Devolve `null` se não der. */
export function parsePercentual(texto: string): number | null {
  const limpo = texto.replace(/[^\d,.-]/g, "").replace(",", ".");
  if (limpo === "" || limpo === "-") return null;
  const numero = Number(limpo);
  if (!Number.isFinite(numero)) return null;
  return Math.round(numero * 100);
}

/* ----------------------------------------------------------------
   Dias `aaaa-mm-dd`, sem hora nem fuso: formatados pelo texto.
   ---------------------------------------------------------------- */

const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** `2026-09-14` → `14/09/2026` */
export function formatDia(dia: string): string {
  return `${dia.slice(8, 10)}/${dia.slice(5, 7)}/${dia.slice(0, 4)}`;
}

/** `2026-09-14` → `14/09` */
export function formatDiaCurto(dia: string): string {
  return `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
}

/** `2026-09-14` → `seg` */
export function diaDaSemana(dia: string): string {
  const [ano, mes, d] = dia.split("-").map(Number);
  return DIAS_SEMANA[new Date(Date.UTC(ano, mes - 1, d)).getUTCDay()];
}

/** `2026-09` → `set/26`, para eixos e colunas estreitas. */
export function formatCompetenciaCurta(competencia: string): string {
  const [ano, mes] = competencia.split("-").map(Number);
  const nome = new Date(Date.UTC(ano, mes - 1, 1))
    .toLocaleDateString("pt-BR", { month: "short", timeZone: "UTC" })
    .replace(".", "");
  return `${nome}/${String(ano).slice(2)}`;
}
