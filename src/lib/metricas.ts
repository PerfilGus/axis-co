import type {
  Colaborador,
  LancamentoPontos,
  Meta,
  Metrica,
  Operador,
  Pedido,
  SetorPontuavel,
} from "@/lib/types";
import { formatBps, formatBRL, formatNumero } from "@/lib/format";
import { dentro, type Janela } from "@/lib/periodos";
import {
  agendadosNo,
  carteiraDe,
  diasComAtividade,
  enviadosNo,
  faturamentoBruto,
  pagosNo,
  taxaFrustracao,
  taxaRecebimento,
  valorRecebido,
} from "@/lib/desempenho";

/**
 * Catálogo do que metas, conquistas e recompensas podem medir.
 *
 * Toda contagem sai de `desempenho.ts` e do extrato de pontos: a meta nunca
 * conta um pedido de um jeito e o ranking de outro.
 */

export type UnidadeMetrica = "quantidade" | "dinheiro" | "taxa";

export interface DefinicaoMetrica {
  chave: Metrica;
  rotulo: string;
  descricao: string;
  unidade: UnidadeMetrica;
  setores: SetorPontuavel[];
  /** Para que lado é melhor: a condição sugerida ao escolher a métrica. */
  sentido: Operador;
  /** Singular e plural, só nas quantidades. */
  nomes?: [string, string];
  /** `metas_batidas` depende de outras metas e não pode virar meta. */
  usavelEmMeta: boolean;
}

const AMBOS: SetorPontuavel[] = ["vendas", "financeiro"];

export const CATALOGO_METRICAS: DefinicaoMetrica[] = [
  {
    chave: "agendados",
    rotulo: "Pedidos agendados",
    descricao: "Criados na janela, menos os cancelados.",
    unidade: "quantidade",
    setores: ["vendas"],
    sentido: "maior_igual",
    nomes: ["agendado", "agendados"],
    usavelEmMeta: true,
  },
  {
    chave: "faturamento_agendado",
    rotulo: "Faturamento agendado",
    descricao: "Valor dos kits agendados na janela, sem frete e sem cancelados.",
    unidade: "dinheiro",
    setores: ["vendas"],
    sentido: "maior_igual",
    usavelEmMeta: true,
  },
  {
    chave: "enviados",
    rotulo: "Pedidos enviados",
    descricao: "Autorizados na janela.",
    unidade: "quantidade",
    setores: ["vendas"],
    sentido: "maior_igual",
    nomes: ["enviado", "enviados"],
    usavelEmMeta: true,
  },
  {
    chave: "pagos",
    rotulo: "Pedidos pagos",
    descricao: "Pagos na janela. Vendedor: das próprias vendas. Cobrador: da carteira.",
    unidade: "quantidade",
    setores: AMBOS,
    sentido: "maior_igual",
    nomes: ["pago", "pagos"],
    usavelEmMeta: true,
  },
  {
    chave: "valor_recebido",
    rotulo: "Valor recebido",
    descricao: "O que entrou dos pedidos pagos na janela.",
    unidade: "dinheiro",
    setores: AMBOS,
    sentido: "maior_igual",
    usavelEmMeta: true,
  },
  {
    chave: "taxa_frustracao",
    rotulo: "Taxa de frustração",
    descricao: "Cancelados, reembolsados e inadimplentes entre os pedidos criados na janela.",
    unidade: "taxa",
    setores: AMBOS,
    sentido: "menor_igual",
    usavelEmMeta: true,
  },
  {
    chave: "taxa_recebimento",
    rotulo: "Taxa de recebimento",
    descricao: "Dos pedidos entregues na janela, quantos já foram pagos.",
    unidade: "taxa",
    setores: ["financeiro"],
    sentido: "maior_igual",
    usavelEmMeta: true,
  },
  {
    chave: "pontos",
    rotulo: "Pontos ganhos",
    descricao: "Soma do extrato na janela, já com estornos e penalidades.",
    unidade: "quantidade",
    setores: AMBOS,
    sentido: "maior_igual",
    nomes: ["ponto", "pontos"],
    usavelEmMeta: true,
  },
  {
    chave: "dias_trabalhados",
    rotulo: "Dias trabalhados",
    descricao: "Dias da janela com alguma ação sua num pedido.",
    unidade: "quantidade",
    setores: AMBOS,
    sentido: "maior_igual",
    nomes: ["dia", "dias"],
    usavelEmMeta: true,
  },
  {
    chave: "metas_batidas",
    rotulo: "Metas batidas",
    descricao: "Metas do mesmo período batidas na janela.",
    unidade: "quantidade",
    setores: AMBOS,
    sentido: "maior_igual",
    nomes: ["meta batida", "metas batidas"],
    usavelEmMeta: false,
  },
];

export const DEFINICAO_METRICA = Object.fromEntries(
  CATALOGO_METRICAS.map((d) => [d.chave, d]),
) as Record<Metrica, DefinicaoMetrica>;

