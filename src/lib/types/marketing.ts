import type { Centavos, DataISO, Fonte, ID } from "./comum";

export type FormatoCriativo = "video" | "imagem" | "carrossel";

export const ROTULO_FORMATO: Record<FormatoCriativo, string> = {
  video: "Vídeo",
  imagem: "Imagem",
  carrossel: "Carrossel",
};

export interface LinhaWhatsApp {
  id: ID;
  nome: string;
  numero: string;
  /** Vendedores que atendem esta linha. */
  vendedoresIds: ID[];
  ativa: boolean;
  criadaEm: DataISO;
}

/**
 * Código do criativo: dois dígitos de mês e três de sequência (`09001`). A
 * variação é uma letra que marca outro corte do mesmo criativo (`09001B`).
 */
export const RE_CODIGO_CRIATIVO = /^\d{5}$/;
export const RE_VARIACAO_CRIATIVO = /^[A-Z]$/;

export interface Criativo {
  id: ID;
  nome: string;
  /** Cinco dígitos no padrão MM###. */
  codigo: string;
  /** Letra única, ou `null` quando é o criativo original. */
  variacao: string | null;
  formato: FormatoCriativo;
  linhaWhatsappId: ID;
  /** ID ou nome do anúncio no Meta. Guardado para o vínculo via API depois. */
  anuncioMeta: string | null;
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

/**
 * Totais de um dia lançados à mão, quando a API não trouxe o dia. Não tem
 * detalhe por criativo: na análise de criativos, esse investimento cai na
 * linha "Criativo não identificado".
 */
export interface DiaMetaAds {
  id: ID;
  data: string; // aaaa-mm-dd
  investimento: Centavos;
  leads: number;
  fonte: Fonte;
  lancadoEm: DataISO;
}
