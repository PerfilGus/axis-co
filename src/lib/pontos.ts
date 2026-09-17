import type {
  Centavos,
  Colaborador,
  EventoPontos,
  ID,
  LancamentoPontos,
  Nivel,
  Pedido,
  RegraPontuacao,
  SetorPontuavel,
  StatusPedido,
} from "@/lib/types";
import { formatBps } from "@/lib/format";
import { diaDe } from "@/lib/periodos";
import { cobradorDoVendedor } from "@/lib/dominio/pedidos";

/**
 * Pontos por pedido: quanto cada evento vale e o que falta lançar.
 *
 * Regras puras. O servidor executa sobre o que leu do banco (`servidor/pontos.ts`)
 * e a tela usa as mesmas funções no simulador — o número mostrado antes de
 * salvar é o mesmo que o pedido vai gerar depois.
 *
 * O extrato só recebe inserções: corrigir um status não apaga nada, lança o
 * contrário na data da correção.
 */

/** Pedido enviado e não pago. Cancelado tem regra própria: estorno total. */
export const STATUS_FRUSTRADOS_PONTOS: StatusPedido[] = ["reembolsado", "inadimplente"];

export const ehFrustradoParaPontos = (status: StatusPedido) =>
  STATUS_FRUSTRADOS_PONTOS.includes(status);

export const REGRA_PADRAO = {
  pontosFixos: 10,
  adicional: "nenhum" as const,
  faixasValor: [],
  pontosPorKit: [],
  penalidadeBps: 5_000,
  quedaNivelBps: 8_000,
};

/** A versão da regra que valia no dia. `null` antes da primeira vigência. */
export function regraVigente(
  regras: RegraPontuacao[],
  setor: SetorPontuavel,
  dia: string,
): RegraPontuacao | null {
  return (
    regras
      .filter((r) => r.setor === setor && r.vigenteDesde <= dia)
      .sort((a, b) => b.vigenteDesde.localeCompare(a.vigenteDesde))[0] ?? null
  );
}

/** A versão que vale a partir de amanhã, quando existe uma agendada. */
export function regraAgendada(
  regras: RegraPontuacao[],
  setor: SetorPontuavel,
  dia: string,
): RegraPontuacao | null {
  return (
    regras
      .filter((r) => r.setor === setor && r.vigenteDesde > dia)
      .sort((a, b) => a.vigenteDesde.localeCompare(b.vigenteDesde))[0] ?? null
  );
}

export interface PedidoPontuavel {
  valorTotal: Centavos;
  itens: Array<{ kitId: ID; quantidade: number }>;
}

/** Quanto o pedido vale pela regra: o fixo mais o adicional escolhido. */
export function pontosDoPedido(regra: RegraPontuacao, pedido: PedidoPontuavel): number {
  let total = regra.pontosFixos;
  if (regra.adicional === "faixa_valor") {
    const faixa = [...regra.faixasValor]
      .sort((a, b) => b.minimo - a.minimo)
      .find((f) => pedido.valorTotal >= f.minimo);
    total += faixa?.pontos ?? 0;
  }
  if (regra.adicional === "kit") {
    for (const item of pedido.itens) {
      const doKit = regra.pontosPorKit.find((k) => k.kitId === item.kitId);
      total += (doKit?.pontos ?? 0) * Math.max(item.quantidade, 1);
    }
  }
  return Math.max(total, 0);
}

/** A parte dos pontos que o frustrado leva embora. */
export function pontosDaPenalidade(base: number, penalidadeBps: number): number {
  return Math.round((base * penalidadeBps) / 10_000);
}

/* ================================================================
   O que falta lançar
   ================================================================ */

/** Famílias de eventos: o ganho e a reversão dele andam juntos. */
const FAMILIAS: Record<string, EventoPontos[]> = {
  agendamento: ["agendamento"],
  cancelamento: ["cancelamento", "cancelamento_revertido"],
  frustracao: ["frustracao", "frustracao_revertida"],
  pagamento: ["pagamento", "pagamento_revertido"],
};

