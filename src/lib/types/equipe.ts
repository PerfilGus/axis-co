import type { Centavos, DataISO, ID } from "./comum";

export type Perfil = "admin" | "vendedor" | "cobrador";
export type Setor = "vendas" | "financeiro" | "administracao";

export const ROTULO_SETOR: Record<Setor, string> = {
  vendas: "Vendas",
  financeiro: "Financeiro",
  administracao: "Administração",
};

/** Setores que o cadastro de colaborador oferece. */
export const SETORES_CADASTRAVEIS: Setor[] = ["vendas", "financeiro"];

export interface Colaborador {
  id: ID;
  nome: string;
  apelido: string;
  email: string;
  telefone: string;
  perfil: Perfil;
  setor: Setor;
  avatarUrl: string | null;
  ativo: boolean;
  entrouEm: DataISO;
  /** Cobrador: vendedores cujos pedidos ele pode cobrar. Vazio nos demais. */
  vendedoresAtribuidos: ID[];
  /** Nulo enquanto não há trilha de níveis cadastrada. */
  nivelId: ID | null;
  /** Pontos acumulados na trilha de níveis. */
  pontos: number;

  /* --- remuneração --- */
  salarioFixo: Centavos;
  /** Dia do mês em que o fixo é pago. */
  diaPagamento: number;
  chavePix: string | null;
  /**
   * Percentual de comissão em base points (300 = 3,00%). No vendedor incide
   * sobre o faturamento enviado já descontado o frustrado; no cobrador,
   * sobre o que de fato entrou.
   */
  comissaoBps: number;
  /**
   * Só vendedor: percentual de frustrado fixo, em base points. É combinado
   * com ele e não acompanha a frustração real — por isso reduzir esse número
   * mexe no bolso de alguém e pede confirmação explícita.
   */
  frustradoBps: number | null;
}

/** Setores que pontuam, batem metas e recebem recompensas. */
export type SetorPontuavel = Exclude<Setor, "administracao">;

export type PeriodoMeta = "diaria" | "semanal" | "mensal";

export const ROTULO_PERIODO_META: Record<PeriodoMeta, string> = {
  diaria: "Diária",
  semanal: "Semanal",
  mensal: "Mensal",
};

/**
 * O que metas, conquistas e recompensas medem. O cálculo de cada uma mora em
 * `lib/metricas.ts`; o catálogo com rótulo, unidade e setores também.
 */
export type Metrica =
  | "agendados"
  | "faturamento_agendado"
  | "enviados"
  | "pagos"
  | "valor_recebido"
  | "taxa_frustracao"
  | "taxa_recebimento"
  | "pontos"
  | "dias_trabalhados"
  | "metas_batidas";

/** `maior_igual`: bate quando chega ao valor. `menor_igual`: quando fica abaixo. */
export type Operador = "maior_igual" | "menor_igual";

/**
 * Meta: uma métrica, um alvo e uma janela. Vale para um setor inteiro ou para
 * uma pessoa, dentro da vigência (dias `aaaa-mm-dd`, inclusive).
 */
export interface Meta {
  id: ID;
  nome: string;
  metrica: Metrica;
  /** Na unidade da métrica: quantidade, centavos ou base points. */
  alvo: number;
  periodo: PeriodoMeta;
  /** Um dos dois: o setor inteiro ou uma pessoa. */
  setor: SetorPontuavel | null;
  colaboradorId: ID | null;
  vigenteDesde: string;
  vigenteAte: string | null;
  ativa: boolean;
}

export interface Nivel {
  id: ID;
  nome: string;
  ordem: number;
  pontosNecessarios: number;
  /** Pago uma vez, na primeira vez que o colaborador chega ao nível. */
  bonus: Centavos;
  /** Ícone do registro `components/icone.tsx`. */
  icone: string;
  /** Chave da paleta (`roxo-vibrante`). Nulo usa o destaque. */
  cor: string | null;
  /** O que o nível dá além do bônus, em texto: "Folga no aniversário". */
  beneficio: string;
}

/**
 * Conquista: métrica + condição numa janela. Avaliada quando a janela fecha;
 * a repetível pontua uma vez por janela, a única uma vez na vida.
 */
export interface Conquista {
  id: ID;
  nome: string;
  descricao: string;
  icone: string;
  metrica: Metrica;
  operador: Operador;
  valor: number;
  periodo: PeriodoMeta;
  /** Nulo vale para vendas e financeiro. */
  setor: SetorPontuavel | null;
  pontos: number;
  repetivel: boolean;
  ativa: boolean;
}

export interface ConquistaDesbloqueada {
  conquistaId: ID;
  colaboradorId: ID;
  /** A janela que rendeu: `2026-09-17`, `2026-W38`, `2026-09` ou `manual-…`. */
  janela: string;
  pontos: number;
  desbloqueadaEm: DataISO;
}

/* ================================================================
   Pontos
   ================================================================ */

