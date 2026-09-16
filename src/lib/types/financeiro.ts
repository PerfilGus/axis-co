import type { Anexo, Centavos, DataISO, Fonte, ID } from "./comum";

export type TipoBancoPlataforma = "banco" | "plataforma";

export interface BancoPlataforma {
  id: ID;
  nome: string;
  tipo: TipoBancoPlataforma;
  /** Banco: agência/conta. Plataforma: identificador do lojista. */
  identificador: string;
  saldo: Centavos;
  /** Taxa da plataforma em base points (250 = 2,50%). */
  taxaBps: number;
  cor: string;
  ativo: boolean;
  fonte: Fonte;
  atualizadoEm: DataISO;
}

export interface FaturaFornecedor {
  id: ID;
  fornecedor: string;
  numero: string;
  competencia: string; // aaaa-mm
  emitidaEm: DataISO;
  venceEm: DataISO;
  valor: Centavos;
  quantidadePotes: number;
  status: "aberta" | "parcial" | "quitada" | "vencida";
  valorPago: Centavos;
  anexos: Anexo[];
}

export interface PagamentoFornecedor {
  id: ID;
  faturaId: ID;
  valor: Centavos;
  pagoEm: DataISO;
  bancoId: ID;
  comprovanteAnexoId: ID | null;
  observacoes: string | null;
}

/**
 * Alíquota efetiva do mês. Nasce estimada e é confirmada quando o contador
 * fecha a competência — a interface mostra qual dos dois é.
 */
export interface AliquotaMensal {
  id: ID;
  competencia: string; // aaaa-mm
  /** Base points: 1550 = 15,50%. */
  aliquotaBps: number;
  faturamento: Centavos;
  imposto: Centavos;
  situacao: "estimada" | "confirmada";
  confirmadaEm: DataISO | null;
  observacoes: string | null;
}

export type CategoriaDespesa =
  | "frete"
  | "produto"
  | "trafego"
  | "equipe"
  | "ferramentas"
  | "impostos"
  | "estrutura"
  | "outros";

export type RecorrenciaDespesa = "unica" | "mensal" | "semanal" | "anual";

export interface Despesa {
  id: ID;
  descricao: string;
  categoria: CategoriaDespesa;
  recorrencia: RecorrenciaDespesa;
  valor: Centavos;
  competencia: string; // aaaa-mm
  venceEm: DataISO;
  pagaEm: DataISO | null;
  bancoId: ID | null;
  fonte: Fonte;
}

export interface ParcelaDivida {
  numero: number;
  valor: Centavos;
  venceEm: DataISO;
  pagaEm: DataISO | null;
}

export interface Divida {
  id: ID;
  credor: string;
  descricao: string;
  valorOriginal: Centavos;
  /** Juros ao mês em base points. */
  jurosBps: number;
  parcelas: ParcelaDivida[];
  contratadaEm: DataISO;
  status: "em_dia" | "atrasada" | "quitada";
}
