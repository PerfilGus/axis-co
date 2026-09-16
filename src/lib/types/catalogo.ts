import type { Centavos, DataISO, ID } from "./comum";

export interface Produto {
  id: ID;
  nome: string;
  sabor: string | null;
  /** Peso do pote em gramas. */
  gramas: number;
  /** Custo unitário do pote, usado no cálculo de custo de inadimplência. */
  custoUnitario: Centavos;
  /** Foto enviada no cadastro. Sem ela, a tela desenha a inicial. */
  fotoUrl: string | null;
  ativo: boolean;
  criadoEm: DataISO;
}

export interface ItemKit {
  produtoId: ID;
  quantidade: number;
}

/**
 * Kit é o que se vende. A estrutura aceita vários produtos por kit; o
 * cadastro desta versão monta um produto só, e o pedido leva um kit.
 */
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