/** Como os pontos por pedido são somados ao valor fixo. */
export type AdicionalPontos = "nenhum" | "faixa_valor" | "kit";

export interface FaixaValorPontos {
  /** A partir deste valor do pedido (centavos, sem frete). */
  minimo: Centavos;
  pontos: number;
}

/**
 * Regra de pontuação de um setor. Cada gravação é uma versão com data de
 * vigência; um evento usa a versão vigente no dia em que aconteceu. Antes da
 * primeira vigência, nada pontua.
 */
export interface RegraPontuacao {
  id: ID;
  setor: SetorPontuavel;
  vigenteDesde: string;
  pontosFixos: number;
  adicional: AdicionalPontos;
  faixasValor: FaixaValorPontos[];
  pontosPorKit: Array<{ kitId: ID; pontos: number }>;
  /** Parte dos pontos perdida no pedido frustrado, em base points (5000 = 50%). */
  penalidadeBps: number;
  /**
   * Abaixo do mínimo do nível, cai só quem ficar com este progresso ou menos
   * na faixa do nível anterior (8000 = 80%).
   */
  quedaNivelBps: number;
  criadoPor: ID | null;
  criadoEm: DataISO;
}

/** De onde veio o lançamento do extrato. */
export type EventoPontos =
  | "agendamento"
  | "cancelamento"
  | "cancelamento_revertido"
  | "frustracao"
  | "frustracao_revertida"
  | "pagamento"
  | "pagamento_revertido"
  | "exclusao"
  | "conquista";

/**
 * Uma linha do extrato. Só é inserida, nunca editada: correção de status vira
 * um lançamento de sinal contrário na data da correção.
 */
export interface LancamentoPontos {
  id: ID;
  colaboradorId: ID;
  setor: SetorPontuavel;
  pedidoId: ID | null;
  /** Congelado: o extrato continua legível se o pedido for excluído. */
  pedidoCodigo: string | null;
  evento: EventoPontos;
  pontos: number;
  descricao: string;
  regraId: ID | null;
  ocorridoEm: DataISO;
}

/* ================================================================
   Recompensas
   ================================================================ */

export type CondicaoRecompensa =
  | { tipo: "meta"; metaId: ID }
  | { tipo: "metrica"; metrica: Metrica; operador: Operador; valor: number };

/** Bônus em dinheiro liberado quando a condição é cumprida na janela. */
export interface Recompensa {
  id: ID;
  nome: string;
  valor: Centavos;
  condicao: CondicaoRecompensa;
  /** Na condição de meta, acompanha o período da meta. */
  periodo: PeriodoMeta;
  setor: SetorPontuavel | null;
  colaboradorId: ID | null;
  vigenteDesde: string;
  vigenteAte: string | null;
  ativa: boolean;
}

/** Recompensa ganha numa janela. Entra no fechamento do mês em que a janela termina. */
export interface RecompensaLiberada {
  id: ID;
  recompensaId: ID;
  colaboradorId: ID;
  janela: string;
  /** Último dia da janela (`aaaa-mm-dd`): decide a competência do fechamento. */
  janelaFim: string;
  nome: string;
  valor: Centavos;
  liberadaEm: DataISO;
  status: "liberado" | "pago";
  pagoEm: DataISO | null;
}

/**
 * Bônus de nível alcançado. Nasce liberado e espera o Admin confirmar o Pix —
 * o sistema não paga ninguém sozinho.
 */
export interface BonusNivel {
  id: ID;
  colaboradorId: ID;
  nivelId: ID;
  valor: Centavos;
  liberadoEm: DataISO;
  status: "liberado" | "pago";
  pagoEm: DataISO | null;
}

/** Uma linha do detalhamento: de onde saiu cada valor do fechamento. */
export interface LinhaDetalhe {
  grupo: "fixo" | "comissao" | "bonus_meta" | "bonus_nivel";
  rotulo: string;
  /** A conta por extenso: `R$ 10.000,00 × (1 − 30%) × 3%`. */
  conta: string | null;
  valor: Centavos;
  /** Informativa: aparece no detalhamento, mas não soma no total. */
  informativa?: boolean;
}

/**
 * Fechamento de um colaborador numa competência. Enquanto pendente, é
 * recalculado a partir dos pedidos; ao ser pago, os valores congelam.
 */
export interface PagamentoColaborador {
  id: ID;
  colaboradorId: ID;
  competencia: string; // aaaa-mm
  fixo: Centavos;
  comissao: Centavos;
  bonusMeta: Centavos;
  bonusNivel: Centavos;
  total: Centavos;
  /** Data prevista: o dia de pagamento do colaborador no mês seguinte. */
  pagarEm: DataISO;
  status: "pendente" | "pago";
  pagoEm: DataISO | null;
  detalhamento: LinhaDetalhe[];
  /** Bônus de nível quitados junto com este fechamento. */
  bonusNivelIds: ID[];
  /** Recompensas quitadas junto com este fechamento. */
  recompensaIds: ID[];
}