export interface ContextoPontos {
  regras: RegraPontuacao[];
  colaboradores: Colaborador[];
  /** Data e hora do lançamento: sempre o momento da mudança de status. */
  agora: string;
  novoId: () => ID;
}

type Novo = Omit<LancamentoPontos, "id"> & { id: ID };

/**
 * A diferença entre o que o pedido já rendeu e o que ele deveria render no
 * status atual. Passar `null` no pedido (exclusão) devolve o estorno de tudo.
 *
 * O ganho do agendamento é congelado na criação; estorno e penalidade usam a
 * regra vigente no dia em que o status mudou.
 */
export function lancamentosDevidos(
  pedido: (Pedido & { codigo: string }) | null,
  existentes: LancamentoPontos[],
  ctx: ContextoPontos,
): LancamentoPontos[] {
  const novos: Novo[] = [];
  const dia = diaDe(ctx.agora);

  const somaDe = (colaboradorId: ID, familia: keyof typeof FAMILIAS) =>
    [...existentes, ...novos]
      .filter((l) => l.colaboradorId === colaboradorId && FAMILIAS[familia].includes(l.evento))
      .reduce((s, l) => s + l.pontos, 0);

  const quemTem = (familia: keyof typeof FAMILIAS) => {
    const ids = new Set(
      existentes.filter((l) => FAMILIAS[familia].includes(l.evento)).map((l) => l.colaboradorId),
    );
    return [...ids].filter((id) => somaDe(id, familia) !== 0);
  };

  const setorDe = (colaboradorId: ID, padrao: SetorPontuavel): SetorPontuavel =>
    existentes.find((l) => l.colaboradorId === colaboradorId)?.setor ?? padrao;

  function lancar(
    colaboradorId: ID,
    setor: SetorPontuavel,
    evento: EventoPontos,
    pontos: number,
    descricao: string,
    regraId: ID | null,
  ) {
    if (pontos === 0) return;
    novos.push({
      id: ctx.novoId(),
      colaboradorId,
      setor,
      pedidoId: pedido?.id ?? existentes[0]?.pedidoId ?? null,
      pedidoCodigo: pedido?.codigo ?? existentes[0]?.pedidoCodigo ?? null,
      evento,
      pontos,
      descricao,
      regraId,
      ocorridoEm: ctx.agora,
    });
  }

  if (!pedido) {
    const porColaborador = new Map<ID, number>();
    for (const l of existentes) {
      porColaborador.set(l.colaboradorId, (porColaborador.get(l.colaboradorId) ?? 0) + l.pontos);
    }
    for (const [colaboradorId, total] of porColaborador) {
      lancar(
        colaboradorId,
        setorDe(colaboradorId, "vendas"),
        "exclusao",
        -total,
        "Pedido excluído: pontos estornados",
        null,
      );
    }
    return novos;
  }

  /* --- vendedor --- */
  const vendedorId = pedido.vendedorId;
  const temAgendamento = existentes.some(
    (l) => l.colaboradorId === vendedorId && l.evento === "agendamento",
  );
  if (!temAgendamento) {
    const regra = regraVigente(ctx.regras, "vendas", diaDe(pedido.criadoEm));
    if (regra) {
      lancar(
        vendedorId,
        "vendas",
        "agendamento",
        pontosDoPedido(regra, pedido),
        "Pedido agendado",
        regra.id,
      );
    }
  }
  const ganhoVendedor = somaDe(vendedorId, "agendamento");

  const estorno = somaDe(vendedorId, "cancelamento");
  if (pedido.status === "cancelado" && estorno === 0) {
    lancar(
      vendedorId,
      "vendas",
      "cancelamento",
      -ganhoVendedor,
      "Pedido cancelado: pontos estornados por completo",
      null,
    );
  } else if (pedido.status !== "cancelado" && estorno !== 0) {
    lancar(vendedorId, "vendas", "cancelamento_revertido", -estorno, "Cancelamento desfeito", null);
  }

  const frustrado = ehFrustradoParaPontos(pedido.status);
  const penalidadeVendedor = somaDe(vendedorId, "frustracao");
  if (frustrado && penalidadeVendedor === 0 && ganhoVendedor > 0) {
    const regra = regraVigente(ctx.regras, "vendas", dia);
    if (regra) {
      lancar(
        vendedorId,
        "vendas",
        "frustracao",
        -pontosDaPenalidade(ganhoVendedor, regra.penalidadeBps),
        `Pedido frustrado: perde ${formatBps(regra.penalidadeBps, 0)} dos pontos do pedido`,
        regra.id,
      );
    }
  } else if (!frustrado && penalidadeVendedor !== 0) {
    lancar(
      vendedorId,
      "vendas",
      "frustracao_revertida",
      -penalidadeVendedor,
      "Frustração desfeita: penalidade devolvida",
      null,
    );
  }

  /* --- cobrador --- */
  const responsavelId =
    pedido.cobranca.responsavelId ?? cobradorDoVendedor(ctx.colaboradores, vendedorId);

  for (const colaboradorId of quemTem("pagamento")) {
    if (pedido.status === "pago" && colaboradorId === responsavelId) continue;
    lancar(
      colaboradorId,
      setorDe(colaboradorId, "financeiro"),
      "pagamento_revertido",
      -somaDe(colaboradorId, "pagamento"),
      "Pagamento desfeito",
      null,
    );
  }
  if (pedido.status === "pago" && responsavelId && somaDe(responsavelId, "pagamento") === 0) {
    const regra = regraVigente(ctx.regras, "financeiro", dia);
    if (regra) {
      lancar(
        responsavelId,
        "financeiro",
        "pagamento",
        pontosDoPedido(regra, pedido),
        "Pedido pago",
        regra.id,
      );
    }
  }

  for (const colaboradorId of quemTem("frustracao")) {
    if (colaboradorId === vendedorId) continue;
    if (frustrado && colaboradorId === responsavelId) continue;
    lancar(
      colaboradorId,
      "financeiro",
      "frustracao_revertida",
      -somaDe(colaboradorId, "frustracao"),
      "Frustração desfeita: penalidade devolvida",
      null,
    );
  }
  if (frustrado && responsavelId && responsavelId !== vendedorId && somaDe(responsavelId, "frustracao") === 0) {
    const regra = regraVigente(ctx.regras, "financeiro", dia);
    if (regra) {
      const valeria = pontosDoPedido(regra, pedido);
      lancar(
        responsavelId,
        "financeiro",
        "frustracao",
        -pontosDaPenalidade(valeria, regra.penalidadeBps),
        `Pedido frustrado: perde ${formatBps(regra.penalidadeBps, 0)} do que valeria pago`,
        regra.id,
      );
    }
  }

  return novos;
}

