import type {
  AjusteValor,
  Anexo,
  Centavos,
  Cliente,
  Colaborador,
  DataISO,
  EventoPedido,
  FormaPagamento,
  ID,
  Kit,
  LinhaWhatsApp,
  Pedido,
  Produto,
  TipoEventoPedido,
} from "@/lib/types";
import { formatBRL } from "@/lib/format";
import { ROTULO_FORMA } from "@/lib/taxas";
import { pendenciasDe } from "@/lib/checklist";
import { custoPotesDoKit } from "@/lib/catalogo";
import { CRIATIVO_NAO_IDENTIFICADO } from "@/lib/criativos";

/**
 * Regras de mudança de um pedido.
 *
 * Funções puras: recebem o pedido atual e devolvem o novo, com os eventos da
 * linha do tempo já acrescentados. O servidor as executa sobre o que leu do
 * banco e grava o resultado; a tela nunca decide o estado final.
 */

export interface Contexto {
  autorId: ID;
  agora: DataISO;
  novoId: () => ID;
}

export interface RascunhoPedido {
  cliente: Omit<Cliente, "id" | "criadoEm">;
  kitId: ID;
  criativoId: string;
  observacoes: string;
  confirmacaoPorTexto: boolean;
  /** Ajuste opcional pedido no fechamento. */
  ajuste: { tipo: "desconto" | "acrescimo"; valor: Centavos; motivo: string } | null;
}

export interface DadosPagamento {
  valorRecebido: Centavos;
  data: DataISO;
  forma: Exclude<FormaPagamento, "nao_definido">;
  bancoId: ID;
  /** Calculada na tela com o cadastro do banco e a franquia em curso. */
  taxaAplicada: Centavos;
  observacoes: string | null;
}

/** Correção feita pelo Admin direto no pedido. */
export interface EdicaoPedido {
  cliente: Omit<Cliente, "id" | "criadoEm">;
  observacoes: string | null;
  valorTotal: Centavos;
  enderecoValidado: boolean;
  confirmacaoPorTexto: boolean;
}

export function evento(
  ctx: Contexto,
  tipo: TipoEventoPedido,
  titulo: string,
  descricao: string | null,
  extra: Partial<EventoPedido> = {},
): EventoPedido {
  return {
    id: ctx.novoId(),
    tipo,
    titulo,
    descricao,
    ocorridoEm: ctx.agora,
    autorId: ctx.autorId,
    fonte: "manual",
    ...extra,
  };
}

/** Cobrador que assume o pedido: o que tem o vendedor atribuído a ele. */
export function cobradorDoVendedor(colaboradores: Colaborador[], vendedorId: ID): ID | null {
  return (
    colaboradores.find(
      (c) => c.ativo && c.perfil === "cobrador" && c.vendedoresAtribuidos.includes(vendedorId),
    )?.id ?? null
  );
}

