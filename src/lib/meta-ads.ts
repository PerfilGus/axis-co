import type {
  Centavos,
  Criativo,
  DiaMetaAds,
  Fonte,
  LancamentoMetaAds,
  LinhaWhatsApp,
  Pedido,
} from "@/lib/types";
import { diaDe, diasEntre, hoje } from "@/lib/periodos";

/**
 * Meta Ads e análise de criativos.
 *
 * Investimento e leads vêm do Meta: por criativo quando a API trouxe o dia,
 * em total quando foi lançado à mão. Vendas vêm sempre dos pedidos — o pedido
 * agendado no dia, sem os cancelados. CPL e CPA são divisões desses dois lados.
 */

/** Pedido que conta como venda: agendado, e não cancelado. */
export function ehVenda(pedido: Pedido): boolean {
  return pedido.status !== "cancelado";
}

/**
 * O dia cai no período? Período que chega a hoje fica aberto no fim, para não
 * perder o que entrou depois de a tela abrir.
 */
export function noPeriodo(dia: string, de: string, ate: string): boolean {
  return dia >= de && (dia <= ate || ate >= hoje());
}

/** Custo por unidade, em centavos. `null` quando não há o que dividir. */
export function custoPor(investimento: Centavos, quantidade: number): Centavos | null {
  return quantidade > 0 ? Math.round(investimento / quantidade) : null;
}

export interface DiaAds {
  id: string;
  data: string;
  investimento: Centavos;
  leads: number;
  vendas: number;
  cpl: Centavos | null;
  cpa: Centavos | null;
  /** `null` no dia sem lançamento nenhum. */
  fonte: Fonte | null;
  /** O lançamento manual do dia, para editar. */
  manual: DiaMetaAds | null;
}

/**
 * Um dia por linha, de `de` a `ate`. O dia com dado da API não aceita
 * lançamento manual; o dia sem nada aparece zerado, para a falta ficar visível.
 */
export function diasDeAds(
  de: string,
  ate: string,
  lancamentos: LancamentoMetaAds[],
  manuais: DiaMetaAds[],
  pedidos: Pedido[],
): DiaAds[] {
  const api = new Map<string, { investimento: number; leads: number }>();
  for (const l of lancamentos) {
    if (l.data < de || l.data > ate) continue;
    const atual = api.get(l.data) ?? { investimento: 0, leads: 0 };
    atual.investimento += l.investimento;
    atual.leads += l.conversas;
    api.set(l.data, atual);
  }
  const manualPorDia = new Map(manuais.map((m) => [m.data, m]));
  const vendas = new Map<string, number>();
  for (const p of pedidos) {
    if (!ehVenda(p)) continue;
    const dia = diaDe(p.criadoEm);
    if (!noPeriodo(dia, de, ate)) continue;
    vendas.set(dia, (vendas.get(dia) ?? 0) + 1);
  }

  const ultimo = [ate, ...vendas.keys()].sort().at(-1) ?? ate;
  return diasEntre(de, ultimo).map((data) => {
    const deApi = api.get(data);
    const manual = deApi ? null : (manualPorDia.get(data) ?? null);
    const investimento = deApi?.investimento ?? manual?.investimento ?? 0;
    const leads = deApi?.leads ?? manual?.leads ?? 0;
    const qtdVendas = vendas.get(data) ?? 0;
    return {
      id: data,
      data,
      investimento,
      leads,
      vendas: qtdVendas,
      cpl: custoPor(investimento, leads),
      // Dia sem lançamento não tem CPA zero: tem CPA desconhecido.
      cpa: deApi || manual ? custoPor(investimento, qtdVendas) : null,
      fonte: deApi ? "api" : manual ? manual.fonte : null,
      manual,
    };
  });
}

export function totaisDosDias(dias: DiaAds[]) {
  const investimento = dias.reduce((s, d) => s + d.investimento, 0);
  const leads = dias.reduce((s, d) => s + d.leads, 0);
  const vendas = dias.reduce((s, d) => s + d.vendas, 0);
  return {
    investimento,
    leads,
    vendas,
    cpl: custoPor(investimento, leads),
    cpa: custoPor(investimento, vendas),
  };
}

/** Investimento de um intervalo de dias, somando API e lançamentos manuais. */
export function investimentoEntre(
  de: string,
  ate: string,
  lancamentos: LancamentoMetaAds[],
  manuais: DiaMetaAds[],
): Centavos {
  const comApi = new Set<string>();
  let total = 0;
  for (const l of lancamentos) {
    if (l.data < de || l.data > ate) continue;
    comApi.add(l.data);
    total += l.investimento;
  }
  for (const m of manuais) {
    if (m.data >= de && m.data <= ate && !comApi.has(m.data)) total += m.investimento;
  }
  return total;
}

/* ----------------------------------------------------------------
   Análise por criativo
   ---------------------------------------------------------------- */

export const ID_NAO_IDENTIFICADO = "nao_identificado";

