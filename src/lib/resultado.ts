import type {
  AliquotaMensal,
  BonusNivel,
  Centavos,
  DespesaFixa,
  DiaMetaAds,
  Divida,
  Kit,
  LancamentoMetaAds,
  PagamentoColaborador,
  PagamentoFornecedor,
  ParametrosFornecedor,
  Pedido,
} from "@/lib/types";
import { formatCompetencia } from "@/lib/format";
import { custosPrevistos, somarCustos, totalPago } from "@/lib/fornecedor";
import { investimentoEntre } from "@/lib/meta-ads";
import {
  competenciaAnterior,
  competenciaAtual,
  competenciaDe,
  dentro,
  diaDe,
  diasDaCompetencia,
  hoje,
  inicioDoDia,
  intervaloDaCompetencia,
  somarDias,
} from "@/lib/periodos";
import { HOJE } from "@/lib/mock/base";

/**
 * Relatório financeiro: DRE do mês em duas leituras.
 *
 * - Caixa: o que entrou e saiu no mês, venha a venda de quando vier. Receita
 *   é o pagamento recebido no mês; custo com fornecedor é o que se pagou a ele.
 * - Competência: o resultado das vendas feitas no mês. Receita é o que essas
 *   vendas já pagaram; custos são os previstos dos envios delas.
 *
 * Tudo é recalculado dos providers. Nada aqui guarda número pronto.
 */

export type ModoRelatorio = "caixa" | "competencia";

export type SituacaoAliquota = "estimada" | "confirmada";

export interface AliquotaResolvida {
  aliquotaBps: number;
  situacao: SituacaoAliquota;
  /** Competência de onde a alíquota veio. `null` quando não há nenhuma lançada. */
  origem: string | null;
}

/** A do mês, se lançada; senão a do último mês anterior com valor. */
export function aliquotaDa(competencia: string, aliquotas: AliquotaMensal[]): AliquotaResolvida {
  const propria = aliquotas.find((a) => a.competencia === competencia);
  if (propria) return { aliquotaBps: propria.aliquotaBps, situacao: "confirmada", origem: competencia };
  const anterior = [...aliquotas]
    .filter((a) => a.competencia < competencia)
    .sort((a, b) => b.competencia.localeCompare(a.competencia))[0];
  return anterior
    ? { aliquotaBps: anterior.aliquotaBps, situacao: "estimada", origem: anterior.competencia }
    : { aliquotaBps: 0, situacao: "estimada", origem: null };
}

/** Despesa fixa vale na competência? */
export function despesaVigente(despesa: DespesaFixa, competencia: string): boolean {
  return despesa.desde <= competencia && (despesa.ate === null || despesa.ate >= competencia);
}

export function situacaoDivida(divida: Divida, referencia = HOJE): "em_dia" | "atrasada" | "quitada" {
  if (divida.parcelas.every((p) => p.pagaEm)) return "quitada";
  const atrasada = divida.parcelas.some((p) => !p.pagaEm && new Date(p.venceEm) < referencia);
  return atrasada ? "atrasada" : "em_dia";
}

export interface FontesResultado {
  pedidos: Pedido[];
  kits: Kit[];
  parametros: ParametrosFornecedor;
  pagamentosFornecedor: PagamentoFornecedor[];
  lancamentosMeta: LancamentoMetaAds[];
  diasManuaisMeta: DiaMetaAds[];
  aliquotas: AliquotaMensal[];
  despesas: DespesaFixa[];
  dividas: Divida[];
  /** Fechamentos da competência: pagos congelados e pendentes recalculados. */
  fechamentosDa: (competencia: string) => PagamentoColaborador[];
  /** Todos os fechamentos já pagos, para o caixa achar a folha pela data. */
  fechamentosPagos: PagamentoColaborador[];
  bonusNivel: BonusNivel[];
}

export type ChaveLinhaDre =
  | "vendas"
  | "cancelados"
  | "perdidos"
  | "em_andamento"
  | "ajuste_recebimento"
  | "receita"
  | "impostos"
  | "potes"
  | "fretes"
  | "taxas"
  | "margem"
  | "meta_ads"
  | "comissoes"
  | "salarios"
  | "despesas"
  | "lucro_operacional"
  | "parcelas"
  | "pro_labore"
  | "resultado";