export function criarPedido(
  rascunho: RascunhoPedido,
  vendedorId: ID,
  cadastros: { kits: Kit[]; linhas: LinhaWhatsApp[] },
  ctx: Contexto,
): Omit<Pedido, "codigo"> {
  const kit = cadastros.kits.find((k) => k.id === rascunho.kitId);
  if (!kit) throw new Error("Kit não encontrado.");

  const pedidoId = ctx.novoId();
  const valorTotal = kit.precoTabela;
  const linha =
    cadastros.linhas.find((l) => l.ativa && l.vendedoresIds.includes(vendedorId)) ?? null;

  const ajustes: AjusteValor[] = rascunho.ajuste
    ? [
        {
          id: ctx.novoId(),
          pedidoId,
          tipo: rascunho.ajuste.tipo,
          valorAnterior: valorTotal,
          valorSolicitado:
            rascunho.ajuste.tipo === "desconto"
              ? valorTotal - rascunho.ajuste.valor
              : valorTotal + rascunho.ajuste.valor,
          motivo: rascunho.ajuste.motivo,
          solicitadoPor: ctx.autorId,
          solicitadoEm: ctx.agora,
          status: "pendente",
          decididoPor: null,
          decididoEm: null,
          observacaoDecisao: null,
        },
      ]
    : [];

  return {
    id: pedidoId,
    status: "agendado",
    cliente: { ...rascunho.cliente, id: ctx.novoId(), criadoEm: ctx.agora },
    itens: [{ kitId: kit.id, kitNome: kit.nome, quantidade: 1, precoUnitario: valorTotal }],
    valorTotal,
    frete: kit.freteEstimado,
    vendedorId,
    criativoId:
      rascunho.criativoId === CRIATIVO_NAO_IDENTIFICADO ? null : rascunho.criativoId,
    linhaWhatsappId: linha?.id ?? null,
    agendadoPara: ctx.agora,
    criadoEm: ctx.agora,
    autorizadoEm: null,
    autorizadoPor: null,
    rastreio: null,
    rastreioRemovidoEm: null,
    cobranca: {
      responsavelId: null,
      tentativas: 0,
      ultimaTentativaEm: null,
      proximoContatoEm: null,
      formaPagamento: "nao_definido",
      pagoEm: null,
      valorRecebido: null,
      taxaAplicada: null,
      bancoId: null,
      comprovanteAnexoId: null,
      observacoes: null,
    },
    custos: { frete: 0, pote: 0, total: 0 },
    ajustes,
    anexos: [],
    linhaDoTempo: [
      evento(ctx, "criacao", "Pedido criado", `Fechamento por telefone, valor de ${formatBRL(valorTotal)}.`, {
        status: "agendado",
        valor: valorTotal,
      }),
      ...ajustes.map((a) =>
        evento(
          ctx,
          "ajuste",
          "Ajuste de valor solicitado",
          `${a.motivo} De ${formatBRL(a.valorAnterior)} para ${formatBRL(a.valorSolicitado)}.`,
          { valor: a.valorSolicitado },
        ),
      ),
    ],
    confirmacaoPorTexto: rascunho.confirmacaoPorTexto,
    enderecoValidado: true,
    motivoCancelamento: null,
    observacoes: rascunho.observacoes.trim() || null,
    fonte: "manual",
    atualizadoEm: ctx.agora,
    finalizadoEm: null,
  };
}

export function anexar(pedido: Pedido, anexo: Anexo, ctx: Contexto): Pedido {
  return {
    ...pedido,
    anexos: [...pedido.anexos, anexo],
    atualizadoEm: ctx.agora,
    linhaDoTempo: [...pedido.linhaDoTempo, evento(ctx, "anexo", "Anexo adicionado", anexo.nome)],
  };
}

export function editarPedido(pedido: Pedido, edicao: EdicaoPedido, ctx: Contexto): Pedido {
  const mudouValor = edicao.valorTotal !== pedido.valorTotal;
  return {
    ...pedido,
    cliente: { ...pedido.cliente, ...edicao.cliente },
    observacoes: edicao.observacoes,
    valorTotal: edicao.valorTotal,
    itens: mudouValor
      ? pedido.itens.map((i, idx) => (idx === 0 ? { ...i, precoUnitario: edicao.valorTotal } : i))
      : pedido.itens,
    enderecoValidado: edicao.enderecoValidado,
    confirmacaoPorTexto: edicao.confirmacaoPorTexto,
    atualizadoEm: ctx.agora,
    linhaDoTempo: [
      ...pedido.linhaDoTempo,
      evento(
        ctx,
        "status",
        "Pedido editado pelo Admin",
        mudouValor
          ? `Valor de ${formatBRL(pedido.valorTotal)} para ${formatBRL(edicao.valorTotal)}.`
          : "Dados do pedido corrigidos.",
        mudouValor ? { valor: edicao.valorTotal } : {},
      ),
    ],
  };
}

export interface ResultadoAutorizacao {
  autorizados: Pedido[];
  bloqueados: Array<{ pedido: Pedido; motivo: string }>;
}

/**
 * Autoriza o envio. A checagem é a mesma da tela (`pendenciasDe`), então não
 * há caminho que libere um pedido sem print e confirmação. O código de
 * rastreio fica vazio até a integração com a logística devolvê-lo.
 */
