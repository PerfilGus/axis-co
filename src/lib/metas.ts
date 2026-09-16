import type { Colaborador, FaixaMeta, Meta, Pedido } from "@/lib/types";
import { formatBps, formatBRL, formatNumero } from "@/lib/format";
import { janelaDaMeta, type Intervalo } from "@/lib/periodos";
import { desempenhoNo } from "@/lib/desempenho";

/**
 * Progresso de metas.
 *
 * O que conta é fixo por setor — vendedor por agendados, cobrador por pagos —
 * e sai de `desempenho.ts`. A meta só escolhe se mede quantidade ou valor.
 */

export interface ProgressoMeta {
  meta: Meta;
  atual: number;
  /** A faixa mais alta já alcançada. As faixas não se somam. */
  atingida: FaixaMeta | null;
  proxima: FaixaMeta | null;
  /** 0 a 1, até a próxima faixa (ou 1 quando todas foram batidas). */
  progresso: number;
}

export function faixasOrdenadas(meta: Meta): FaixaMeta[] {
  return [...meta.faixas].sort((a, b) => a.alvo - b.alvo);
}

export function medirMeta(
  meta: Meta,
  colaborador: Colaborador,
  pedidos: Pedido[],
  intervalo: Intervalo = janelaDaMeta(meta.periodo),
): ProgressoMeta {
  const desempenho = desempenhoNo(colaborador, pedidos, intervalo);
  const atual = meta.tipo === "pedidos" ? desempenho.pedidos : desempenho.faturamento;
  const faixas = faixasOrdenadas(meta);
  const atingida = [...faixas].reverse().find((f) => atual >= f.alvo) ?? null;
  const proxima = faixas.find((f) => atual < f.alvo) ?? null;
  const progresso = proxima ? Math.min(atual / proxima.alvo, 1) : faixas.length > 0 ? 1 : 0;
  return { meta, atual, atingida, proxima, progresso };
}

/** `12 pedidos` ou `R$ 8.000,00`. */
export function formatarAlvo(tipo: Meta["tipo"], valor: number): string {
  return tipo === "pedidos"
    ? `${formatNumero(valor)} ${valor === 1 ? "pedido" : "pedidos"}`
    : formatBRL(valor);
}

/** `+0,50% de comissão` ou `Bônus de R$ 60,00`. */
export function descreverRecompensa(faixa: FaixaMeta): string {
  return faixa.recompensa === "percentual"
    ? `+${formatBps(faixa.valor)} de comissão`
    : `Bônus de ${formatBRL(faixa.valor)}`;
}

/** O que a meta conta, em palavras, para o setor do colaborador. */
export function baseDaMeta(colaborador: Colaborador, tipo: Meta["tipo"]): string {
  if (colaborador.setor === "financeiro") {
    return tipo === "pedidos"
      ? "Pedidos pagos dos vendedores atribuídos"
      : "Valor recebido dos vendedores atribuídos";
  }
  return tipo === "pedidos"
    ? "Pedidos agendados, menos os cancelados"
    : "Faturamento dos agendados, menos os cancelados";
}
