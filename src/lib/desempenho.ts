import type { Centavos, Colaborador, Pedido, StatusPedido } from "@/lib/types";
import { dentro, diaDe, type Intervalo } from "@/lib/periodos";

/**
 * Números de um colaborador num intervalo, tirados direto dos pedidos.
 *
 * Metas, ranking e comissões leem daqui, para que o mesmo pedido nunca conte
 * de um jeito numa tela e de outro na vizinha.
 */

/** Tudo que saiu do trilho. */
export const STATUS_FRUSTRADOS: StatusPedido[] = ["cancelado", "reembolsado", "inadimplente"];

/** Frustração real: o que saiu do trilho sobre o total. `null` sem pedidos. */
export function taxaFrustracao(pedidos: Pedido[]): number | null {
  if (pedidos.length === 0) return null;
  return pedidos.filter((p) => STATUS_FRUSTRADOS.includes(p.status)).length / pedidos.length;
}

/**
 * Pedidos pelos quais o colaborador responde: o vendedor pelos que tirou, o
 * cobrador pelos dos vendedores atribuídos a ele.
 */
export function carteiraDe(colaborador: Colaborador, pedidos: Pedido[]): Pedido[] {
  if (colaborador.setor === "vendas") {
    return pedidos.filter((p) => p.vendedorId === colaborador.id);
  }
  if (colaborador.setor === "financeiro") {
    const vendedores = new Set(colaborador.vendedoresAtribuidos);
    return pedidos.filter((p) => vendedores.has(p.vendedorId));
  }
  return [];
}

/** Agendado conta quando nasce; cancelado não conta nunca. */
export function agendadosNo(carteira: Pedido[], intervalo: Intervalo): Pedido[] {
  return carteira.filter((p) => p.status !== "cancelado" && dentro(p.criadoEm, intervalo));
}

/** Enviado é o que passou pela autorização. Conta na data em que foi liberado. */
export function enviadosNo(carteira: Pedido[], intervalo: Intervalo): Pedido[] {
  return carteira.filter(
    (p) => p.status !== "cancelado" && p.autorizadoEm !== null && dentro(p.autorizadoEm, intervalo),
  );
}

/** Pago conta na data do pagamento. */
export function pagosNo(carteira: Pedido[], intervalo: Intervalo): Pedido[] {
  return carteira.filter((p) => p.status === "pago" && dentro(p.cobranca.pagoEm, intervalo));
}

/** Faturamento bruto: o valor dos kits, sem frete. */
export function faturamentoBruto(pedidos: Pedido[]): Centavos {
  return pedidos.reduce((s, p) => s + p.valorTotal, 0);
}

/** O que de fato entrou. */
export function valorRecebido(pedidos: Pedido[]): Centavos {
  return pedidos.reduce((s, p) => s + (p.cobranca.valorRecebido ?? 0), 0);
}

export interface Desempenho {
  colaboradorId: string;
  /** O número que o setor persegue: agendados em vendas, pagos em cobrança. */
  pedidos: number;
  /** Agendados em vendas, recebido em cobrança. */
  faturamento: Centavos;
  frustracao: number | null;
}

export function desempenhoNo(
  colaborador: Colaborador,
  pedidos: Pedido[],
  intervalo: Intervalo,
): Desempenho {
  const carteira = carteiraDe(colaborador, pedidos);
  const doPeriodo = carteira.filter((p) => dentro(p.criadoEm, intervalo));
  if (colaborador.setor === "financeiro") {
    const pagos = pagosNo(carteira, intervalo);
    return {
      colaboradorId: colaborador.id,
      pedidos: pagos.length,
      faturamento: valorRecebido(pagos),
      frustracao: taxaFrustracao(doPeriodo),
    };
  }
  const agendados = agendadosNo(carteira, intervalo);
  return {
    colaboradorId: colaborador.id,
    pedidos: agendados.length,
    faturamento: faturamentoBruto(agendados),
    frustracao: taxaFrustracao(doPeriodo),
  };
}

/**
 * Taxa de recebimento do cobrador: dos pedidos da carteira entregues no
 * intervalo, quantos já foram pagos. `null` sem entregas.
 */
export function taxaRecebimento(carteira: Pedido[], intervalo: Intervalo): number | null {
  const entregues = carteira.filter(
    (p) =>
      ["entregue", "pago", "inadimplente"].includes(p.status) &&
      dentro(p.rastreio?.entregueEm ?? null, intervalo),
  );
  if (entregues.length === 0) return null;
  return entregues.filter((p) => p.status === "pago").length / entregues.length;
}

/**
 * Dias (`aaaa-mm-dd`, fuso de São Paulo) em que o colaborador deixou rastro na
 * linha do tempo de algum pedido: criou, pediu ajuste, cobrou, registrou
 * pagamento. É o "dia trabalhado" enquanto não há ponto eletrônico.
 */
export function diasComAtividade(colaborador: Colaborador, pedidos: Pedido[]): Set<string> {
  const dias = new Set<string>();
  for (const pedido of pedidos) {
    for (const evento of pedido.linhaDoTempo) {
      if (evento.autorId === colaborador.id) dias.add(diaDe(evento.ocorridoEm));
    }
  }
  return dias;
}
