import type { StatusPedido } from "@/lib/types";
import type { StatusRastreio } from "@/lib/types/rastreio";
import type { NomeIcone } from "@/components/icone";
import type { CategoriaDespesa } from "@/lib/types/financeiro";
import type { BonusNivel, PagamentoColaborador } from "@/lib/types/equipe";

/**
 * Tons de status. São fixos e vêm do axis-tracking: o destaque escolhido pelo
 * usuário nunca é usado aqui, e o amarelo da identidade tampouco.
 */
export type TomStatus =
  | "cinza"
  | "azul"
  | "laranja"
  | "verde"
  | "roxo"
  | "vermelho"
  | "esmeralda"
  | "turquesa"
  | "bronze"
  | "ardosia"
  | "rosa"
  | "carmim";

export interface EstiloStatus {
  cor: string;
  fundo: string;
}

export function estiloDoTom(tom: TomStatus): EstiloStatus {
  return { cor: `var(--st-${tom}-fg)`, fundo: `var(--st-${tom}-bg)` };
}

interface DefinicaoStatus<T extends string> {
  rotulo: string;
  tom: TomStatus;
  descricao: string;
  ordem: number;
  chave: T;
}

export const STATUS_PEDIDO: Record<StatusPedido, DefinicaoStatus<StatusPedido>> = {
  agendado: {
    chave: "agendado",
    rotulo: "Agendado",
    tom: "ardosia",
    descricao: "Pedido tirado pelo vendedor, ainda sem envio.",
    ordem: 1,
  },
  aguardando_autorizacao: {
    chave: "aguardando_autorizacao",
    rotulo: "Aguardando autorização",
    tom: "bronze",
    descricao: "Na fila do Admin para liberar o envio.",
    ordem: 2,
  },
  autorizado: {
    chave: "autorizado",
    rotulo: "Autorizado",
    tom: "turquesa",
    descricao: "Envio liberado, com código de rastreio gerado.",
    ordem: 3,
  },
  em_transito: {
    chave: "em_transito",
    rotulo: "Em trânsito",
    tom: "azul",
    descricao: "Objeto postado e circulando nos Correios.",
    ordem: 4,
  },
  entregue: {
    chave: "entregue",
    rotulo: "Entregue",
    tom: "verde",
    descricao: "Entregue ao cliente, cobrança em aberto.",
    ordem: 5,
  },
  pago: {
    chave: "pago",
    rotulo: "Pago",
    tom: "esmeralda",
    descricao: "Ciclo fechado: entregue e pago.",
    ordem: 6,
  },
  cancelado: {
    chave: "cancelado",
    rotulo: "Cancelado",
    tom: "cinza",
    descricao: "Cancelado antes de autorizar. Custo zero, conta como frustrado.",
    ordem: 7,
  },
  reembolsado: {
    chave: "reembolsado",
    rotulo: "Reembolsado",
    tom: "rosa",
    descricao: "Devolvido, recusado ou suspenso após o envio. Gera custo de frete.",
    ordem: 8,
  },
  inadimplente: {
    chave: "inadimplente",
    rotulo: "Inadimplente",
    tom: "carmim",
    descricao: "Entregue e não pago. Gera custo de frete e de pote.",
    ordem: 9,
  },
};

/**
 * Status de rastreio — portado 1:1 do `STATUS` do axis-tracking, incluindo
 * rótulo, cor, ícone e o título da seção na lista. Ver INVENTARIO.md §2.
 *
 * Estes status não usam o sistema de tons do pedido: as cores vêm das
 * variáveis `--rt-*`, que carregam os valores exatos do projeto original.
 */
export interface DefinicaoRastreio {
  chave: StatusRastreio;
  rotulo: string;
  /** Título da seção onde o pedido cai na lista. */
  secao: string;
  icone: NomeIcone;
  descricao: string;
}

export const STATUS_RASTREIO: Record<StatusRastreio, DefinicaoRastreio> = {
  aguardando_postagem: {
    chave: "aguardando_postagem",
    rotulo: "Aguardando postagem",
    secao: "Aguardando postagem",
    icone: "etiqueta",
    descricao: "Etiqueta emitida, objeto ainda não postado.",
  },
  postado: {
    chave: "postado",
    rotulo: "Postado",
    secao: "Postado",
    icone: "pedidos",
    descricao: "Primeiro evento registrado nos Correios.",
  },
  em_transferencia: {
    chave: "em_transferencia",
    rotulo: "Em transferência",
    secao: "Pedidos em Trânsito",
    icone: "transferencia",
    descricao: "Movimentação entre unidades.",
  },
  saiu_para_entrega: {
    chave: "saiu_para_entrega",
    rotulo: "Saiu para entrega",
    secao: "Saiu para Entrega",
    icone: "rastreio",
    descricao: "Rota de entrega final.",
  },
  entregue: {
    chave: "entregue",
    rotulo: "Entregue",
    secao: "Pedidos Entregues",
    icone: "check",
    descricao: "Entrega confirmada.",
  },
  aguardando_retirada: {
    chave: "aguardando_retirada",
    rotulo: "Aguardando retirada",
    secao: "Aguardando Retirada",
    icone: "local",
    descricao: "Disponível em agência.",
  },
  falha: {
    chave: "falha",
    rotulo: "Falha",
    secao: "Falha na Entrega",
    icone: "alerta",
    descricao: "Qualquer insucesso de entrega.",
  },
};