export interface LinhaDre {
  chave: ChaveLinhaDre;
  rotulo: string;
  /** Com sinal: deduções chegam negativas. */
  valor: Centavos;
  tipo: "base" | "deducao" | "subtotal" | "resultado";
  /** De onde saiu o número, em uma linha. */
  ajuda: string;
  /** A linha não existe nesta leitura, e fica visível só para a DRE não mudar de forma. */
  naoSeAplica?: boolean;
}

export interface Dre {
  competencia: string;
  modo: ModoRelatorio;
  linhas: LinhaDre[];
  receita: Centavos;
  margem: Centavos;
  lucroOperacional: Centavos;
  resultado: Centavos;
  /** A alíquota que incidiu. No caixa, é a do mês anterior. */
  aliquota: AliquotaResolvida & { competencia: string };
  /** Competência ainda correndo: os números mudam até o fim do mês. */
  emAberto: boolean;
}

const valorCobrado = (p: Pedido) => p.valorTotal + p.frete;
const soma = <T,>(lista: T[], valor: (item: T) => number) => lista.reduce((s, i) => s + valor(i), 0);

function nomeMes(competencia: string) {
  return formatCompetencia(competencia);
}

/** Recebido em caixa num mês. */
function recebidoNoMes(pedidos: Pedido[], competencia: string) {
  const mes = intervaloDaCompetencia(competencia);
  return pedidos.filter((p) => p.status === "pago" && dentro(p.cobranca.pagoEm, mes));
}

/** Folha paga no mês: fixo e o resto, mais o bônus de nível pago à parte. */
function folhaPagaNoMes(fontes: FontesResultado, competencia: string) {
  const mes = intervaloDaCompetencia(competencia);
  const pagos = fontes.fechamentosPagos.filter((f) => dentro(f.pagoEm, mes));
  const quitadosEmFechamento = new Set(fontes.fechamentosPagos.flatMap((f) => f.bonusNivelIds));
  const bonusAParte = fontes.bonusNivel.filter(
    (b) => b.status === "pago" && dentro(b.pagoEm, mes) && !quitadosEmFechamento.has(b.id),
  );
  return {
    salarios: soma(pagos, (f) => f.fixo),
    variavel: soma(pagos, (f) => f.comissao + f.bonusMeta + f.bonusNivel) + soma(bonusAParte, (b) => b.valor),
  };
}

/** Folha que a competência gerou, paga ou não. */
function folhaDaCompetencia(fontes: FontesResultado, competencia: string) {
  const fechamentos = fontes.fechamentosDa(competencia);
  const quitadosEmFechamento = new Set(fontes.fechamentosPagos.flatMap((f) => f.bonusNivelIds));
  const bonusAParte = fontes.bonusNivel.filter(
    (b) =>
      b.status === "pago" &&
      competenciaDe(b.liberadoEm) === competencia &&
      !quitadosEmFechamento.has(b.id),
  );
  return {
    salarios: soma(fechamentos, (f) => f.fixo),
    variavel:
      soma(fechamentos, (f) => f.comissao + f.bonusMeta + f.bonusNivel) + soma(bonusAParte, (b) => b.valor),
  };
}

