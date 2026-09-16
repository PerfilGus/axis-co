import type { Centavos, DataISO, Fonte, ID } from "./comum";

export type FormatoCriativo = "video" | "imagem" | "carrossel";

export interface LinhaWhatsApp {
  id: ID;
  nome: string;
  numero: string;
  /** Vendedores que atendem esta linha. */
  vendedoresIds: ID[];
  ativa: boolean;
  criadaEm: DataISO;
}

export interface Criativo {
  id: ID;
  nome: string;
  /** Código no anúncio, usado para casar lead e criativo. */
  codigo: string;
  formato: FormatoCriativo;
  linhaWhatsappId: ID;
  thumbUrl: string | null;
  ativo: boolean;
  criadoEm: DataISO;
}

export interface LancamentoMetaAds {
  id: ID;
  data: DataISO; // aaaa-mm-dd
  criativoId: ID;
  campanha: string;
  investimento: Centavos;
  impressoes: number;
  cliques: number;
  conversas: number;
  fonte: Fonte;
}
