import type { Pedido } from "@/lib/types";
import { diaUtilAnterior } from "@/lib/datas";

/**
 * Filas da operação.
 *
 * Existem aqui, e não em cada tela, para que o contador da subaba e a lista
 * que ela abre nunca contem coisas diferentes.
 */

/** Um pedido só sai da fila de autorização quando é liberado ou cancelado. */
export const STATUS_AGUARDANDO_AUTORIZACAO = ["agendado", "aguardando_autorizacao"];

export function noEscopo(
  pedidos: Pedido[],
  escopoVendedores: string[] | null,
): Pedido[] {
  return escopoVendedores
    ? pedidos.filter((p) => escopoVendedores.includes(p.vendedorId))
    : pedidos;
}

/**
 * Fila de autorização. Por padrão traz só o que foi agendado até o dia útil
 * anterior: o pedido de hoje ainda pode mudar antes de sair.
 */
export function filaAutorizacao(
  pedidos: Pedido[],
  escopoVendedores: string[] | null,
  ateOCorte = true,
): Pedido[] {
  const corte = diaUtilAnterior();
  return noEscopo(pedidos, escopoVendedores)
    .filter((p) => STATUS_AGUARDANDO_AUTORIZACAO.includes(p.status))
    .filter((p) => !ateOCorte || new Date(p.criadoEm) <= corte)
    .sort((a, b) => new Date(a.criadoEm).getTime() - new Date(b.criadoEm).getTime());
}

/** Fila de cobrança: entregue e ainda não pago, mais os inadimplentes. */
export function filaCobranca(
  pedidos: Pedido[],
  escopoVendedores: string[] | null,
): Pedido[] {
  return noEscopo(pedidos, escopoVendedores).filter((p) =>
    ["entregue", "inadimplente"].includes(p.status),
  );
}
