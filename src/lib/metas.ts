import type { Colaborador, Meta, PeriodoMeta } from "@/lib/types";
import { janelaCorrente, vigenteNaJanela, type Janela } from "@/lib/periodos";
import {
  alcanca,
  atende,
  DEFINICAO_METRICA,
  formatarMetrica,
  medirMetrica,
  progressoDaCondicao,
  type FontesMetricas,
} from "@/lib/metricas";

/**
 * Progresso de metas.
 *
 * A meta escolhe a métrica, o alvo e a janela; o cálculo é o de
 * `metricas.ts`, o mesmo que o ranking e as conquistas usam. O sentido da
 * métrica decide se bater é chegar ao alvo ou ficar abaixo dele.
 */

const ORDEM_PERIODO: Record<PeriodoMeta, number> = { diaria: 0, semanal: 1, mensal: 2 };

export interface ProgressoMeta {
  meta: Meta;
  janela: Janela;
  /** `null` quando a métrica é uma taxa sem base no período. */
  atual: number | null;
  batida: boolean;
  /** 0 a 1. */
  progresso: number;
}

/** Vale para esta pessoa, está ativa e a vigência cobre a janela. */
export function metaValeNaJanela(meta: Meta, colaborador: Colaborador, janela: Janela): boolean {
  return (
    meta.ativa &&
    meta.periodo === janela.periodo &&
    alcanca(meta, colaborador) &&
    vigenteNaJanela(meta, janela)
  );
}

/** Metas ativas do colaborador agora, da janela mais curta para a mais longa. */
export function metasDoColaborador(
  metas: Meta[],
  colaborador: Colaborador,
  referencia = new Date(),
): Meta[] {
  return metas
    .filter((m) => metaValeNaJanela(m, colaborador, janelaCorrente(m.periodo, referencia)))
    .sort((a, b) => ORDEM_PERIODO[a.periodo] - ORDEM_PERIODO[b.periodo] || a.nome.localeCompare(b.nome, "pt-BR"));
}

export function medirMeta(
  meta: Meta,
  colaborador: Colaborador,
  fontes: FontesMetricas,
  janela: Janela = janelaCorrente(meta.periodo),
): ProgressoMeta {
  const operador = DEFINICAO_METRICA[meta.metrica].sentido;
  const atual = medirMetrica(meta.metrica, colaborador, janela, fontes);
  return {
    meta,
    janela,
    atual,
    batida: atende(atual, operador, meta.alvo),
    progresso: progressoDaCondicao(atual, operador, meta.alvo),
  };
}

/** `12 agendados` ou `R$ 8.000,00` — o alvo em palavras. */
export function formatarAlvo(meta: Meta, valor: number | null): string {
  return formatarMetrica(meta.metrica, valor);
}

/** `Pelo menos 12 agendados no dia`. */
export function descreverMeta(meta: Meta): string {
  const def = DEFINICAO_METRICA[meta.metrica];
  const quando = meta.periodo === "diaria" ? "no dia" : meta.periodo === "semanal" ? "na semana" : "no mês";
  const verbo = def.sentido === "maior_igual" ? "Pelo menos" : "No máximo";
  return `${verbo} ${formatarMetrica(meta.metrica, meta.alvo)} ${quando}`;
}