export function autorizar(
  pedidos: Pedido[],
  colaboradores: Colaborador[],
  ctx: Contexto,
): ResultadoAutorizacao {
  const autorizados: Pedido[] = [];
  const bloqueados: ResultadoAutorizacao["bloqueados"] = [];

  for (const pedido of pedidos) {
    if (!["agendado", "aguardando_autorizacao"].includes(pedido.status)) {
      bloqueados.push({ pedido, motivo: "O pedido não está esperando autorização." });
      continue;
    }
    const pendencias = pendenciasDe(pedido);
    if (pendencias.length > 0) {
      bloqueados.push({ pedido, motivo: pendencias[0].motivo ?? "Checagem pendente." });
      continue;
    }
    autorizados.push({
      ...pedido,
      status: "autorizado",
      autorizadoEm: ctx.agora,
      autorizadoPor: ctx.autorId,
      atualizadoEm: ctx.agora,
      cobranca: {
        ...pedido.cobranca,
        responsavelId: cobradorDoVendedor(colaboradores, pedido.vendedorId),
      },
      linhaDoTempo: [
        ...pedido.linhaDoTempo,
        evento(ctx, "autorizacao", "Envio autorizado", "O código de rastreio chega com a integração de logística.", {
          status: "autorizado",
        }),
      ],
    });
  }
  return { autorizados, bloqueados };
}

/** Cancelar só faz sentido antes de autorizar: depois, o custo já existe. */
export function cancelar(pedido: Pedido, motivo: string, ctx: Contexto): Pedido | null {
  if (!["agendado", "aguardando_autorizacao"].includes(pedido.status)) return null;
  return {
    ...pedido,
    status: "cancelado",
    motivoCancelamento: motivo,
    atualizadoEm: ctx.agora,
    linhaDoTempo: [
      ...pedido.linhaDoTempo,
      evento(ctx, "status", "Pedido cancelado", motivo, { status: "cancelado", valor: 0 }),
    ],
  };
}

export function solicitarAjuste(
  pedido: Pedido,
  entrada: Pick<AjusteValor, "tipo" | "valorSolicitado" | "motivo">,
  ctx: Contexto,
): Pedido {
  const ajuste: AjusteValor = {
    id: ctx.novoId(),
    pedidoId: pedido.id,
    tipo: entrada.tipo,
    valorAnterior: pedido.valorTotal,
    valorSolicitado: entrada.valorSolicitado,
    motivo: entrada.motivo,
    solicitadoPor: ctx.autorId,
    solicitadoEm: ctx.agora,
    status: "pendente",
    decididoPor: null,
    decididoEm: null,
    observacaoDecisao: null,
  };
  const titulo =
    entrada.tipo === "exclusao"
      ? "Exclusão solicitada"
      : entrada.tipo === "alteracao_cadastral"
        ? "Alteração solicitada"
        : "Ajuste de valor solicitado";
  return {
    ...pedido,
    ajustes: [...pedido.ajustes, ajuste],
    atualizadoEm: ctx.agora,
    linhaDoTempo: [...pedido.linhaDoTempo, evento(ctx, "ajuste", titulo, entrada.motivo)],
  };
}

export function decidirAjuste(
  pedido: Pedido,
  ajusteId: ID,
  decisao: "aprovado" | "recusado",
  observacao: string | null,
  ctx: Contexto,
): Pedido | null {
  const ajuste = pedido.ajustes.find((a) => a.id === ajusteId);
  if (!ajuste || ajuste.status !== "pendente") return null;

  // Aprovar um ajuste de valor muda o valor do pedido de verdade.
  const mexeNoValor =
    decisao === "aprovado" && (ajuste.tipo === "desconto" || ajuste.tipo === "acrescimo");
  const valorTotal = mexeNoValor ? ajuste.valorSolicitado : pedido.valorTotal;

  return {
    ...pedido,
    ajustes: pedido.ajustes.map((a) =>
      a.id === ajusteId
        ? { ...a, status: decisao, decididoPor: ctx.autorId, decididoEm: ctx.agora, observacaoDecisao: observacao }
        : a,
    ),
    valorTotal,
    itens: mexeNoValor
      ? pedido.itens.map((i, idx) => (idx === 0 ? { ...i, precoUnitario: valorTotal } : i))
      : pedido.itens,
    atualizadoEm: ctx.agora,
    linhaDoTempo: [
      ...pedido.linhaDoTempo,
      evento(ctx, "ajuste", decisao === "aprovado" ? "Ajuste aprovado" : "Ajuste recusado", observacao, {
        valor: mexeNoValor ? valorTotal : undefined,
      }),
    ],
  };
}