/* ================================================================
   Trilha de níveis
   ================================================================ */

/**
 * O nível que o saldo sustenta, já com a tolerância de queda: quem cai abaixo
 * do mínimo continua no nível enquanto tiver mais que `quedaNivelBps` de
 * progresso na faixa do nível anterior.
 */
export function nivelComQueda(
  niveis: Nivel[],
  nivelAtualId: ID | null,
  pontos: number,
  quedaNivelBps: number,
): Nivel | null {
  const ordenados = [...niveis].sort((a, b) => a.ordem - b.ordem);
  if (ordenados.length === 0) return null;
  const alcancado =
    [...ordenados].reverse().find((n) => pontos >= n.pontosNecessarios) ?? ordenados[0];
  const atual = ordenados.find((n) => n.id === nivelAtualId);
  if (!atual || alcancado.ordem >= atual.ordem) return alcancado;

  let nivel = atual;
  for (;;) {
    if (pontos >= nivel.pontosNecessarios) return nivel;
    const anterior = [...ordenados].reverse().find((n) => n.ordem < nivel.ordem);
    if (!anterior) return nivel;
    const faixa = nivel.pontosNecessarios - anterior.pontosNecessarios;
    const progresso = faixa > 0 ? (pontos - anterior.pontosNecessarios) / faixa : 0;
    if (progresso * 10_000 > quedaNivelBps) return nivel;
    nivel = anterior;
  }
}

