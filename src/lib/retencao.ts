import type { DataISO, Pedido, StatusPedido } from "@/lib/types";

/**
 * Retenção dos arquivos de pedido (prints, áudios, comprovantes, fotos).
 *
 * Todo arquivo de pedido é apagado no que vier primeiro:
 * - 60 dias depois da criação do pedido, finalizado ou não;
 * - 7 dias depois que o pedido entra num status que o encerra.
 *
 * Se o pedido sai desse status (uma correção), `finalizadoEm` volta a nulo e
 * vale de novo só o prazo da criação. A rotina diária (`/api/cron/retencao`)
 * apaga do Blob e marca `removidoEm`; a tela usa as mesmas funções para contar
 * os dias.
 */

export const DIAS_APOS_CRIACAO = 60;
export const DIAS_APOS_FINALIZAR = 7;

/** Suspensão e devolução são `reembolsado`. Inadimplente segue o prazo da criação. */
export const STATUS_QUE_ENCERRAM: StatusPedido[] = ["pago", "cancelado", "reembolsado"];

export const encerraRetencao = (status: StatusPedido) => STATUS_QUE_ENCERRAM.includes(status);

const DIA_MS = 86_400_000;

/** Instante a partir do qual os arquivos do pedido podem ser apagados. */
export function remocaoPrevistaEm(pedido: Pick<Pedido, "criadoEm" | "finalizadoEm">): Date {
  const pelaCriacao = new Date(pedido.criadoEm).getTime() + DIAS_APOS_CRIACAO * DIA_MS;
  const pelaFinalizacao = pedido.finalizadoEm
    ? new Date(pedido.finalizadoEm).getTime() + DIAS_APOS_FINALIZAR * DIA_MS
    : Infinity;
  return new Date(Math.min(pelaCriacao, pelaFinalizacao));
}

/** Por que o arquivo sai, para a auditoria. */
export function motivoDaRemocao(pedido: Pick<Pedido, "criadoEm" | "finalizadoEm">): string {
  const pelaCriacao = new Date(pedido.criadoEm).getTime() + DIAS_APOS_CRIACAO * DIA_MS;
  return remocaoPrevistaEm(pedido).getTime() < pelaCriacao
    ? `${DIAS_APOS_FINALIZAR} dias após finalizar`
    : `${DIAS_APOS_CRIACAO} dias da criação`;
}

/** Dias inteiros que faltam, arredondados para cima; 0 quando já venceu. */
export function diasParaRemocao(
  pedido: Pick<Pedido, "criadoEm" | "finalizadoEm">,
  agora: number,
): number {
  return Math.max(0, Math.ceil((remocaoPrevistaEm(pedido).getTime() - agora) / DIA_MS));
}

/**
 * `finalizadoEm` depois de uma gravação: carimba ao entrar num status que
 * encerra, mantém enquanto o status não muda e zera ao sair.
 */
export function finalizadoEmApos(
  antes: Pick<Pedido, "status" | "finalizadoEm"> | null,
  depois: Pick<Pedido, "status">,
  agora: DataISO,
): DataISO | null {
  if (!encerraRetencao(depois.status)) return null;
  if (antes && antes.status === depois.status && antes.finalizadoEm) return antes.finalizadoEm;
  return agora;
}