export function registrarPagamento(pedido: Pedido, dados: DadosPagamento, ctx: Contexto): Pedido {
  return {
    ...pedido,
    status: "pago",
    // Pago é o fim do ciclo: o custo que a inadimplência tinha gerado deixa de valer.
    custos: { frete: 0, pote: 0, total: 0 },
    cobranca: {
      ...pedido.cobranca,
      formaPagamento: dados.forma,
      pagoEm: dados.data,
      valorRecebido: dados.valorRecebido,
      taxaAplicada: dados.taxaAplicada,
      bancoId: dados.bancoId,
      proximoContatoEm: null,
      observacoes: dados.observacoes,
    },
    atualizadoEm: ctx.agora,
    linhaDoTempo: [
      ...pedido.linhaDoTempo,
      evento(
        ctx,
        "cobranca",
        "Pagamento recebido",
        `Recebido via ${ROTULO_FORMA[dados.forma].toLowerCase()}. Taxa estimada de ${formatBRL(dados.taxaAplicada)}.`,
        { ocorridoEm: dados.data, status: "pago", valor: dados.valorRecebido },
      ),
    ],
  };
}

export function marcarInadimplente(
  pedido: Pedido,
  cadastros: { kits: Kit[]; produtos: Produto[] },
  ctx: Contexto,
): Pedido {
  const pote = custoPotesDoKit(pedido.itens[0]?.kitId ?? "", cadastros.kits, cadastros.produtos);
  const custos = { frete: pedido.frete, pote, total: pedido.frete + pote };
  return {
    ...pedido,
    status: "inadimplente",
    custos,
    atualizadoEm: ctx.agora,
    linhaDoTempo: [
      ...pedido.linhaDoTempo,
      evento(
        ctx,
        "custo",
        "Custo de frete e de pote gerado",
        `Entregue e não pago. Frete ${formatBRL(custos.frete)} e pote ${formatBRL(custos.pote)}.`,
        { status: "inadimplente", valor: custos.total },
      ),
    ],
  };
}

/** Arquiva ou desarquiva o rastreio. Manual e reversível: nada some sozinho. */
export function arquivarRastreio(pedido: Pedido, arquivar: boolean, ctx: Contexto): Pedido | null {
  if (!pedido.rastreio || pedido.rastreio.arquivado === arquivar) return null;
  return {
    ...pedido,
    rastreio: {
      ...pedido.rastreio,
      arquivado: arquivar,
      // O prazo de arquivamento recomeça do zero ao desarquivar.
      arquivadoEm: arquivar ? ctx.agora : null,
    },
  };
}

/**
 * Apaga o rastreio da aba Rastreio. Só vale para arquivado: tira o objeto da
 * lista e das sincronizações, sem mexer em status, valores, histórico nem no
 * código de rastreio guardado no pedido. Não tem volta pela interface.
 */
export function apagarRastreio(pedido: Pedido, ctx: Contexto): Pedido | null {
  if (!pedido.rastreio?.arquivado || pedido.rastreioRemovidoEm) return null;
  return { ...pedido, rastreioRemovidoEm: ctx.agora };
}

export function limparDestaque(pedido: Pedido): Pedido | null {
  if (!pedido.rastreio?.destacado) return null;
  return { ...pedido, rastreio: { ...pedido.rastreio, destacado: false } };
}