/** Ordem de importância das seções na lista. */
export const ORDEM_SECOES_RASTREIO: StatusRastreio[] = [
  "entregue",
  "saiu_para_entrega",
  "falha",
  "aguardando_retirada",
  "em_transferencia",
  "postado",
  "aguardando_postagem",
];

export interface CoresRastreio {
  base: string;
  texto: string;
}

export function coresRastreio(status: StatusRastreio): CoresRastreio {
  return {
    base: `var(--rt-${status}-base)`,
    texto: `var(--rt-${status}-text)`,
  };
}

/**
 * Cor de status com opacidade. Equivale ao `hexToRgba()` do axis-tracking —
 * as opacidades em uso são as mesmas: 0.15 card destacado, 0.18 fundo de
 * badge, 0.4 borda de badge, 0.08 bloco de alerta, 0.35 borda dele.
 */
export function corComOpacidade(cor: string, alfa: number): string {
  return `color-mix(in srgb, ${cor} ${Math.round(alfa * 100)}%, transparent)`;
}

/** Alíquota do Simples: lançada para o mês, ou herdada do anterior. */
export const SITUACAO_ALIQUOTA: Record<
  "estimada" | "confirmada",
  { rotulo: string; tom: TomStatus }
> = {
  estimada: { rotulo: "Estimada", tom: "bronze" },
  confirmada: { rotulo: "Confirmada", tom: "esmeralda" },
};

/** Situação de uma dívida, derivada das parcelas. */
export const STATUS_DIVIDA: Record<
  "em_dia" | "atrasada" | "quitada",
  { rotulo: string; tom: TomStatus }
> = {
  em_dia: { rotulo: "Em dia", tom: "verde" },
  atrasada: { rotulo: "Atrasada", tom: "carmim" },
  quitada: { rotulo: "Quitada", tom: "esmeralda" },
};

/** Como o custo previsto de um pedido enviado foi montado. */
export const SITUACAO_CUSTO_FORNECEDOR: Record<
  "em_transito" | "completo" | "so_frete",
  { rotulo: string; tom: TomStatus }
> = {
  em_transito: { rotulo: "Em trânsito", tom: "azul" },
  completo: { rotulo: "Frete e potes", tom: "ardosia" },
  so_frete: { rotulo: "Só frete", tom: "rosa" },
};

export const STATUS_PAGAMENTO_COLABORADOR: Record<
  PagamentoColaborador["status"],
  { rotulo: string; tom: TomStatus }
> = {
  pendente: { rotulo: "Pendente", tom: "bronze" },
  pago: { rotulo: "Pago", tom: "esmeralda" },
};

export const STATUS_BONUS_NIVEL: Record<
  BonusNivel["status"],
  { rotulo: string; tom: TomStatus }
> = {
  liberado: { rotulo: "Liberado, aguardando pagamento", tom: "bronze" },
  pago: { rotulo: "Pago", tom: "esmeralda" },
};

export const STATUS_AJUSTE: Record<
  "pendente" | "aprovado" | "recusado",
  { rotulo: string; tom: TomStatus }
> = {
  pendente: { rotulo: "Pendente", tom: "bronze" },
  aprovado: { rotulo: "Aprovado", tom: "verde" },
  recusado: { rotulo: "Recusado", tom: "vermelho" },
};

export const CATEGORIA_DESPESA: Record<CategoriaDespesa, string> = {
  ferramentas: "Ferramentas",
  telefonia: "Telefonia",
  internet: "Internet",
  aluguel: "Aluguel",
  energia: "Energia",
  contabilidade: "Contabilidade",
  pro_labore: "Pró-labore",
  outros: "Outros",
};

/** Ordem do ciclo feliz, usada na linha do tempo e no indicador de etapas. */
export const CICLO_PEDIDO: StatusPedido[] = [
  "agendado",
  "aguardando_autorizacao",
  "autorizado",
  "em_transito",
  "entregue",
  "pago",
];
