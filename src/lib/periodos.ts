import type { DataISO, PeriodoMeta } from "@/lib/types";

/**
 * Janelas de tempo de metas, ranking e comissões.
 *
 * Os limites são calculados no fuso de São Paulo com aritmética explícita, e
 * não com `setHours` local: servidor e navegador precisam cortar o dia no
 * mesmo instante, senão a contagem diverge na hidratação.
 *
 * A referência é o momento atual, no fuso de São Paulo. A janela corrente fica
 * aberta no fim, para contar também o que foi criado nesta sessão.
 */

const OFFSET_MS = 3 * 3_600_000;
const DIA_MS = 86_400_000;

export interface Intervalo {
  inicio: Date;
  /** Exclusivo. `null` quando a janela ainda está correndo. */
  fim: Date | null;
}

/** Meia-noite de São Paulo do dia de `data`. */
function inicioDoDiaBR(data: Date): Date {
  const local = new Date(data.getTime() - OFFSET_MS);
  return new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) + OFFSET_MS,
  );
}

/** Dia 1 do mês de `data`, deslocado `meses` meses, à meia-noite de São Paulo. */
function inicioDoMesBR(data: Date, meses = 0): Date {
  const local = new Date(data.getTime() - OFFSET_MS);
  return new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + meses, 1) + OFFSET_MS,
  );
}

/** Semana de segunda a domingo. */
function inicioDaSemanaBR(data: Date): Date {
  const dia = inicioDoDiaBR(data);
  const semana = new Date(dia.getTime() - OFFSET_MS).getUTCDay();
  const recuo = (semana + 6) % 7;
  return new Date(dia.getTime() - recuo * DIA_MS);
}

export function dentro(iso: DataISO | null, intervalo: Intervalo): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return t >= intervalo.inicio.getTime() && (intervalo.fim === null || t < intervalo.fim.getTime());
}

/** Janela corrente de uma meta. */
export function janelaDaMeta(periodo: PeriodoMeta, referencia = new Date()): Intervalo {
  if (periodo === "diaria") return { inicio: inicioDoDiaBR(referencia), fim: null };
  if (periodo === "semanal") return { inicio: inicioDaSemanaBR(referencia), fim: null };
  return { inicio: inicioDoMesBR(referencia), fim: null };
}

/** `aaaa-mm` de um instante, no fuso de São Paulo. */
export function competenciaDe(iso: DataISO | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Date(d.getTime() - OFFSET_MS).toISOString().slice(0, 7);
}

export function competenciaAtual(referencia = new Date()): string {
  return competenciaDe(referencia);
}

/** A competência é o mês cheio; a corrente fica aberta no fim. */
export function intervaloDaCompetencia(competencia: string, referencia = new Date()): Intervalo {
  const [ano, mes] = competencia.split("-").map(Number);
  const inicio = new Date(Date.UTC(ano, mes - 1, 1) + OFFSET_MS);
  const aberta = competencia === competenciaAtual(referencia);
  return { inicio, fim: aberta ? null : new Date(Date.UTC(ano, mes, 1) + OFFSET_MS) };
}

/**
 * Janelas de uma meta dentro da competência, recortadas no mês: a semana que
 * atravessa a virada conta só os dias deste lado. Para na referência — janela
 * futura não existe ainda.
 */
export function janelasNaCompetencia(
  periodo: PeriodoMeta,
  competencia: string,
  referencia = new Date(),
): Intervalo[] {
  const mes = intervaloDaCompetencia(competencia, referencia);
  if (periodo === "mensal") return [mes];

  const limite = mes.fim ?? new Date(inicioDoDiaBR(referencia).getTime() + DIA_MS);
  const janelas: Intervalo[] = [];
  let inicio = mes.inicio;
  while (inicio.getTime() < limite.getTime()) {
    const proximo =
      periodo === "diaria"
        ? new Date(inicio.getTime() + DIA_MS)
        : new Date(inicioDaSemanaBR(inicio).getTime() + 7 * DIA_MS);
    const corrente = proximo.getTime() >= limite.getTime() && mes.fim === null;
    janelas.push({
      inicio,
      fim: corrente ? null : new Date(Math.min(proximo.getTime(), limite.getTime())),
    });
    inicio = proximo;
  }
  return janelas;
}

/** As últimas `quantidade` competências, da mais recente para a mais antiga. */
export function ultimasCompetencias(quantidade: number, referencia = new Date()): string[] {
  return Array.from({ length: quantidade }, (_, i) =>
    competenciaDe(inicioDoMesBR(referencia, -i)),
  );
}

export type PeriodoRanking = "hoje" | "semana" | "mes" | "mes_anterior" | "90_dias";

