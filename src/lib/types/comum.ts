/** Identificador opaco (uuid gerado no servidor). */
export type ID = string;

/** Data no formato ISO 8601 (`2026-03-14T18:22:00-03:00`). */
export type DataISO = string;

/**
 * Valores monetários trafegam em CENTAVOS (inteiro) para nunca sofrerem
 * arredondamento de ponto flutuante. Formate sempre com `formatBRL`.
 */
export type Centavos = number;

/**
 * De onde o dado veio. Enquanto não há integração, tudo nasce `manual`.
 * A interface mostra um selo com esse valor — é o gancho visual das
 * integrações futuras (VendLiber, Correios, Meta, bancos).
 */
export type Fonte = "manual" | "api";

export type Integracao = "vendliber" | "correios" | "meta" | "banco";

/**
 * `print_confirmacao` e `audio_confirmacao` são as provas que o vendedor
 * anexa ao fechar o pedido — a checagem de autorização depende delas.
 */
export type TipoAnexo =
  | "print_confirmacao"
  | "audio_confirmacao"
  | "comprovante"
  | "foto_entrega"
  | "nota_fiscal"
  | "documento"
  | "outro";

export interface Anexo {
  id: ID;
  nome: string;
  tipo: TipoAnexo;
  tamanhoBytes: number;
  mime: string;
  criadoEm: DataISO;
  criadoPor: ID;
  /** Endereço privado `/api/anexos/[id]`: só abre para quem está logado. */
  url: string;
}

export interface Paginacao {
  pagina: number;
  porPagina: number;
  total: number;
}