export function calcularDre(
  competencia: string,
  modo: ModoRelatorio,
  fontes: FontesResultado,
): Dre {
  const { pedidos } = fontes;
  const mes = intervaloDaCompetencia(competencia);
  const { de, ate } = diasDaCompetencia(competencia);
  // Vencimento é data futura: o mês em aberto não pode ficar aberto no fim.
  const mesInteiro = { inicio: inicioDoDia(de), fim: inicioDoDia(somarDias(ate, 1)) };
  const linhas: LinhaDre[] = [];
  const add = (linha: LinhaDre) => linhas.push(linha);

  const despesasDoMes = fontes.despesas.filter((d) => despesaVigente(d, competencia));
  const despesas = soma(
    despesasDoMes.filter((d) => d.categoria !== "pro_labore"),
    (d) => d.valor,
  );
  const proLabore = soma(
    despesasDoMes.filter((d) => d.categoria === "pro_labore"),
    (d) => d.valor,
  );
  const metaAds = investimentoEntre(de, ate, fontes.lancamentosMeta, fontes.diasManuaisMeta);

  let receita: Centavos;
  let impostos: Centavos;
  let aliquota: Dre["aliquota"];
  let custoFornecedor: { potes: Centavos; fretes: Centavos; unico: boolean };
  let taxas: Centavos;
  let folha: { salarios: Centavos; variavel: Centavos };
  let parcelas: Centavos;

  if (modo === "competencia") {
    const vendidos = pedidos.filter((p) => dentro(p.criadoEm, mes));
    const pagos = vendidos.filter((p) => p.status === "pago");
    const vendas = soma(vendidos, valorCobrado);
    const cancelados = soma(vendidos.filter((p) => p.status === "cancelado"), valorCobrado);
    const perdidos = soma(
      vendidos.filter((p) => p.status === "reembolsado" || p.status === "inadimplente"),
      valorCobrado,
    );
    const andamento = soma(
      vendidos.filter((p) => !["pago", "cancelado", "reembolsado", "inadimplente"].includes(p.status)),
      valorCobrado,
    );
    receita = soma(pagos, (p) => p.cobranca.valorRecebido ?? valorCobrado(p));
    const ajuste = receita - (vendas - cancelados - perdidos - andamento);

    add({ chave: "vendas", rotulo: "Vendas brutas", valor: vendas, tipo: "base", ajuda: `${vendidos.length} pedidos agendados em ${nomeMes(competencia)}, kits e frete cobrado.` });
    add({ chave: "cancelados", rotulo: "Cancelados", valor: -cancelados, tipo: "deducao", ajuda: "Cancelados antes do envio." });
    add({ chave: "perdidos", rotulo: "Reembolsados e inadimplentes", valor: -perdidos, tipo: "deducao", ajuda: "Devolvidos, recusados, suspensos ou entregues sem pagamento." });
    if (andamento > 0) {
      add({ chave: "em_andamento", rotulo: "Em andamento", valor: -andamento, tipo: "deducao", ajuda: "Vendas do mês ainda sem desfecho: autorizadas, em trânsito ou à espera do pagamento." });
    }
    if (ajuste !== 0) {
      add({ chave: "ajuste_recebimento", rotulo: "Diferença no recebimento", valor: ajuste, tipo: "deducao", ajuda: "Pagamentos que entraram com valor diferente do pedido." });
    }

    aliquota = { ...aliquotaDa(competencia, fontes.aliquotas), competencia };
    impostos = Math.round((receita * aliquota.aliquotaBps) / 10_000);

    const custos = somarCustos(custosPrevistos(vendidos, fontes.parametros, fontes.kits));
    custoFornecedor = { potes: custos.valorPotes, fretes: custos.frete, unico: false };
    taxas = soma(pagos, (p) => p.cobranca.taxaAplicada ?? 0);
    folha = folhaDaCompetencia(fontes, competencia);
    parcelas = soma(
      fontes.dividas.flatMap((d) => d.parcelas).filter((p) => dentro(p.venceEm, mesInteiro)),
      (p) => p.valor,
    );
  } else {
    const recebidos = recebidoNoMes(pedidos, competencia);
    const vendas = soma(recebidos, valorCobrado);
    receita = soma(recebidos, (p) => p.cobranca.valorRecebido ?? valorCobrado(p));

    add({ chave: "vendas", rotulo: "Vendas brutas", valor: vendas, tipo: "base", ajuda: `${recebidos.length} pedidos pagos em ${nomeMes(competencia)}, de qualquer mês de venda.` });
    add({ chave: "cancelados", rotulo: "Cancelados", valor: 0, tipo: "deducao", ajuda: "Cancelado não movimenta caixa.", naoSeAplica: true });
    add({ chave: "perdidos", rotulo: "Reembolsados e inadimplentes", valor: 0, tipo: "deducao", ajuda: "Venda que não pagou não entra no caixa.", naoSeAplica: true });
    if (receita !== vendas) {
      add({ chave: "ajuste_recebimento", rotulo: "Diferença no recebimento", valor: receita - vendas, tipo: "deducao", ajuda: "Pagamentos que entraram com valor diferente do pedido." });
    }

    // O DAS de um mês é pago no seguinte: o caixa deste mês paga o imposto do anterior.
    const anterior = competenciaAnterior(competencia);
    aliquota = { ...aliquotaDa(anterior, fontes.aliquotas), competencia: anterior };
    const baseAnterior = soma(recebidoNoMes(pedidos, anterior), (p) => p.cobranca.valorRecebido ?? valorCobrado(p));
    impostos = Math.round((baseAnterior * aliquota.aliquotaBps) / 10_000);

    custoFornecedor = { potes: totalPago(fontes.pagamentosFornecedor, mes), fretes: 0, unico: true };
    taxas = soma(recebidos, (p) => p.cobranca.taxaAplicada ?? 0);
    folha = folhaPagaNoMes(fontes, competencia);
    parcelas = soma(
      fontes.dividas.flatMap((d) => d.parcelas).filter((p) => dentro(p.pagaEm, mes)),
      (p) => p.valor,
    );
  }

  add({ chave: "receita", rotulo: "Receita recebida", valor: receita, tipo: "subtotal", ajuda: modo === "caixa" ? "O que entrou na conta no mês." : "O que as vendas do mês já pagaram." });

  const margem = receita - impostos - custoFornecedor.potes - custoFornecedor.fretes - taxas;
  const pct = `${(aliquota.aliquotaBps / 100).toFixed(2).replace(".", ",")}%`;
  add({
    chave: "impostos",
    rotulo: "Impostos (Simples Nacional)",
    valor: -impostos,
    tipo: "deducao",
    ajuda:
      modo === "caixa"
        ? `DAS de ${nomeMes(aliquota.competencia)}: ${pct} sobre o recebido naquele mês.`
        : `${pct} sobre a receita recebida.`,
  });
  if (custoFornecedor.unico) {
    add({ chave: "potes", rotulo: "Custo de potes", valor: -custoFornecedor.potes, tipo: "deducao", ajuda: "Pagamentos ao fornecedor no mês. Ele cobra potes e fretes juntos." });
    add({ chave: "fretes", rotulo: "Fretes", valor: 0, tipo: "deducao", ajuda: "Já incluídos no pagamento ao fornecedor, na linha acima.", naoSeAplica: true });
  } else {
    add({ chave: "potes", rotulo: "Custo de potes", valor: -custoFornecedor.potes, tipo: "deducao", ajuda: "Previsto: potes dos envios pelo custo cadastrado no fornecedor." });
    add({ chave: "fretes", rotulo: "Fretes", valor: -custoFornecedor.fretes, tipo: "deducao", ajuda: "Previsto: frete de cada envio, devolvidos inclusive." });
  }
  add({ chave: "taxas", rotulo: "Taxas de bancos e plataformas", valor: -taxas, tipo: "deducao", ajuda: "Taxa registrada em cada recebimento." });
  add({ chave: "margem", rotulo: "Margem de contribuição", valor: margem, tipo: "subtotal", ajuda: "O que sobra de cada venda para pagar a estrutura." });

  const lucroOperacional = margem - metaAds - folha.variavel - folha.salarios - despesas;
  add({ chave: "meta_ads", rotulo: "Meta Ads", valor: -metaAds, tipo: "deducao", ajuda: "Investimento dos dias do mês, da API e dos lançamentos manuais." });
  add({
    chave: "comissoes",
    rotulo: "Comissões e bônus",
    valor: -folha.variavel,
    tipo: "deducao",
    ajuda: modo === "caixa" ? "Fechamentos e bônus de nível pagos no mês." : "Comissão, bônus de meta e de nível gerados no mês.",
  });
  add({
    chave: "salarios",
    rotulo: "Salários",
    valor: -folha.salarios,
    tipo: "deducao",
    ajuda: modo === "caixa" ? "Fixo dos fechamentos pagos no mês." : "Fixo dos colaboradores na competência.",
  });
  add({ chave: "despesas", rotulo: "Despesas fixas", valor: -despesas, tipo: "deducao", ajuda: "Ferramentas, telefonia, internet e as demais em vigor no mês." });
  add({ chave: "lucro_operacional", rotulo: "Lucro operacional", valor: lucroOperacional, tipo: "subtotal", ajuda: "Resultado da operação, antes de dívidas e sócios." });

  const resultado = lucroOperacional - parcelas - proLabore;
  add({
    chave: "parcelas",
    rotulo: "Parcelas de dívidas",
    valor: -parcelas,
    tipo: "deducao",
    ajuda: modo === "caixa" ? "Parcelas pagas no mês." : "Parcelas que vencem no mês.",
  });
  add({ chave: "pro_labore", rotulo: "Pró-labore", valor: -proLabore, tipo: "deducao", ajuda: "Retirada dos sócios cadastrada nas despesas fixas." });
  add({ chave: "resultado", rotulo: "Resultado final", valor: resultado, tipo: "resultado", ajuda: "O que fica depois de tudo." });

  return {
    competencia,
    modo,
    linhas,
    receita,
    margem,
    lucroOperacional,
    resultado,
    aliquota,
    emAberto: competencia === competenciaAtual(),
  };
}

