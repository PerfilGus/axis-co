import type { Centavos, DataISO, ID } from "./comum";

export type Perfil = "admin" | "vendedor" | "financeiro";
export type Setor = "vendas" | "financeiro" | "administracao";

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
  nivelId: ID;
  /** Pontos acumulados no nível atual. */
  pontos: number;
}

export type BaseComissao = "por_pedido" | "percentual_valor" | "fixo_mensal";

export interface RegraComissao {
  id: ID;
  nome: string;
  setor: Setor;
  base: BaseComissao;
  /** Centavos por pedido, ou base points quando `percentual_valor`. */
  valor: number;
  /** Só conta a partir desta quantidade no mês. */
  minimoMensal: number;
  vigenteDesde: DataISO;
  ativa: boolean;
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

export interface Meta {
  id: ID;
  nome: string;
  setor: Setor;
  periodo: PeriodoMeta;
  alvo: number;
  baseContagem: BaseContagemMeta;
  premioDescricao: string | null;
  premioValor: Centavos | null;
  ativa: boolean;
}

export interface ProgressoMeta {
  metaId: ID;
  colaboradorId: ID;
  atual: number;
  alvo: number;
  inicio: DataISO;
  fim: DataISO;
  batida: boolean;
}

export interface Nivel {
  id: ID;
  nome: string;
  ordem: number;
  pontosNecessarios: number;
  /** Ilustração do card de premiação. */
  icone: string;
}

export interface Conquista {
  id: ID;
  nome: string;
  descricao: string;
  icone: string;
  pontos: number;
  /** Como se desbloqueia, em texto — a regra vive no backend depois. */
  criterio: string;
}

export interface ConquistaDesbloqueada {
  conquistaId: ID;
  colaboradorId: ID;
  desbloqueadaEm: DataISO;
}

export interface PagamentoColaborador {
  id: ID;
  colaboradorId: ID;
  competencia: string; // aaaa-mm
  comissao: Centavos;
  bonus: Centavos;
  descontos: Centavos;
  total: Centavos;
  status: "previsto" | "aprovado" | "pago";
  pagoEm: DataISO | null;
  bancoId: ID | null;
  observacoes: string | null;
}
