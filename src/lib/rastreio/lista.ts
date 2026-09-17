import type { DataISO, Pedido, StatusRastreio } from "@/lib/types";
import { ultimaAtualizacaoDe } from "@/lib/types/rastreio";
import { ORDEM_SECOES_RASTREIO, STATUS_RASTREIO } from "@/lib/status";
import { normalizar } from "@/lib/busca";

/**
 * Filtro, ordenação e agrupamento da lista de rastreio.
 * Portado de `visibleOrders`, `sortOrders` e `renderGrid` do axis-tracking.
 */

export type AbaRastreio = "transito" | "arquivados";
export type OrdemRastreio = "atualizacao" | "criacao";

/**
 * Um pedido só entra na lista de rastreio depois que o envio é autorizado, e
 * sai dela para sempre quando o Admin apaga o rastreio.
 */
export function temRastreio(
  pedido: Pedido,
): pedido is Pedido & { rastreio: NonNullable<Pedido["rastreio"]> } {
  return pedido.rastreio !== null && pedido.rastreioRemovidoEm === null;
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

export interface BuscaRastreio {
  termo: string;
  /** Ids que o servidor achou pelo telefone completo (`buscarRastreiosPorTelefone`). */
  idsPorTelefone: ReadonlySet<string>;
}

/**
 * Nome, número do pedido (`AX-1001` ou só `1001`), código de rastreio e
 * telefone. A lista só tem o telefone mascarado; o número completo chega pelos
 * ids que o servidor devolveu.
 */
export function bateComBusca(
  pedido: Pedido & { rastreio: NonNullable<Pedido["rastreio"]> },
  busca: BuscaRastreio,
): boolean {
  const termo = normalizar(busca.termo);
  if (!termo) return true;
  if (busca.idsPorTelefone.has(pedido.id)) return true;
  const compacto = termo.replace(/[\s.\-()]/g, "");
  return (
    normalizar(pedido.cliente.nome).includes(termo) ||
    pedido.codigo.toLowerCase().replace("-", "").includes(compacto) ||
    pedido.rastreio.codigo.toLowerCase().includes(compacto) ||
    (compacto.length > 0 && /^\d+$/.test(compacto) && pedido.cliente.telefone.replace(/\D/g, "").includes(compacto))
  );
}

export function rastreiosVisiveis(
  pedidos: Pedido[],
  aba: AbaRastreio,
  filtro: StatusRastreio | "todos",
  busca: BuscaRastreio = { termo: "", idsPorTelefone: new Set() },
) {
  return rastreaveis(pedidos)
    .filter((p) => (aba === "transito" ? !p.rastreio.arquivado : p.rastreio.arquivado))
    .filter((p) => (filtro === "todos" ? true : p.rastreio.status === filtro))
    .filter((p) => bateComBusca(p, busca));
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