/* ----------------------------------------------------------------
   Previsão de entrada
   ---------------------------------------------------------------- */

export interface FaixaPrevisao {
  id: string;
  de: string;
  ate: string;
  valor: Centavos;
  pedidos: number;
}

export interface Previsao {
  /** Pago sobre o que foi enviado e já fechou: pago, reembolsado ou inadimplente. */
  taxaEnviados: number | null;
  /** Pago sobre o que foi entregue e já fechou: pago ou inadimplente. */
  taxaEntregues: number | null;
  diasAtePagamentoEnvio: number;
  diasAtePagamentoEntrega: number;
  emTransito: { pedidos: number; valor: Centavos; esperado: Centavos };
  aguardando: { pedidos: number; valor: Centavos; esperado: Centavos };
  faixas: FaixaPrevisao[];
  total30Dias: Centavos;
  /** Esperado que cai depois dos 30 dias. */
  depois: Centavos;
}

const DIA_MS = 86_400_000;

function media(valores: number[], padrao: number) {
  return valores.length > 0 ? valores.reduce((s, v) => s + v, 0) / valores.length : padrao;
}

/**
 * Entrada prevista para os próximos 30 dias: o valor em trânsito e o
 * entregue à espera do pagamento, cada um multiplicado pela taxa histórica
 * de recebimento da sua etapa, na data em que costuma pagar.
 */
