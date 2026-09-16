import type { FaturaFornecedor, PagamentoFornecedor, ParametrosFornecedor } from "@/lib/types";
import { custosPrevistos, somarCustos } from "@/lib/fornecedor";
import {
  competenciaAnterior,
  diasDaCompetencia,
  intervaloDaCompetencia,
  isoDoDia,
  ultimasCompetencias,
} from "@/lib/periodos";
import { HOJE, iso, maisDias } from "./base";
import { KITS } from "./catalogo";
import { PEDIDOS } from "./pedidos";

/** Valores fictícios: o que o fornecedor cobra por pote e por envio. */
export const PARAMETROS_FORNECEDOR: ParametrosFornecedor = {
  fornecedor: "NutriLab Manipulação",
  custoPote: 2790,
  freteEnvio: 2200,
  atualizadoEm: iso(maisDias(HOJE, -150)),
};

function previstoDoMes(competencia: string) {
  return somarCustos(
    custosPrevistos(PEDIDOS, PARAMETROS_FORNECEDOR, KITS, intervaloDaCompetencia(competencia)),
  ).total;
}

/**
 * Os envios de cada mês são pagos em duas vezes no mês seguinte, dia 10 e
 * dia 25. A segunda parcela de agosto ainda não venceu: é o saldo em aberto.
 */
function gerarPagamentos(): PagamentoFornecedor[] {
  const pagamentos: PagamentoFornecedor[] = [];
  const meses = ultimasCompetencias(7).slice(1).reverse();
  for (const competencia of meses) {
    const previsto = previstoDoMes(competencia);
    const entrada = Math.round(previsto / 200) * 100;
    const seguinte = competenciaAnterior(competencia, -1);
    const parcelas: Array<[string, number, string]> = [
      [`${seguinte}-10`, entrada, "Entrada de 50% dos envios"],
      [`${seguinte}-25`, previsto - entrada, "Restante dos envios"],
    ];
    for (const [dia, valor, texto] of parcelas) {
      const pagoEm = isoDoDia(dia);
      if (new Date(pagoEm) > HOJE) continue;
      const n = pagamentos.length + 1;
      pagamentos.push({
        id: `pfor_${String(n).padStart(4, "0")}`,
        pagoEm,
        valor,
        comprovante: {
          id: `anx_pfor_${n}`,
          nome: `comprovante-nutrilab-${dia}.pdf`,
          tipo: "comprovante",
          tamanhoBytes: 184_000 + n * 7_300,
          mime: "application/pdf",
          criadoEm: pagoEm,
          criadoPor: "col_0001",
          url: "#",
        },
        observacoes: `${texto} de ${competencia.slice(5, 7)}/${competencia.slice(0, 4)}.`,
        lancadoEm: pagoEm,
      });
    }
  }
  return pagamentos;
}

export const PAGAMENTOS_FORNECEDOR: PagamentoFornecedor[] = gerarPagamentos();

/**
 * Faturas dos três meses fechados mais recentes. Junho veio certo, julho com
 * centavos de diferença e agosto acima do previsto — o caso que a
 * conferência existe para pegar.
 */
function gerarFaturas(): FaturaFornecedor[] {
  const [, agosto, julho, junho] = ultimasCompetencias(4);
  const desvios: Array<[string, number, string]> = [
    [junho, 0, "NF 15037"],
    [julho, -0.0012, "NF 15210"],
    [agosto, 0.034, "NF 15388"],
  ];
  return desvios.map(([competencia, desvio, numero], i) => {
    const previsto = previstoDoMes(competencia);
    const { de, ate } = diasDaCompetencia(competencia);
    return {
      id: `fat_${String(i + 1).padStart(4, "0")}`,
      numero,
      de,
      ate,
      valorCobrado: Math.round(previsto * (1 + desvio)),
      observacoes: null,
      lancadaEm: isoDoDia(`${competenciaAnterior(competencia, -1)}-03`),
    };
  });
}

export const FATURAS_FORNECEDOR: FaturaFornecedor[] = gerarFaturas();