export const ROTULO_OPERADOR: Record<Operador, string> = {
  maior_igual: "pelo menos",
  menor_igual: "no máximo",
};

/** O que a medição precisa: tudo o que a sessão já carregou. */
export interface FontesMetricas {
  pedidos: Pedido[];
  lancamentos: LancamentoPontos[];
  metas: Meta[];
}

/** `12 agendados`, `R$ 800,00` ou `12,5%`. */
export function formatarMetrica(metrica: Metrica, valor: number | null): string {
  if (valor === null) return "—";
  const def = DEFINICAO_METRICA[metrica];
  if (def.unidade === "dinheiro") return formatBRL(valor);
  if (def.unidade === "taxa") return formatBps(valor, 1);
  const [um, varios] = def.nomes ?? ["", ""];
  return `${formatNumero(valor)} ${valor === 1 ? um : varios}`.trim();
}

/** `pelo menos 12 agendados`. */
export function descreverCondicao(metrica: Metrica, operador: Operador, valor: number): string {
  return `${ROTULO_OPERADOR[operador]} ${formatarMetrica(metrica, valor)}`;
}

export function atende(valor: number | null, operador: Operador, alvo: number): boolean {
  if (valor === null) return false;
  return operador === "maior_igual" ? valor >= alvo : valor <= alvo;
}

/** Vale para o colaborador: é dele, ou é do setor dele. */
export function alcanca(
  item: { colaboradorId: string | null; setor: SetorPontuavel | null },
  colaborador: Colaborador,
): boolean {
  if (item.colaboradorId) return item.colaboradorId === colaborador.id;
  return item.setor === null || item.setor === colaborador.setor;
}

/** Valor da métrica para o colaborador na janela. `null` quando a taxa não tem base. */
export function medirMetrica(
  metrica: Metrica,
  colaborador: Colaborador,
  janela: Pick<Janela, "intervalo" | "periodo" | "de" | "ate">,
  fontes: FontesMetricas,
): number | null {
  const { intervalo } = janela;
  const carteira = carteiraDe(colaborador, fontes.pedidos);
  switch (metrica) {
    case "agendados":
      return agendadosNo(carteira, intervalo).length;
    case "faturamento_agendado":
      return faturamentoBruto(agendadosNo(carteira, intervalo));
    case "enviados":
      return enviadosNo(carteira, intervalo).length;
    case "pagos":
      return pagosNo(carteira, intervalo).length;
    case "valor_recebido":
      return valorRecebido(pagosNo(carteira, intervalo));
    case "taxa_frustracao": {
      const taxa = taxaFrustracao(carteira.filter((p) => dentro(p.criadoEm, intervalo)));
      return taxa === null ? null : Math.round(taxa * 10_000);
    }
    case "taxa_recebimento": {
      const taxa = taxaRecebimento(carteira, intervalo);
      return taxa === null ? null : Math.round(taxa * 10_000);
    }
    case "pontos":
      return fontes.lancamentos
        .filter((l) => l.colaboradorId === colaborador.id && dentro(l.ocorridoEm, intervalo))
        .reduce((s, l) => s + l.pontos, 0);
    case "dias_trabalhados":
      return [...diasComAtividade(colaborador, fontes.pedidos)].filter(
        (d) => d >= janela.de && d <= janela.ate,
      ).length;
    case "metas_batidas":
      // Não recorre: `metas_batidas` não pode ser meta (`usavelEmMeta`).
      return fontes.metas.filter(
        (m) =>
          m.ativa &&
          m.periodo === janela.periodo &&
          m.metrica !== "metas_batidas" &&
          alcanca(m, colaborador) &&
          m.vigenteDesde <= janela.ate &&
          (m.vigenteAte === null || m.vigenteAte >= janela.de) &&
          atende(
            medirMetrica(m.metrica, colaborador, janela, fontes),
            DEFINICAO_METRICA[m.metrica].sentido,
            m.alvo,
          ),
      ).length;
  }
}

/** Progresso de 0 a 1 rumo à condição. Nas de "no máximo", 1 enquanto está dentro. */
export function progressoDaCondicao(valor: number | null, operador: Operador, alvo: number): number {
  if (valor === null) return 0;
  if (operador === "menor_igual") {
    if (valor <= alvo) return 1;
    return valor > 0 ? Math.max(alvo / valor, 0) : 0;
  }
  if (alvo <= 0) return 1;
  return Math.min(Math.max(valor / alvo, 0), 1);
}

/** Métricas que fazem sentido para o setor (nulo = as de todos). */
export function metricasDoSetor(setor: SetorPontuavel | null, emMeta = false): DefinicaoMetrica[] {
  return CATALOGO_METRICAS.filter(
    (d) => (setor === null || d.setores.includes(setor)) && (!emMeta || d.usavelEmMeta),
  );
}