/* ================================================================
   Simulador
   ================================================================ */

export interface EntradaSimulacao {
  setor: SetorPontuavel;
  regra: Omit<RegraPontuacao, "id" | "setor" | "vigenteDesde" | "criadoPor" | "criadoEm">;
  /** Pedido típico: o valor e o kit alimentam as regras por faixa e por kit. */
  pedido: PedidoPontuavel;
  agendados: number;
  pagos: number;
  cancelados: number;
  frustrados: number;
  pontosIniciais: number;
  niveis: Nivel[];
  nivelAtualId: ID | null;
}

export interface LinhaSimulacao {
  rotulo: string;
  conta: string;
  pontos: number;
}

export interface Simulacao {
  porPedido: number;
  linhas: LinhaSimulacao[];
  total: number;
  saldoFinal: number;
  nivel: Nivel | null;
  /** Bônus dos níveis que o saldo alcança e que ainda não foram pagos. */
  niveisAlcancados: Nivel[];
  bonus: Centavos;
  /** Quando as quantidades não fecham com o total de agendados. */
  aviso: string | null;
}

/** Os mesmos cálculos do motor, aplicados a quantidades hipotéticas. */
export function simular(entrada: EntradaSimulacao): Simulacao {
  const regra = { ...entrada.regra, id: "simulacao", setor: entrada.setor, vigenteDesde: "", criadoPor: null, criadoEm: "" };
  const porPedido = pontosDoPedido(regra, entrada.pedido);
  const penalidade = pontosDaPenalidade(porPedido, entrada.regra.penalidadeBps);
  const linhas: LinhaSimulacao[] = [];

  if (entrada.setor === "vendas") {
    linhas.push({
      rotulo: "Pedidos agendados",
      conta: `${entrada.agendados} × ${porPedido}`,
      pontos: entrada.agendados * porPedido,
    });
    linhas.push({
      rotulo: "Cancelados (estorno total)",
      conta: `${entrada.cancelados} × −${porPedido}`,
      pontos: -entrada.cancelados * porPedido,
    });
    linhas.push({
      rotulo: `Frustrados (−${formatBps(entrada.regra.penalidadeBps, 0)})`,
      conta: `${entrada.frustrados} × −${penalidade}`,
      pontos: -entrada.frustrados * penalidade,
    });
  } else {
    linhas.push({
      rotulo: "Pedidos pagos",
      conta: `${entrada.pagos} × ${porPedido}`,
      pontos: entrada.pagos * porPedido,
    });
    linhas.push({
      rotulo: `Frustrados (−${formatBps(entrada.regra.penalidadeBps, 0)} do que valeria pago)`,
      conta: `${entrada.frustrados} × −${penalidade}`,
      pontos: -entrada.frustrados * penalidade,
    });
  }

  const total = linhas.reduce((s, l) => s + l.pontos, 0);
  const saldoFinal = entrada.pontosIniciais + total;
  const nivel = nivelComQueda(
    entrada.niveis,
    entrada.nivelAtualId,
    saldoFinal,
    entrada.regra.quedaNivelBps,
  );
  const ordemAtual =
    entrada.niveis.find((n) => n.id === entrada.nivelAtualId)?.ordem ?? 0;
  const niveisAlcancados = entrada.niveis
    .filter((n) => nivel && n.ordem > ordemAtual && n.ordem <= nivel.ordem)
    .sort((a, b) => a.ordem - b.ordem);

  const somaBuckets = entrada.cancelados + entrada.frustrados + entrada.pagos;
  return {
    porPedido,
    linhas,
    total,
    saldoFinal,
    nivel,
    niveisAlcancados,
    bonus: niveisAlcancados.reduce((s, n) => s + n.bonus, 0),
    aviso:
      entrada.setor === "vendas" && somaBuckets > entrada.agendados
        ? "Pagos, cancelados e frustrados somam mais que os agendados."
        : null,
  };
}
