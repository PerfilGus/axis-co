import type { Anexo, Centavos, DataISO, Fonte, ID } from "./comum";
import type { Rastreio } from "./rastreio";

export type StatusPedido =
  | "agendado"
  | "aguardando_autorizacao"
  | "autorizado"
  | "em_transito"
  | "entregue"
  | "pago"
  | "cancelado"
  | "reembolsado"
  | "inadimplente";

/** Status que encerram o ciclo do pedido. */
export const STATUS_FINAIS: StatusPedido[] = [
  "pago",
  "cancelado",
  "reembolsado",
  "inadimplente",
];

export interface Endereco {
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  cidade: string;
  uf: string;
  referencia: string | null;
}

export interface Cliente {
  id: ID;
  nome: string;
  telefone: string;
  /** Só dígitos; a máscara é aplicada na formatação. */
  cpf: string | null;
  endereco: Endereco;
  observacoes: string | null;
  criadoEm: DataISO;
}

export interface ItemPedido {
  kitId: ID;
  kitNome: string;
  quantidade: number;
  precoUnitario: Centavos;
}

export type StatusAjuste = "pendente" | "aprovado" | "recusado";

/**
 * Vendedor não edita pedido: ele pede. Todo desconto abaixo do preço mínimo
 * do kit vira um AjusteValor que só o Admin resolve.
 */
export interface AjusteValor {
  id: ID;
  pedidoId: ID;
  tipo: "desconto" | "acrescimo" | "alteracao_cadastral" | "exclusao";
  valorAnterior: Centavos;
  valorSolicitado: Centavos;
  motivo: string;
  solicitadoPor: ID;
  solicitadoEm: DataISO;
  status: StatusAjuste;
  decididoPor: ID | null;
  decididoEm: DataISO | null;
  observacaoDecisao: string | null;
}

/** Formas aceitas na cobrança pós-entrega. */
export type FormaPagamento = "pix" | "boleto" | "link_cartao" | "nao_definido";

export interface Cobranca {
  /** Cobrador responsável (atribuído pelo Admin ao vendedor). */
  responsavelId: ID | null;
  tentativas: number;
  ultimaTentativaEm: DataISO | null;
  proximoContatoEm: DataISO | null;
  formaPagamento: FormaPagamento;
  pagoEm: DataISO | null;
  /** O que de fato entrou; pode diferir do valor do pedido. */
  valorRecebido: Centavos | null;
  /** Taxa estimada da plataforma sobre este recebimento. */
  taxaAplicada: Centavos | null;
  bancoId: ID | null;
  comprovanteAnexoId: ID | null;
  observacoes: string | null;
}

/**
 * Custos que o pedido gera conforme sai do trilho feliz.
 * - cancelado: custo zero, conta como frustrado.
 * - reembolsado: custo de frete (ida/volta), sem custo de pote.
 * - inadimplente: custo de frete e de pote.
 */
export interface CustosPedido {
  frete: Centavos;
  pote: Centavos;
  total: Centavos;
}

export type TipoEventoPedido =
  | "criacao"
  | "autorizacao"
  | "rastreio"
  | "cobranca"
  | "custo"
  | "ajuste"
  | "anexo"
  | "status";

export interface EventoPedido {
  id: ID;
  tipo: TipoEventoPedido;
  titulo: string;
  descricao: string | null;
  ocorridoEm: DataISO;
  autorId: ID | null;
  fonte: Fonte;
  /** Status do pedido quando o evento é de mudança de status. */
  status?: StatusPedido;
  /** Valor quando o evento carrega dinheiro (custo, pagamento, ajuste). */
  valor?: Centavos;
}

export interface Pedido {
  id: ID;
  /** Código curto mostrado na interface: `AX-2481`. */
  codigo: string;
  status: StatusPedido;
  cliente: Cliente;
  itens: ItemPedido[];
  valorTotal: Centavos;
  frete: Centavos;

  vendedorId: ID;
  criativoId: ID | null;
  linhaWhatsappId: ID | null;

  agendadoPara: DataISO | null;
  criadoEm: DataISO;
  autorizadoEm: DataISO | null;
  autorizadoPor: ID | null;

  rastreio: Rastreio | null;
  cobranca: Cobranca;
  custos: CustosPedido;

  ajustes: AjusteValor[];
  anexos: Anexo[];
  linhaDoTempo: EventoPedido[];

  /**
   * Marcado pelo vendedor quando o cliente confirmou por texto. Dispensa o
   * áudio na checagem de autorização; o print continua obrigatório.
   */
  confirmacaoPorTexto: boolean;
  /** Endereço conferido pelo vendedor ou pelo Admin. */
  enderecoValidado: boolean;
  /** Motivo do cancelamento, quando houver. */
  motivoCancelamento: string | null;

  observacoes: string | null;
  fonte: Fonte;
  atualizadoEm: DataISO;
}