export function preverEntradas(pedidos: Pedido[], referencia = HOJE): Previsao {
  const pagos = pedidos.filter((p) => p.status === "pago" && p.cobranca.pagoEm);
  const perdidosEnvio = pedidos.filter((p) => p.status === "reembolsado" || p.status === "inadimplente");
  const inadimplentes = pedidos.filter((p) => p.status === "inadimplente");

  const taxaEnviados = pagos.length + perdidosEnvio.length > 0 ? pagos.length / (pagos.length + perdidosEnvio.length) : null;
  const taxaEntregues = pagos.length + inadimplentes.length > 0 ? pagos.length / (pagos.length + inadimplentes.length) : null;

  const diasAtePagamentoEnvio = media(
    pagos.filter((p) => p.autorizadoEm).map((p) => (new Date(p.cobranca.pagoEm!).getTime() - new Date(p.autorizadoEm!).getTime()) / DIA_MS),
    8,
  );
  const diasAtePagamentoEntrega = media(
    pagos.filter((p) => p.rastreio?.entregueEm).map((p) => (new Date(p.cobranca.pagoEm!).getTime() - new Date(p.rastreio!.entregueEm!).getTime()) / DIA_MS),
    2,
  );

  const hojeDia = hoje(referencia);
  const faixas: FaixaPrevisao[] = Array.from({ length: 5 }, (_, i) => {
    const de = somarDias(hojeDia, 1 + i * 7);
    const ate = i === 4 ? somarDias(hojeDia, 30) : somarDias(de, 6);
    return { id: de, de, ate, valor: 0, pedidos: 0 };
  });
  let depois = 0;

  function prever(pedido: Pedido, taxa: number | null, base: string | null, dias: number) {
    const esperado = Math.round(valorCobrado(pedido) * (taxa ?? 0));
    const quando = base ? new Date(new Date(base).getTime() + dias * DIA_MS) : referencia;
    // Atrasado em relação à média: conta para amanhã, não para o passado.
    const dia = diaDe(quando) <= hojeDia ? somarDias(hojeDia, 1) : diaDe(quando);
    const faixa = faixas.find((f) => dia >= f.de && dia <= f.ate);
    if (faixa) {
      faixa.valor += esperado;
      faixa.pedidos += 1;
    } else {
      depois += esperado;
    }
    return esperado;
  }

  const transito = pedidos.filter((p) => p.status === "autorizado" || p.status === "em_transito");
  const entregues = pedidos.filter((p) => p.status === "entregue");
  const esperadoTransito = soma(transito, (p) => prever(p, taxaEnviados, p.autorizadoEm, diasAtePagamentoEnvio));
  const esperadoEntregues = soma(entregues, (p) =>
    prever(p, taxaEntregues, p.rastreio?.entregueEm ?? p.atualizadoEm, diasAtePagamentoEntrega),
  );

  return {
    taxaEnviados,
    taxaEntregues,
    diasAtePagamentoEnvio,
    diasAtePagamentoEntrega,
    emTransito: { pedidos: transito.length, valor: soma(transito, valorCobrado), esperado: esperadoTransito },
    aguardando: { pedidos: entregues.length, valor: soma(entregues, valorCobrado), esperado: esperadoEntregues },
    faixas,
    total30Dias: soma(faixas, (f) => f.valor),
    depois,
  };
}
