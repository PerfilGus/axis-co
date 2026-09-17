import type {
  Colaborador,
  Conquista,
  ConquistaDesbloqueada,
  FaixaMeta,
  Meta,
  PeriodoMeta,
  Pedido,
} from "@/lib/types";
import { formatBRL, formatNumero } from "@/lib/format";
import { baseDaComissao } from "@/lib/comissoes";
import { carteiraDe } from "@/lib/desempenho";
import { medirMeta } from "@/lib/metas";
import {
  diaDe,
  hoje,
  intervaloDeDias,
  janelaDaMeta,
  somarDias,
  type Intervalo,
} from "@/lib/periodos";

/**
 * A Minha área: o que o próprio colaborador vê de si. Tudo é recalculado dos
 * pedidos, metas e conquistas da sessão — nada aqui é guardado.
 */

const ORDEM_PERIODO: Record<PeriodoMeta, number> = { diaria: 0, semanal: 1, mensal: 2 };

/** Metas ativas do colaborador, da janela mais curta para a mais longa. */
export function metasDoColaborador(metas: Meta[], colaboradorId: string): Meta[] {
  return metas
    .filter((m) => m.colaboradorId === colaboradorId && m.ativa)
    .sort((a, b) => ORDEM_PERIODO[a.periodo] - ORDEM_PERIODO[b.periodo]);
}

/** `3 agendados`, `1 pago` ou `R$ 800,00` — o que a meta conta, no setor de quem vê. */
export function unidadeDaMeta(colaborador: Colaborador, tipo: Meta["tipo"], valor: number): string {
  if (tipo === "faturamento") return formatBRL(valor);
  const [um, varios] = colaborador.setor === "financeiro" ? ["pago", "pagos"] : ["agendado", "agendados"];
  return `${formatNumero(valor)} ${valor === 1 ? um : varios}`;
}

/**
 * Quanto a faixa põe no bolso. Bônus é o valor fechado; percentual é estimado
 * sobre a base de comissão que a janela já tem — cresce se ele vender mais.
 */
export function valorDaFaixa(
  faixa: FaixaMeta,
  colaborador: Colaborador,
  pedidos: Pedido[],
  janela: Intervalo,
): { valor: number; estimado: boolean } {
  if (faixa.recompensa === "bonus") return { valor: faixa.valor, estimado: false };
  const { base } = baseDaComissao(colaborador, carteiraDe(colaborador, pedidos), janela);
  return { valor: Math.round((base * faixa.valor) / 10_000), estimado: true };
}

export interface DiaDaSemana {
  dia: string;
  trabalhado: boolean;
  /** `null` quando o colaborador não tem meta diária para bater. */
  metaBatida: boolean | null;
  ehHoje: boolean;
  futuro: boolean;
}

/** Segunda a domingo da semana corrente. */
export function semanaDoColaborador(
  colaborador: Colaborador,
  pedidos: Pedido[],
  metas: Meta[],
  atividade: Set<string>,
  referencia = new Date(),
): DiaDaSemana[] {
  const dia0 = diaDe(janelaDaMeta("semanal", referencia).inicio);
  const hojeDia = hoje(referencia);
  const diarias = metasDoColaborador(metas, colaborador.id).filter((m) => m.periodo === "diaria");

  return Array.from({ length: 7 }, (_, i) => {
    const dia = somarDias(dia0, i);
    const futuro = dia > hojeDia;
    const intervalo = intervaloDeDias(dia, dia, referencia);
    return {
      dia,
      trabalhado: !futuro && atividade.has(dia),
      metaBatida:
        diarias.length === 0
          ? null
          : !futuro &&
            diarias.some((m) => medirMeta(m, colaborador, pedidos, intervalo).atingida !== null),
      ehHoje: dia === hojeDia,
      futuro,
    };
  });
}

/**
 * Dias seguidos com atividade. Hoje ainda sem movimento não quebra a
 * sequência: ela conta a partir de ontem até o dia acabar.
 */
export function sequenciaDeDias(atividade: Set<string>, referencia = new Date()): number {
  let dia = hoje(referencia);
  if (!atividade.has(dia)) dia = somarDias(dia, -1);
  let total = 0;
  while (atividade.has(dia)) {
    total += 1;
    dia = somarDias(dia, -1);
  }
  return total;
}

export interface EtapaConquista {
  conquista: Conquista;
  feita: boolean;
  /** A janela em que "feita" vale: a conquista repetível volta a abrir depois. */
  janela: "hoje" | "semana" | "mês" | null;
}

const PERIODO_DO_GATILHO: Partial<Record<Conquista["gatilho"], PeriodoMeta>> = {
  meta_diaria: "diaria",
  meta_semanal: "semanal",
  meta_mensal: "mensal",
};

const JANELA_DO_PERIODO: Record<PeriodoMeta, EtapaConquista["janela"]> = {
  diaria: "hoje",
  semanal: "semana",
  mensal: "mês",
};

/**
 * Conquistas ao alcance, com o que já foi feito na janela corrente. Metas só
 * entram se o colaborador tem meta daquele período; marco já desbloqueado sai.
 *
 * Feriados ainda não têm cadastro: `domingo_feriado` olha só o domingo.
 */
export function proximasConquistas(
  colaborador: Colaborador,
  conquistas: Conquista[],
  desbloqueadas: ConquistaDesbloqueada[],
  metas: Meta[],
  pedidos: Pedido[],
  atividade: Set<string>,
  referencia = new Date(),
): EtapaConquista[] {
  const minhas = metasDoColaborador(metas, colaborador.id);
  const hojeDia = hoje(referencia);
  const domingo = somarDias(diaDe(janelaDaMeta("semanal", referencia).inicio), 6);

  const etapas: EtapaConquista[] = [];
  for (const conquista of conquistas) {
    if (!conquista.ativa) continue;
    const jaTem = desbloqueadas.some(
      (d) => d.conquistaId === conquista.id && d.colaboradorId === colaborador.id,
    );
    if (!conquista.repetivel && jaTem) continue;

    const periodo = PERIODO_DO_GATILHO[conquista.gatilho];
    if (periodo) {
      const doPeriodo = minhas.filter((m) => m.periodo === periodo);
      if (doPeriodo.length === 0) continue;
      etapas.push({
        conquista,
        feita: doPeriodo.some((m) => medirMeta(m, colaborador, pedidos).atingida !== null),
        janela: JANELA_DO_PERIODO[periodo],
      });
    } else if (conquista.gatilho === "dias_trabalhados") {
      etapas.push({ conquista, feita: atividade.has(hojeDia), janela: "hoje" });
    } else if (conquista.gatilho === "domingo_feriado") {
      etapas.push({
        conquista,
        feita: domingo <= hojeDia && atividade.has(domingo),
        janela: "semana",
      });
    } else {
      etapas.push({ conquista, feita: false, janela: null });
    }
  }
  // As feitas vêm antes, para o indicador encher da esquerda para a direita.
  return etapas.sort((a, b) => Number(b.feita) - Number(a.feita));
}
