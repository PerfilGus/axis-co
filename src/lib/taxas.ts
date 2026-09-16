import type {
  BancoPlataforma,
  Centavos,
  FormaPagamento,
  Pedido,
  PeriodoFranquia,
  TaxaForma,
} from "@/lib/types";
import { formatBRL, formatBps } from "@/lib/format";
import { dentro, janelaDaMeta, type Intervalo } from "@/lib/periodos";
import { HOJE } from "@/lib/mock/base";

/**
 * Taxa estimada de um recebimento.
 *
 * Sai do cadastro de bancos e plataformas, conferido com o extrato — não vem
 * de API. Quando a integração bancária entrar, a taxa real substitui esta
 * estimativa e o selo do recebimento passa de `manual` para `api`.
 */

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

/** A taxa que a casa cobra naquela forma. */
export function taxaDaForma(
  banco: BancoPlataforma | null,
  forma: FormaPagamento,
): TaxaForma | null {
  if (!banco) return null;
  if (forma === "boleto") return banco.boleto;
  if (forma === "pix") return banco.pix;
  if (forma === "link_cartao") return banco.cartao;
  return null;
}

/** A casa recebe nesta forma? É o que filtra a lista do modal de pagamento. */
export function aceitaForma(
  banco: BancoPlataforma,
  forma: FormaPagamento,
): boolean {
  return taxaDaForma(banco, forma)?.ativa ?? false;
}

/**
 * Quanto a casa fica deste recebimento.
 *
 * `boletosNoPeriodo` é quantos boletos já saíram naquele banco dentro da
 * janela da franquia: enquanto couber na franquia, o boleto não custa nada.
 */
export function taxaEstimada(
  banco: BancoPlataforma | null,
  forma: FormaPagamento,
  valor: Centavos,
  boletosNoPeriodo = 0,
): Centavos {
  const taxa = taxaDaForma(banco, forma);
  if (!taxa || !taxa.ativa) return 0;
  if (forma === "boleto" && banco && boletosNoPeriodo < banco.franquiaBoleto.quantidade) {
    return 0;
  }
  return Math.round((valor * taxa.bps) / 10_000) + taxa.fixa;
}

/** Explicação da taxa em uma linha, para mostrar ao lado do valor. */
export function explicacaoTaxa(
  banco: BancoPlataforma | null,
  forma: FormaPagamento,
  boletosNoPeriodo = 0,
): string {
  const taxa = taxaDaForma(banco, forma);
  if (!banco || !taxa || !taxa.ativa) return "Sem taxa neste recebimento.";

  if (forma === "boleto" && boletosNoPeriodo < banco.franquiaBoleto.quantidade) {
    const restam = banco.franquiaBoleto.quantidade - boletosNoPeriodo;
    return `Dentro da franquia de ${banco.nome}: ainda cabem ${restam} boletos sem tarifa.`;
  }

  const partes: string[] = [];
  if (taxa.bps > 0) partes.push(`${formatBps(taxa.bps)} de ${banco.nome}`);
  if (taxa.fixa > 0) {
    partes.push(`tarifa fixa de ${formatBRL(taxa.fixa)} por ${ROTULO_FORMA[forma].toLowerCase()}`);
  }
  if (partes.length === 0) return "Sem taxa neste recebimento.";
  return `Estimativa: ${partes.join(" + ")}.`;
}

/** Quanto sobra depois da taxa. */
export function valorLiquido(
  banco: BancoPlataforma | null,
  forma: FormaPagamento,
  valor: Centavos,
  boletosNoPeriodo = 0,
): Centavos {
  return valor - taxaEstimada(banco, forma, valor, boletosNoPeriodo);
}

/** Resumo das taxas de uma casa, para a lista de bancos. */
export function resumoTaxas(banco: BancoPlataforma): string {
  const partes: string[] = [];
  const descrever = (rotulo: string, taxa: TaxaForma) => {
    if (!taxa.ativa) return;
    if (taxa.bps === 0 && taxa.fixa === 0) {
      partes.push(`${rotulo} sem taxa`);
      return;
    }
    const pedacos: string[] = [];
    if (taxa.bps > 0) pedacos.push(formatBps(taxa.bps));
    if (taxa.fixa > 0) pedacos.push(formatBRL(taxa.fixa));
    partes.push(`${rotulo} ${pedacos.join(" + ")}`);
  };
  descrever("Boleto", banco.boleto);
  descrever("Pix", banco.pix);
  descrever("Cartão", banco.cartao);
  return partes.length > 0 ? partes.join(" · ") : "Sem forma de recebimento ativa.";
}

/** Janela corrente da franquia de boletos. */
export function janelaDaFranquia(periodo: PeriodoFranquia, referencia = HOJE): Intervalo {
  if (periodo === "semanal") return janelaDaMeta("semanal", referencia);
  if (periodo === "mensal") return janelaDaMeta("mensal", referencia);
  const mes = janelaDaMeta("mensal", referencia).inicio;
  const ano = new Date(mes.getTime());
  ano.setUTCMonth(0);
  return { inicio: ano, fim: null };
}

/**
 * Boletos emitidos no banco dentro da franquia corrente. Sai dos pagamentos
 * registrados — é o mesmo número que decide se o próximo boleto paga tarifa.
 */
export function boletosNoPeriodo(pedidos: Pedido[], banco: BancoPlataforma): number {
  const janela = janelaDaFranquia(banco.franquiaBoleto.periodo);
  return pedidos.filter(
    (p) =>
      p.cobranca.bancoId === banco.id &&
      p.cobranca.formaPagamento === "boleto" &&
      dentro(p.cobranca.pagoEm, janela),
  ).length;
}
