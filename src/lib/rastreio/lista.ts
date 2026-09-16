import type { DataISO, Pedido, StatusRastreio } from "@/lib/types";
import { ultimaAtualizacaoDe } from "@/lib/types/rastreio";
import { ORDEM_SECOES_RASTREIO, STATUS_RASTREIO } from "@/lib/status";
import { potesDoKit } from "@/lib/mock/catalogo";

/**
 * Filtro, ordenação e agrupamento da lista de rastreio.
 * Portado de `visibleOrders`, `sortOrders` e `renderGrid` do axis-tracking.
 */

export type AbaRastreio = "transito" | "arquivados";
export type OrdemRastreio = "atualizacao" | "criacao";

/** Um pedido só entra na lista de rastreio depois que o envio é autorizado. */
export function temRastreio(
  pedido: Pedido,
): pedido is Pedido & { rastreio: NonNullable<Pedido["rastreio"]> } {
  return pedido.rastreio !== null;
}

export function rastreaveis(pedidos: Pedido[]): Array<
  Pedido & { rastreio: NonNullable<Pedido["rastreio"]> }
> {
  return pedidos.filter(temRastreio);
}

/** A última atualização é o evento mais recente, com recuo na data do pedido. */
export function atualizacaoDe(
  pedido: Pedido & { rastreio: NonNullable<Pedido["rastreio"]> },
): DataISO | null {
  return ultimaAtualizacaoDe(pedido.rastreio, pedido.criadoEm);
}

export function rastreiosVisiveis(
  pedidos: Pedido[],
  aba: AbaRastreio,
  filtro: StatusRastreio | "todos",
) {
  return rastreaveis(pedidos)
    .filter((p) => (aba === "transito" ? !p.rastreio.arquivado : p.rastreio.arquivado))
    .filter((p) => (filtro === "todos" ? true : p.rastreio.status === filtro));
}

/**
 * "Atualização" põe o evento mais recente primeiro; "Criação" põe o pedido mais
 * recente primeiro.
 */
export function ordenarRastreios<
  T extends Pedido & { rastreio: NonNullable<Pedido["rastreio"]> },
>(lista: T[], ordem: OrdemRastreio): T[] {
  return [...lista].sort((a, b) => {
    if (ordem === "criacao") {
      return new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime();
    }
    const ta = new Date(atualizacaoDe(a) ?? a.criadoEm).getTime();
    const tb = new Date(atualizacaoDe(b) ?? b.criadoEm).getTime();
    return tb - ta;
  });
}

export interface SecaoRastreio {
  chave: string;
  titulo: string;
  cor: string;
  itens: Array<Pedido & { rastreio: NonNullable<Pedido["rastreio"]> }>;
}

/**
 * Agrupamento da lista: os destacados sobem para "Atualizações Recentes",
 * independentemente do status; o resto cai na seção do próprio status, na
 * ordem de importância de `ORDEM_SECOES_RASTREIO`.
 */
export function agruparEmSecoes(
  lista: Array<Pedido & { rastreio: NonNullable<Pedido["rastreio"]> }>,
  ordem: OrdemRastreio,
): SecaoRastreio[] {
  const secoes: SecaoRastreio[] = [];

  const destacados = ordenarRastreios(
    lista.filter((p) => p.rastreio.destacado),
    ordem,
  );
  if (destacados.length) {
    secoes.push({
      chave: "destacados",
      titulo: "Atualizações Recentes",
      cor: "var(--accent)",
      itens: destacados,
    });
  }

  for (const status of ORDEM_SECOES_RASTREIO) {
    const itens = ordenarRastreios(
      lista.filter((p) => !p.rastreio.destacado && p.rastreio.status === status),
      ordem,
    );
    if (itens.length) {
      secoes.push({
        chave: status,
        titulo: STATUS_RASTREIO[status].secao,
        cor: `var(--rt-${status}-base)`,
        itens,
      });
    }
  }

  return secoes;
}

/** `rua · bairro - cidade/UF`, ou o aviso de endereço em branco. */
export function enderecoCompleto(pedido: Pedido): string {
  const e = pedido.cliente.endereco;
  if (!e.logradouro && !e.cidade) return "Endereço não informado";
  return `${e.logradouro}, ${e.numero} · ${e.bairro} - ${e.cidade}/${e.uf}`;
}

/** Quantidade de potes do pedido — o axis-tracking mostra "N potes". */
export function potesDoPedido(pedido: Pedido): number {
  return pedido.itens.reduce(
    (soma, item) => soma + potesDoKit(item.kitId) * item.quantidade,
    0,
  );
}
