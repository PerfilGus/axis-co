/**
 * Contrato de rastreio.
 *
 * Portado do projeto axis-tracking (`referencia/axis-tracking/`), que virou a
 * aba Rastreio. O levantamento campo a campo está em
 * `referencia/axis-tracking/INVENTARIO.md` §1.
 *
 * Mapa de nomes — o comportamento é o mesmo, os identificadores seguem a
 * convenção deste projeto:
 *
 * | axis-tracking      | aqui                      |
 * |--------------------|---------------------------|
 * | `code`             | `Rastreio.codigo`         |
 * | `status`           | `Rastreio.status`         |
 * | `failureReason`    | `Rastreio.motivoFalha`    |
 * | `pickup`           | `Rastreio.retirada`       |
 * | `archived`         | `Rastreio.arquivado`      |
 * | `archivedAt`       | `Rastreio.arquivadoEm`    |
 * | `highlighted`      | `Rastreio.destacado`      |
 * | `events[].at`      | `EventoRastreio.ocorridoEm` |
 * | `events[].title`   | `EventoRastreio.titulo`   |
 * | `events[].desc`    | `EventoRastreio.detalhe`  |
 * | `events[].city`    | `EventoRastreio.cidade` + `.uf` |
 * | `events[].type`    | `EventoRastreio.status`   |
 *
 * O restante do pedido (cliente, endereço, valor, potes, data) vive em
 * `Pedido`, que é a fonte de verdade deste sistema.
 */
import type { DataISO, Fonte, ID } from "./comum";

/** As sete chaves do axis-tracking, sem acréscimo nem supressão. */
export type StatusRastreio =
  | "aguardando_postagem"
  | "postado"
  | "em_transferencia"
  | "saiu_para_entrega"
  | "aguardando_retirada"
  | "entregue"
  | "falha";

export interface EventoRastreio {
  id: ID;
  /** Tipo do evento, na mesma escala do status do objeto. */
  status: StatusRastreio;
  /** Descrição que os Correios devolvem: "Objeto saiu para entrega...". */
  titulo: string;
  /** Complemento do evento, quando houver. */
  detalhe: string | null;
  unidade: string;
  cidade: string;
  uf: string;
  ocorridoEm: DataISO;
}

/**
 * Agência onde o objeto está à espera do cliente. Vem do evento LDI —
 * `unidade.endereco` e `dtLimiteRetirada` em `lib/correios.js`.
 */
export interface RetiradaRastreio {
  agencia: string;
  endereco: string;
  disponivelDesde: DataISO;
  /** Último dia para retirar; vale até o fim do dia. */
  prazo: DataISO | null;
}

export interface Rastreio {
  /** Código de objeto dos Correios: `AA123456789BR`. */
  codigo: string;
  status: StatusRastreio;
  servico: "PAC" | "SEDEX" | "PAC Contrato" | "SEDEX Contrato";
  postadoEm: DataISO | null;
  previsaoEntrega: DataISO | null;
  entregueEm: DataISO | null;
  tentativasEntrega: number;

  /** Só quando `status === "falha"`. */
  motivoFalha: string | null;
  /** Só quando `status === "aguardando_retirada"`. */
  retirada: RetiradaRastreio | null;

  /** Atualização ainda não vista. Abrir o pedido consome o destaque. */
  destacado: boolean;
  /** Sai de Em Trânsito só por ação manual, e volta do mesmo jeito. */
  arquivado: boolean;
  arquivadoEm: DataISO | null;

  /** Mais recente primeiro — a ordem é parte do contrato. */
  eventos: EventoRastreio[];
  atualizadoEm: DataISO;
  fonte: Fonte;
}

/** Formato de código de objeto dos Correios. */
export const RE_CODIGO_RASTREIO = /^[A-Z]{2}\d{9}[A-Z]{2}$/;

/**
 * Última atualização do objeto.
 *
 * Não existe campo próprio: é o evento mais recente, e um rastreio ainda sem
 * eventos cai na data informada. Nunca acesse `eventos[0]` sem passar por aqui.
 */
export function ultimaAtualizacaoDe(
  rastreio: Rastreio,
  alternativa: DataISO | null,
): DataISO | null {
  return rastreio.eventos.length > 0 ? rastreio.eventos[0].ocorridoEm : alternativa;
}

/** Quando aconteceu o evento mais recente de um tipo. */
export function momentoDoEvento(
  rastreio: Rastreio,
  status: StatusRastreio,
  alternativa: DataISO | null,
): DataISO | null {
  const evento = rastreio.eventos.find((e) => e.status === status);
  return evento ? evento.ocorridoEm : ultimaAtualizacaoDe(rastreio, alternativa);
}
