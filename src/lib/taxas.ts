import type { Centavos, FormaPagamento, ID } from "@/lib/types";
import { BANCO_POR_ID } from "@/lib/mock/financeiro";

/**
 * Taxa estimada de um recebimento.
 *
 * Valores de referência da operação, conferidos com o extrato — não vêm de
 * API. Quando a integração bancária entrar, a taxa real substitui esta
 * estimativa e o selo do recebimento passa de `manual` para `api`.
 */
interface CustoDaForma {
  /** Percentual em base points sobre o valor recebido. */
  bps: number;
  /** Tarifa fixa por transação. */
  fixa: Centavos;
  rotulo: string;
}

const CUSTO_POR_FORMA: Record<FormaPagamento, CustoDaForma> = {
  pix: { bps: 0, fixa: 0, rotulo: "Pix" },
  boleto: { bps: 0, fixa: 349, rotulo: "Boleto" },
  link_cartao: { bps: 0, fixa: 0, rotulo: "Link de cartão" },
  nao_definido: { bps: 0, fixa: 0, rotulo: "A definir" },
};

export const ROTULO_FORMA: Record<FormaPagamento, string> = {
  pix: "Pix",
  boleto: "Boleto",
  link_cartao: "Link de cartão",
  nao_definido: "A definir",
};

export const FORMAS_PAGAMENTO: Array<{
  valor: Exclude<FormaPagamento, "nao_definido">;
  rotulo: string;
  icone: "pix" | "codigo" | "cartao";
}> = [
  { valor: "pix", rotulo: "Pix", icone: "pix" },
  { valor: "boleto", rotulo: "Boleto", icone: "codigo" },
  { valor: "link_cartao", rotulo: "Link de cartão", icone: "cartao" },
];

/**
 * Quanto a plataforma fica deste recebimento.
 *
 * A taxa percentual é a do banco ou plataforma que recebe (Pix em conta custa
 * zero; link de cartão passa pela plataforma e paga o percentual dela). A
 * tarifa fixa é da forma — boleto tem custo por emissão.
 */
export function taxaEstimada(
  bancoId: ID | null,
  forma: FormaPagamento,
  valor: Centavos,
): Centavos {
  const custoForma = CUSTO_POR_FORMA[forma];
  const banco = bancoId ? BANCO_POR_ID.get(bancoId) : null;
  const bps = (banco?.taxaBps ?? 0) + custoForma.bps;
  return Math.round((valor * bps) / 10_000) + custoForma.fixa;
}

/** Explicação da taxa em uma linha, para mostrar ao lado do valor. */
export function explicacaoTaxa(
  bancoId: ID | null,
  forma: FormaPagamento,
): string {
  const custoForma = CUSTO_POR_FORMA[forma];
  const banco = bancoId ? BANCO_POR_ID.get(bancoId) : null;
  const bps = (banco?.taxaBps ?? 0) + custoForma.bps;
  const partes: string[] = [];
  if (bps > 0) {
    partes.push(`${(bps / 100).toFixed(2).replace(".", ",")}% de ${banco?.nome ?? "plataforma"}`);
  }
  if (custoForma.fixa > 0) {
    partes.push(`tarifa fixa de ${ROTULO_FORMA[forma].toLowerCase()}`);
  }
  if (partes.length === 0) return "Sem taxa neste recebimento.";
  return `Estimativa: ${partes.join(" + ")}.`;
}

/** Quanto sobra depois da taxa. */
export function valorLiquido(
  bancoId: ID | null,
  forma: FormaPagamento,
  valor: Centavos,
): Centavos {
  return valor - taxaEstimada(bancoId, forma, valor);
}
