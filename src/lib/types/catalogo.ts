import type { Centavos, DataISO, ID } from "./comum";

export interface Produto {
  id: ID;
  nome: string;
  sabor: string | null;
  /** Peso do pote em gramas. */
  gramas: number;
  /** Custo unitário do pote, usado no cálculo de custo de inadimplência. */
  custoUnitario: Centavos;
  ativo: boolean;
  criadoEm: DataISO;
}

export interface ItemKit {
  produtoId: ID;
  quantidade: number;
}

export interface Kit {
  id: ID;
  nome: string;
  descricao: string;
  itens: ItemKit[];
  /** Preço cheio de tabela. */
  precoTabela: Centavos;
  /** Piso que o vendedor pode oferecer sem pedir ajuste ao Admin. */
  precoMinimo: Centavos;
  freteEstimado: Centavos;
  ativo: boolean;
  criadoEm: DataISO;
}
