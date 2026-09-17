import type {
  BonusNivel,
  Centavos,
  Colaborador,
  LinhaDetalhe,
  Meta,
  Nivel,
  PagamentoColaborador,
  Pedido,
} from "@/lib/types";
import { ROTULO_PERIODO_META } from "@/lib/types";
import { formatBps, formatBRL, formatData, formatDataCurta } from "@/lib/format";
import {
  competenciaDe,
  intervaloDaCompetencia,
  janelasNaCompetencia,
  type Intervalo,
} from "@/lib/periodos";
import {
  carteiraDe,
  enviadosNo,
  faturamentoBruto,
  pagosNo,
  valorRecebido,
} from "@/lib/desempenho";
import { descreverRecompensa, formatarAlvo, medirMeta } from "@/lib/metas";
import { iso } from "@/lib/iso";

/**
 * Comissões e fechamentos.
 *
 * Vendedor: faturamento bruto dos pedidos enviados no período × (1 − % de
 * frustrado) × % de comissão. Cancelados não entram — nunca foram enviados.
 * Cobrador: % de comissão sobre o valor efetivamente recebido.
 */

/** Setores que recebem comissão. Administração fica de fora. */
export function comissionavel(colaborador: Colaborador): boolean {
  return colaborador.setor === "vendas" || colaborador.setor === "financeiro";
}

/** A fórmula do vendedor, em centavos inteiros. */
export function comissaoVendedor(
  faturamento: Centavos,
  frustradoBps: number,
  comissaoBps: number,
): Centavos {
  return Math.round((faturamento * (10_000 - frustradoBps) * comissaoBps) / 100_000_000);
}

export function comissaoCobrador(recebido: Centavos, comissaoBps: number): Centavos {
  return Math.round((recebido * comissaoBps) / 10_000);
}

/** Base sobre a qual a % de comissão incide, já descontado o frustrado. */
export function baseDaComissao(colaborador: Colaborador, carteira: Pedido[], intervalo: Intervalo) {
  if (colaborador.setor === "financeiro") {
    const recebido = valorRecebido(pagosNo(carteira, intervalo));
    return { bruto: recebido, base: recebido };
  }
  const bruto = faturamentoBruto(enviadosNo(carteira, intervalo));
  const frustrado = colaborador.frustradoBps ?? 0;
  return { bruto, base: Math.round((bruto * (10_000 - frustrado)) / 10_000) };
}

/** `R$ 100.000,00 × (1 − 30,00%) × 3,00%` — a conta que a tela mostra. */
export function contaVendedor(bruto: Centavos, frustradoBps: number, comissaoBps: number) {
  return `${formatBRL(bruto)} × (1 − ${formatBps(frustradoBps)}) × ${formatBps(comissaoBps)}`;
}

/** Dia de pagamento do colaborador no mês seguinte à competência. */
export function dataDePagamento(colaborador: Colaborador, competencia: string): string {
  const [ano, mes] = competencia.split("-").map(Number);
  const dia = Math.min(Math.max(colaborador.diaPagamento, 1), 28);
  return iso(new Date(Date.UTC(ano, mes, dia, 15, 0, 0)));
}

interface ContextoFechamento {
  metas: Meta[];
  niveis: Nivel[];
  bonusNivel: BonusNivel[];
}

/**
 * Fechamento calculado de um colaborador. É o que a tela mostra enquanto a
 * competência não foi paga; pagar congela exatamente este objeto.
 */