export const PERIODOS_RANKING: Array<{ valor: PeriodoRanking; rotulo: string }> = [
  { valor: "hoje", rotulo: "Hoje" },
  { valor: "semana", rotulo: "Esta semana" },
  { valor: "mes", rotulo: "Este mês" },
  { valor: "mes_anterior", rotulo: "Mês passado" },
  { valor: "90_dias", rotulo: "Últimos 90 dias" },
];

export function intervaloDoRanking(periodo: PeriodoRanking, referencia = new Date()): Intervalo {
  switch (periodo) {
    case "hoje":
      return janelaDaMeta("diaria", referencia);
    case "semana":
      return janelaDaMeta("semanal", referencia);
    case "mes":
      return janelaDaMeta("mensal", referencia);
    case "mes_anterior":
      return { inicio: inicioDoMesBR(referencia, -1), fim: inicioDoMesBR(referencia) };
    case "90_dias":
      return { inicio: new Date(inicioDoDiaBR(referencia).getTime() - 89 * DIA_MS), fim: null };
  }
}

/* ----------------------------------------------------------------
   Períodos de análise: financeiro e marketing.

   Trafegam como dois dias `aaaa-mm-dd`, inclusive nas duas pontas. O dia é
   sempre o de São Paulo, cortado pela mesma aritmética das janelas acima.
   ---------------------------------------------------------------- */

/** `aaaa-mm-dd` de um instante, no fuso de São Paulo. */
export function diaDe(iso: DataISO | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Date(d.getTime() - OFFSET_MS).toISOString().slice(0, 10);
}

export function hoje(referencia = new Date()): string {
  return diaDe(referencia);
}

/** Meia-noite de São Paulo de um `aaaa-mm-dd`. */
export function inicioDoDia(dia: string): Date {
  const [ano, mes, d] = dia.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, d) + OFFSET_MS);
}

/** Soma dias a um `aaaa-mm-dd`. */
export function somarDias(dia: string, dias: number): string {
  return diaDe(new Date(inicioDoDia(dia).getTime() + dias * DIA_MS));
}

/** ISO ao meio-dia de São Paulo, para datas escolhidas num campo de data. */
export function isoDoDia(dia: string): DataISO {
  return `${dia}T12:00:00-03:00`;
}

/**
 * Intervalo de `de` a `ate`, inclusive. Quando alcança hoje, fica aberto no
 * fim, para contar o que foi lançado nesta sessão.
 */
export function intervaloDeDias(de: string, ate: string, referencia = new Date()): Intervalo {
  return {
    inicio: inicioDoDia(de),
    fim: ate >= hoje(referencia) ? null : inicioDoDia(somarDias(ate, 1)),
  };
}

/** Os dias de `de` a `ate`, em ordem. */
export function diasEntre(de: string, ate: string): string[] {
  const dias: string[] = [];
  for (let dia = de; dia <= ate; dia = somarDias(dia, 1)) dias.push(dia);
  return dias;
}

export function competenciaAnterior(competencia: string, meses = 1): string {
  const [ano, mes] = competencia.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1 - meses, 1)).toISOString().slice(0, 7);
}

/** Primeiro e último dia de uma competência. */
export function diasDaCompetencia(competencia: string): { de: string; ate: string } {
  const proxima = competenciaAnterior(competencia, -1);
  return { de: `${competencia}-01`, ate: somarDias(`${proxima}-01`, -1) };
}

export type PresetPeriodo = "7d" | "30d" | "90d" | "mes" | "mes_anterior" | "personalizado";

export const PRESETS_PERIODO: Array<{ valor: PresetPeriodo; rotulo: string }> = [
  { valor: "7d", rotulo: "7 dias" },
  { valor: "30d", rotulo: "30 dias" },
  { valor: "90d", rotulo: "90 dias" },
  { valor: "mes", rotulo: "Este mês" },
  { valor: "mes_anterior", rotulo: "Mês passado" },
  { valor: "personalizado", rotulo: "Personalizado" },
];

export interface PeriodoAnalise {
  preset: PresetPeriodo;
  de: string;
  ate: string;
}

/** Datas de um preset. `personalizado` devolve os últimos 30 dias como ponto de partida. */
export function periodoDoPreset(preset: PresetPeriodo, referencia = new Date()): PeriodoAnalise {
  const dia = hoje(referencia);
  switch (preset) {
    case "7d":
      return { preset, de: somarDias(dia, -6), ate: dia };
    case "90d":
      return { preset, de: somarDias(dia, -89), ate: dia };
    case "mes":
      return { preset, de: `${dia.slice(0, 7)}-01`, ate: dia };
    case "mes_anterior":
      return { preset, ...diasDaCompetencia(competenciaAnterior(dia.slice(0, 7))) };
    default:
      return { preset, de: somarDias(dia, -29), ate: dia };
  }
}
