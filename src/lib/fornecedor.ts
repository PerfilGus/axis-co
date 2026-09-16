import type {
  Centavos,
  FaturaFornecedor,
  Kit,
  PagamentoFornecedor,
  ParametrosFornecedor,
  Pedido,
} from "@/lib/types";
import { formatData, formatDataHoraCurta } from "@/lib/format";
import { STATUS_PEDIDO } from "@/lib/status";
import { potesDoKit } from "@/lib/mock/catalogo";
import { dentro, intervaloDeDias, type Intervalo } from "@/lib/periodos";

/**
 * Custo previsto com o fornecedor.
 *
 * O fornecedor cobra frete e potes de cada envio. O previsto sai dos
 * parâmetros cadastrados, não da fatura — é estimativa até a conferência:
 * - entregue, pago ou inadimplente: frete + potes;
 * - em trânsito (autorizado ou circulando): frete + potes, porque já saiu;
 * - reembolsado (devolvido, recusado, suspenso): só frete, o pote volta;
 * - cancelado ou ainda não autorizado: zero, e fica fora da tela.
 *
 * O envio conta na data da autorização, que é quando o fornecedor posta.
 */

export type SituacaoCusto = "em_transito" | "completo" | "so_frete";

export interface CustoPrevisto {
  pedido: Pedido;
  id: string;
  enviadoEm: string;
  situacao: SituacaoCusto;
  potes: number;
  frete: Centavos;
  valorPotes: Centavos;
  total: Centavos;
}

export function potesDoPedido(pedido: Pedido, kits: Kit[]): number {
  return pedido.itens.reduce((s, i) => s + potesDoKit(i.kitId, kits) * i.quantidade, 0);
}

export function custoPrevisto(
  pedido: Pedido,
  parametros: ParametrosFornecedor,
  kits: Kit[],
): CustoPrevisto | null {
  if (pedido.status === "cancelado" || !pedido.autorizadoEm) return null;
  const situacao: SituacaoCusto =
    pedido.status === "reembolsado"
      ? "so_frete"
      : pedido.status === "autorizado" || pedido.status === "em_transito"
        ? "em_transito"
        : "completo";
  const potes = situacao === "so_frete" ? 0 : potesDoPedido(pedido, kits);
  const valorPotes = potes * parametros.custoPote;
  return {
    pedido,
    id: pedido.id,
    enviadoEm: pedido.autorizadoEm,
    situacao,
    potes,
    frete: parametros.freteEnvio,
    valorPotes,
    total: parametros.freteEnvio + valorPotes,
  };
}

/** Custos previstos dos envios de um intervalo, ou de todos quando `null`. */
export function custosPrevistos(
  pedidos: Pedido[],
  parametros: ParametrosFornecedor,
  kits: Kit[],
  intervalo: Intervalo | null = null,
): CustoPrevisto[] {
  return pedidos
    .filter((p) => intervalo === null || dentro(p.autorizadoEm, intervalo))
    .map((p) => custoPrevisto(p, parametros, kits))
    .filter((c): c is CustoPrevisto => c !== null)
    .sort((a, b) => b.enviadoEm.localeCompare(a.enviadoEm));
}

export function somarCustos(custos: CustoPrevisto[]) {
  return custos.reduce(
    (s, c) => ({
      frete: s.frete + c.frete,
      potes: s.potes + c.potes,
      valorPotes: s.valorPotes + c.valorPotes,
      total: s.total + c.total,
    }),
    { frete: 0, potes: 0, valorPotes: 0, total: 0 },
  );
}

export function totalPago(pagamentos: PagamentoFornecedor[], intervalo: Intervalo | null = null) {
  return pagamentos
    .filter((p) => intervalo === null || dentro(p.pagoEm, intervalo))
    .reduce((s, p) => s + p.valor, 0);
}

/* ----------------------------------------------------------------
   Reembolsados: base do abatimento de potes com o fornecedor.
   ---------------------------------------------------------------- */

/**
 * Reembolsados enviados no período. O pote foi cobrado quando saiu e voltou
 * ao estoque: é o que se pede de abatimento na fatura.
 */
export function reembolsadosNo(pedidos: Pedido[], intervalo: Intervalo): Pedido[] {
  return pedidos
    .filter((p) => p.status === "reembolsado" && dentro(p.autorizadoEm, intervalo))
    .sort((a, b) => (b.autorizadoEm ?? "").localeCompare(a.autorizadoEm ?? ""));
}

function celula(valor: unknown): string {
  return `"${String(valor ?? "").replace(/"/g, '""')}"`;
}

/**
 * CSV do relatório de reembolsados, no mesmo formato do CSV do rastreio:
 * separador `;` e BOM UTF-8, para o Excel pt-BR abrir sem embaralhar acento.
 */
export function csvReembolsados(pedidos: Pedido[], kits: Kit[]): Blob {
  const cabecalho = [
    "pedido",
    "cliente",
    "rastreio",
    "enviado_em",
    "potes_para_abater",
    "kit",
    "motivo",
    "status",
    "atualizado_em",
  ];
  const linhas = pedidos.map((p) =>
    [
      p.codigo,
      p.cliente.nome,
      p.rastreio?.codigo ?? "",
      formatData(p.autorizadoEm),
      potesDoPedido(p, kits),
      p.itens.map((i) => i.kitNome).join(", "),
      p.rastreio?.motivoFalha ?? p.observacoes ?? "",
      STATUS_PEDIDO[p.status].rotulo,
      formatDataHoraCurta(p.atualizadoEm),
    ]
      .map(celula)
      .join(";"),
  );
  return new Blob(["﻿" + [cabecalho.join(";"), ...linhas].join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
}

export function baixarArquivo(blob: Blob, nome: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

/* ----------------------------------------------------------------
   Conferência de fatura
   ---------------------------------------------------------------- */

export interface Conferencia {
  fatura: FaturaFornecedor;
  id: string;
  previsto: Centavos;
  envios: number;
  /** Cobrado menos previsto: positivo é cobrança acima do esperado. */
  diferenca: Centavos;
  /** Diferença sobre o previsto. `null` quando não há previsto. */
  percentual: number | null;
}

/** Diferença a partir da qual a conferência pede atenção. */
export const TOLERANCIA_CONFERENCIA = 0.01;

export function conferir(
  fatura: FaturaFornecedor,
  pedidos: Pedido[],
  parametros: ParametrosFornecedor,
  kits: Kit[],
): Conferencia {
  const custos = custosPrevistos(pedidos, parametros, kits, intervaloDeDias(fatura.de, fatura.ate));
  const previsto = somarCustos(custos).total;
  const diferenca = fatura.valorCobrado - previsto;
  return {
    fatura,
    id: fatura.id,
    previsto,
    envios: custos.length,
    diferenca,
    percentual: previsto > 0 ? diferenca / previsto : null,
  };
}