export interface LinhaCriativo {
  /** Id do criativo, da linha de WhatsApp, ou `nao_identificado`. */
  id: string;
  criativo: Criativo | null;
  linha: LinhaWhatsApp | null;
  investimento: Centavos;
  leads: number;
  cpl: Centavos | null;
  vendas: number;
  cpa: Centavos | null;
  /** Kits das vendas, sem frete — o mesmo faturamento de ranking e metas. */
  faturamento: Centavos;
  /** Todos os agendados, cancelados inclusive: é a base dos percentuais. */
  agendados: number;
  pagos: number;
  reembolsados: number;
  cancelados: number;
}

function vazia(id: string, criativo: Criativo | null, linha: LinhaWhatsApp | null): LinhaCriativo {
  return {
    id,
    criativo,
    linha,
    investimento: 0,
    leads: 0,
    cpl: null,
    vendas: 0,
    cpa: null,
    faturamento: 0,
    agendados: 0,
    pagos: 0,
    reembolsados: 0,
    cancelados: 0,
  };
}

function somarPedido(linha: LinhaCriativo, pedido: Pedido) {
  linha.agendados += 1;
  if (pedido.status === "pago") linha.pagos += 1;
  if (pedido.status === "reembolsado") linha.reembolsados += 1;
  if (pedido.status === "cancelado") linha.cancelados += 1;
  if (ehVenda(pedido)) {
    linha.vendas += 1;
    linha.faturamento += pedido.valorTotal;
  }
}

function fechar(linha: LinhaCriativo): LinhaCriativo {
  return {
    ...linha,
    cpl: custoPor(linha.investimento, linha.leads),
    cpa: custoPor(linha.investimento, linha.vendas),
  };
}

/** Fração sobre os agendados. `null` sem pedido nenhum. */
export function fracao(parte: number, linha: LinhaCriativo): number | null {
  return linha.agendados > 0 ? parte / linha.agendados : null;
}

/**
 * Uma linha por criativo, mais a de "Criativo não identificado", que sempre
 * existe: recebe os pedidos sem código e o investimento lançado à mão, que
 * não tem detalhe por criativo.
 */
export function analisarCriativos(
  de: string,
  ate: string,
  criativos: Criativo[],
  linhas: LinhaWhatsApp[],
  lancamentos: LancamentoMetaAds[],
  manuais: DiaMetaAds[],
  pedidos: Pedido[],
): LinhaCriativo[] {
  const porId = new Map<string, LinhaCriativo>();
  for (const c of criativos) {
    porId.set(c.id, vazia(c.id, c, linhas.find((l) => l.id === c.linhaWhatsappId) ?? null));
  }
  const naoIdentificado = vazia(ID_NAO_IDENTIFICADO, null, null);

  const comApi = new Set<string>();
  for (const l of lancamentos) {
    if (l.data < de || l.data > ate) continue;
    comApi.add(l.data);
    const alvo = porId.get(l.criativoId) ?? naoIdentificado;
    alvo.investimento += l.investimento;
    alvo.leads += l.conversas;
  }
  for (const m of manuais) {
    if (m.data < de || m.data > ate || comApi.has(m.data)) continue;
    naoIdentificado.investimento += m.investimento;
    naoIdentificado.leads += m.leads;
  }

  for (const p of pedidos) {
    if (!noPeriodo(diaDe(p.criadoEm), de, ate)) continue;
    somarPedido((p.criativoId && porId.get(p.criativoId)) || naoIdentificado, p);
  }

  return [...[...porId.values()].map(fechar), fechar(naoIdentificado)];
}

/** Agrupa as linhas de criativo pela linha de WhatsApp de cada um. */
export function agruparPorLinha(linhasCriativo: LinhaCriativo[], linhas: LinhaWhatsApp[]): LinhaCriativo[] {
  const grupos = new Map<string, LinhaCriativo>();
  for (const l of linhas) grupos.set(l.id, vazia(l.id, null, l));
  let naoIdentificado: LinhaCriativo | null = null;
  for (const item of linhasCriativo) {
    if (!item.linha) {
      naoIdentificado = item;
      continue;
    }
    const grupo = grupos.get(item.linha.id);
    if (!grupo) continue;
    grupo.investimento += item.investimento;
    grupo.leads += item.leads;
    grupo.vendas += item.vendas;
    grupo.faturamento += item.faturamento;
    grupo.agendados += item.agendados;
    grupo.pagos += item.pagos;
    grupo.reembolsados += item.reembolsados;
    grupo.cancelados += item.cancelados;
  }
  const resultado = [...grupos.values()].map(fechar);
  return naoIdentificado ? [...resultado, naoIdentificado] : resultado;
}

/** Evolução diária de um criativo, para o detalhe. */
export function evolucaoDoCriativo(
  criativoId: string,
  de: string,
  ate: string,
  lancamentos: LancamentoMetaAds[],
  manuais: DiaMetaAds[],
  pedidos: Pedido[],
): DiaAds[] {
  const naoIdentificado = criativoId === ID_NAO_IDENTIFICADO;
  const comApi = new Set(lancamentos.map((l) => l.data));
  return diasDeAds(
    de,
    ate,
    naoIdentificado ? [] : lancamentos.filter((l) => l.criativoId === criativoId),
    naoIdentificado ? manuais.filter((m) => !comApi.has(m.data)) : [],
    pedidos.filter((p) => (naoIdentificado ? !p.criativoId : p.criativoId === criativoId)),
  );
}
