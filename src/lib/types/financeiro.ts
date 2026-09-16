import type { Anexo, Centavos, DataISO, Fonte, ID } from "./comum";

export type TipoBancoPlataforma = "banco" | "plataforma";

/** Janela em que a franquia de boletos gratuitos se renova. */
export type PeriodoFranquia = "semanal" | "mensal" | "anual";

export const ROTULO_FRANQUIA: Record<PeriodoFranquia, string> = {
  semanal: "por semana",
  mensal: "por mês",
  anual: "por ano",
};

/**
 * Custo de uma forma de recebimento na casa: percentual, tarifa fixa, ou os
 * dois. `ativa` em `false` significa que a casa não oferece aquela forma —
 * plataforma, por exemplo, não emite boleto nem Pix.
 */
export interface TaxaForma {
  ativa: boolean;
  /** Percentual sobre o valor, em base points (250 = 2,50%). */
  bps: number;
  /** Tarifa fixa por transação. */
  fixa: Centavos;
}

export const SEM_TAXA: TaxaForma = { ativa: false, bps: 0, fixa: 0 };

/**
 * Boletos que o banco não cobra dentro do período. Zero em `quantidade`
 * significa que todo boleto paga tarifa desde o primeiro.
 */
export interface FranquiaBoleto {
  quantidade: number;
  periodo: PeriodoFranquia;
}

export interface BancoPlataforma {
  id: ID;
  nome: string;
  tipo: TipoBancoPlataforma;
  /** Banco: agência/conta. Plataforma: identificador do lojista. */
  identificador: string;
  saldo: Centavos;
  /** Ícone enviado no cadastro. Sem ele, a tela desenha a inicial na cor. */
  iconeUrl: string | null;
  cor: string;
  ativo: boolean;
  fonte: Fonte;
  atualizadoEm: DataISO;

  /* --- taxas por forma de recebimento --- */
  boleto: TaxaForma;
  franquiaBoleto: FranquiaBoleto;
  pix: TaxaForma;
  /** Link de cartão. É a única forma que a plataforma oferece. */
  cartao: TaxaForma;
}

/* ================================================================
   Fornecedor
   ================================================================ */

/**
 * O fornecedor separa, embala e posta: cobra o pote e o frete de cada envio.
 * Os dois valores são parâmetros do cadastro — o custo previsto de cada pedido
 * sai deles, e por isso é sempre uma estimativa até a fatura chegar.
 */
export interface ParametrosFornecedor {
  fornecedor: string;
  custoPote: Centavos;
  freteEnvio: Centavos;
  atualizadoEm: DataISO;
}

/** Pagamento feito ao fornecedor, lançado à mão com o comprovante. */
export interface PagamentoFornecedor {
  id: ID;
  pagoEm: DataISO;
  valor: Centavos;
  comprovante: Anexo | null;
  observacoes: string | null;
  lancadoEm: DataISO;
}

/**
 * Fatura do fornecedor para um período de envios. Guarda só o que ele cobrou:
 * o previsto é recalculado dos pedidos do período, para a conferência sempre
 * refletir os parâmetros e os status atuais.
 */
export interface FaturaFornecedor {
  id: ID;
  numero: string | null;
  /** Primeiro dia de envios coberto, `aaaa-mm-dd`. */
  de: string;
  /** Último dia coberto, inclusive, `aaaa-mm-dd`. */
  ate: string;
  valorCobrado: Centavos;
  observacoes: string | null;
  lancadaEm: DataISO;
}

/* ================================================================
   Relatório financeiro
   ================================================================ */

/**
 * Alíquota efetiva do Simples lançada para uma competência. Só existe quando
 * alguém confirmou o valor: o mês sem registro herda a do mês anterior e a
 * tela marca como estimada.
 */
export interface AliquotaMensal {
  competencia: string; // aaaa-mm
  /** Base points: 612 = 6,12%. */
  aliquotaBps: number;
  lancadaEm: DataISO;
}

export type CategoriaDespesa =
  | "ferramentas"
  | "telefonia"
  | "internet"
  | "aluguel"
  | "energia"
  | "contabilidade"
  | "pro_labore"
  | "outros";

/**
 * Despesa fixa mensal. Vale de `desde` até `ate`, inclusive; `ate` nulo é a
 * despesa ainda em curso. Pró-labore é cadastrado aqui, mas o relatório o
 * mostra na própria linha, abaixo do lucro operacional.
 */
export interface DespesaFixa {
  id: ID;
  descricao: string;
  categoria: CategoriaDespesa;
  valor: Centavos;
  diaVencimento: number;
  desde: string; // aaaa-mm
  ate: string | null; // aaaa-mm
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
}
