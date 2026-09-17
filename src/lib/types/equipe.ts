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

/**
 * Regra de contagem fixa por setor, não configurável:
 * - vendas: pedidos agendados por ele, menos os cancelados.
 * - financeiro: pedidos pagos dos vendedores atribuídos a ele.
 */
export type BaseContagemMeta = "agendados_menos_cancelados" | "pagos_atribuidos";

export const BASE_CONTAGEM_POR_SETOR: Record<Setor, BaseContagemMeta | null> = {
  vendas: "agendados_menos_cancelados",
  financeiro: "pagos_atribuidos",
  administracao: null,
};

export type PeriodoMeta = "diaria" | "semanal" | "mensal";

export const ROTULO_PERIODO_META: Record<PeriodoMeta, string> = {
  diaria: "Diária",
  semanal: "Semanal",
  mensal: "Mensal",
};

/** O que a meta mede. Faturamento trafega em centavos, como todo dinheiro. */
export type TipoMeta = "pedidos" | "faturamento";

/** Bater a faixa aumenta a comissão ou paga um valor fechado. */
export type TipoRecompensa = "percentual" | "bonus";

export interface FaixaMeta {
  id: ID;
  /** Quantidade de pedidos, ou centavos quando a meta é de faturamento. */
  alvo: number;
  recompensa: TipoRecompensa;
  /** Base points quando `percentual`; centavos quando `bonus`. */
  valor: number;
}

/**
 * Meta de um colaborador. As faixas são degraus: vale a mais alta alcançada,
 * nunca a soma delas.
 */
export interface Meta {
  id: ID;
  colaboradorId: ID;
  nome: string;
  tipo: TipoMeta;
  periodo: PeriodoMeta;
  faixas: FaixaMeta[];
  ativa: boolean;
}

export interface Nivel {
  id: ID;
  nome: string;
  ordem: number;
  pontosNecessarios: number;
  /** Pago uma vez, quando o colaborador chega ao nível. */
  bonus: Centavos;
  /** Ilustração do card de premiação. */
  icone: string;
}

/**
 * De onde vêm os pontos. O gatilho é o contrato com o backend; enquanto não
 * existe, `criterio` é o texto mostrado na tela.
 */
export type GatilhoConquista =
  | "meta_diaria"
  | "meta_semanal"
  | "meta_mensal"
  | "domingo_feriado"
  | "dias_trabalhados"
  | "marco";

export interface Conquista {
  id: ID;
  nome: string;
  descricao: string;
  icone: string;
  pontos: number;
  gatilho: GatilhoConquista;
  /** Pontua toda vez que acontece, e não só na primeira. */
  repetivel: boolean;
  criterio: string;
  ativa: boolean;
}

export interface ConquistaDesbloqueada {
  conquistaId: ID;
  colaboradorId: ID;
  desbloqueadaEm: DataISO;
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
}