export function calcularFechamento(
  colaborador: Colaborador,
  competencia: string,
  pedidos: Pedido[],
  { metas, niveis, bonusNivel }: ContextoFechamento,
): PagamentoColaborador {
  const carteira = carteiraDe(colaborador, pedidos);
  const mes = intervaloDaCompetencia(competencia);
  const linhas: LinhaDetalhe[] = [];

  /* --- fixo --- */
  linhas.push({
    grupo: "fixo",
    rotulo: "Salário fixo",
    conta: null,
    valor: colaborador.salarioFixo,
  });

  /* --- comissão --- */
  const { bruto } = baseDaComissao(colaborador, carteira, mes);
  const comissao =
    colaborador.setor === "financeiro"
      ? comissaoCobrador(bruto, colaborador.comissaoBps)
      : comissaoVendedor(bruto, colaborador.frustradoBps ?? 0, colaborador.comissaoBps);
  linhas.push(
    colaborador.setor === "financeiro"
      ? {
          grupo: "comissao",
          rotulo: `Comissão sobre ${pagosNo(carteira, mes).length} pedidos pagos`,
          conta: `${formatBRL(bruto)} recebidos × ${formatBps(colaborador.comissaoBps)}`,
          valor: comissao,
        }
      : {
          grupo: "comissao",
          rotulo: `Comissão sobre ${enviadosNo(carteira, mes).length} pedidos enviados`,
          conta: contaVendedor(bruto, colaborador.frustradoBps ?? 0, colaborador.comissaoBps),
          valor: comissao,
        },
  );

  /* --- bônus de meta: cada janela da competência, faixa mais alta --- */
  let bonusMeta = 0;
  for (const meta of metas.filter((m) => m.colaboradorId === colaborador.id && m.ativa)) {
    for (const janela of janelasNaCompetencia(meta.periodo, competencia)) {
      const { atingida, atual } = medirMeta(meta, colaborador, pedidos, janela);
      if (!atingida) continue;
      const quando =
        meta.periodo === "mensal"
          ? "no mês"
          : meta.periodo === "semanal"
            ? `semana de ${formatDataCurta(iso(janela.inicio))}`
            : formatData(iso(janela.inicio));
      let valor = atingida.valor;
      let conta = `${formatarAlvo(meta.tipo, atual)} de ${formatarAlvo(meta.tipo, atingida.alvo)} · ${descreverRecompensa(atingida)}`;
      if (atingida.recompensa === "percentual") {
        const baseJanela = baseDaComissao(colaborador, carteira, janela).base;
        valor = Math.round((baseJanela * atingida.valor) / 10_000);
        conta = `${conta} · ${formatBRL(baseJanela)} × ${formatBps(atingida.valor)}`;
      }
      if (valor <= 0) continue;
      bonusMeta += valor;
      linhas.push({
        grupo: "bonus_meta",
        rotulo: `${meta.nome} (${ROTULO_PERIODO_META[meta.periodo].toLowerCase()}, ${quando})`,
        conta,
        valor,
      });
    }
  }

  /* --- bônus de nível liberado na competência --- */
  let bonusNivelTotal = 0;
  const bonusNivelIds: string[] = [];
  for (const bonus of bonusNivel.filter(
    (b) => b.colaboradorId === colaborador.id && competenciaDe(b.liberadoEm) === competencia,
  )) {
    const nivel = niveis.find((n) => n.id === bonus.nivelId);
    const pagoAParte = bonus.status === "pago";
    if (!pagoAParte) {
      bonusNivelTotal += bonus.valor;
      bonusNivelIds.push(bonus.id);
    }
    linhas.push({
      grupo: "bonus_nivel",
      rotulo: `Chegou a ${nivel?.nome ?? "novo nível"}`,
      conta: pagoAParte
        ? `Pix confirmado à parte em ${formatData(bonus.pagoEm)}`
        : `Liberado em ${formatData(bonus.liberadoEm)}`,
      valor: bonus.valor,
      informativa: pagoAParte,
    });
  }

  const total = colaborador.salarioFixo + comissao + bonusMeta + bonusNivelTotal;

  return {
    id: `fch_${colaborador.id}_${competencia}`,
    colaboradorId: colaborador.id,
    competencia,
    fixo: colaborador.salarioFixo,
    comissao,
    bonusMeta,
    bonusNivel: bonusNivelTotal,
    total,
    pagarEm: dataDePagamento(colaborador, competencia),
    status: "pendente",
    pagoEm: null,
    detalhamento: linhas,
    bonusNivelIds,
  };
}

/** O colaborador já estava na casa na competência? */
export function ativoNaCompetencia(colaborador: Colaborador, competencia: string): boolean {
  return competenciaDe(colaborador.entrouEm) <= competencia;
}

/**
 * Fechamentos de uma competência: o pago vem congelado do registro, o
 * pendente é recalculado dos pedidos. Comissões e relatório financeiro leem
 * daqui, para o mesmo mês nunca somar diferente nas duas telas.
 */
export function fechamentosDaCompetencia(
  competencia: string,
  colaboradores: Colaborador[],
  pagamentos: PagamentoColaborador[],
  pedidos: Pedido[],
  contexto: ContextoFechamento,
): PagamentoColaborador[] {
  const pagos = pagamentos.filter((p) => p.competencia === competencia);
  const pendentes = colaboradores
    .filter(
      (c) =>
        comissionavel(c) &&
        c.ativo &&
        ativoNaCompetencia(c, competencia) &&
        !pagos.some((p) => p.colaboradorId === c.id),
    )
    .map((c) => calcularFechamento(c, competencia, pedidos, contexto));
  return [...pagos, ...pendentes];
}
