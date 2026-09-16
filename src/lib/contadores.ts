import type { Pedido } from "@/lib/types";
import type { ChaveContador } from "@/lib/nav";
import { filaAutorizacao, filaCobranca, noEscopo } from "@/lib/filas";

/**
 * Contadores das subabas e do sino. Recebem a lista de pedidos da sessão, para
 * refletirem na hora o que acabou de ser autorizado, cancelado ou pago, e
 * usam as mesmas filas das telas — o número bate com o que a tela abre.
 */
export function contadores(
  pedidos: Pedido[],
  escopoVendedores: string[] | null,
): Record<ChaveContador, number> {
  return {
    autorizacoes: filaAutorizacao(pedidos, escopoVendedores).length,
    cobrancas: filaCobranca(pedidos, escopoVendedores).length,
    ajustes: noEscopo(pedidos, escopoVendedores)
      .flatMap((p) => p.ajustes)
      .filter((a) => a.status === "pendente").length,
  };
}

/** Notificações do sino: o que exige ação de quem está logado. */
export function totalNotificacoes(
  pedidos: Pedido[],
  escopoVendedores: string[] | null,
  ehAdmin: boolean,
): number {
  const c = contadores(pedidos, escopoVendedores);
  return ehAdmin ? c.autorizacoes + c.ajustes : c.cobrancas;
}
