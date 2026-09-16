"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  AjusteValor,
  Anexo,
  Centavos,
  Cliente,
  DataISO,
  EventoPedido,
  FormaPagamento,
  ID,
  Pedido,
  StatusPedido,
  TipoEventoPedido,
} from "@/lib/types";
import { formatBRL } from "@/lib/format";
import { ROTULO_FORMA, taxaEstimada } from "@/lib/taxas";
import { pendenciasDe } from "@/lib/checklist";
import { avancarRastreio } from "@/lib/rastreio/simulacao";
import { PEDIDOS } from "@/lib/mock/pedidos";
import { custoPotesDoKit, KIT_POR_ID } from "@/lib/mock/catalogo";
import { CRIATIVO_NAO_IDENTIFICADO, LINHA_POR_ID } from "@/lib/mock/marketing";

/**
 * Estado dos pedidos durante a sessão.
 *
 * Nada é persistido: recarregar a página volta ao mock. Cada ação aqui é a
 * mutação que o backend vai expor depois — as telas não precisam saber a
 * diferença.
 */

export interface RascunhoPedido {
  cliente: Omit<Cliente, "id" | "criadoEm">;
  kitId: ID;
  criativoId: string;
  observacoes: string;
  confirmacaoPorTexto: boolean;
  /** Ajuste opcional pedido no fechamento. */
  ajuste: { tipo: "desconto" | "acrescimo"; valor: Centavos; motivo: string } | null;
  anexos: Array<Pick<Anexo, "nome" | "tipo" | "tamanhoBytes" | "mime">>;
}

export interface DadosPagamento {
  valorRecebido: Centavos;
  data: DataISO;
  forma: Exclude<FormaPagamento, "nao_definido">;
  bancoId: ID;
  observacoes: string | null;
}

export interface ResultadoAutorizacao {
  autorizados: Pedido[];
  bloqueados: Array<{ pedido: Pedido; motivo: string }>;
}

interface ContextoPedidos {
  pedidos: Pedido[];
  criar: (rascunho: RascunhoPedido, vendedorId: ID) => Pedido;
  autorizar: (ids: ID[], autorId: ID) => ResultadoAutorizacao;
  cancelar: (ids: ID[], motivo: string, autorId: ID) => number;
  solicitarAjuste: (
    pedidoId: ID,
    entrada: Pick<AjusteValor, "tipo" | "valorSolicitado" | "motivo">,
    solicitanteId: ID,
  ) => void;
  decidirAjuste: (
    pedidoId: ID,
    ajusteId: ID,
    decisao: "aprovado" | "recusado",
    autorId: ID,
    observacao: string | null,
  ) => void;
  registrarPagamento: (pedidoId: ID, dados: DadosPagamento, autorId: ID) => void;
  marcarInadimplente: (pedidoId: ID, autorId: ID) => void;
  excluir: (pedidoId: ID) => void;

  /* --- rastreio (portado do axis-tracking) --- */
  /** Arquiva ou desarquiva. É manual e reversível: nada some sozinho. */
  arquivarRastreio: (ids: ID[], arquivar: boolean) => number;
  /** Abrir o pedido consome o destaque daquele rastreio. */
  limparDestaque: (pedidoId: ID) => void;
  /** Zera o destaque de todos de uma vez, sem abrir um por um. */
  redefinirDestaques: () => void;
  /** Atualização simulada dos rastreios; devolve quantos mudaram. */
  atualizarRastreios: () => { atualizados: number; verificados: number };
}

const Contexto = createContext<ContextoPedidos | null>(null);

/** Cobrador que assume o pedido assim que o envio é autorizado. */
const COBRADOR_PADRAO = "col_0005";

let sequencia = 9000;
let proximoCodigo = 2500;
function novoId(prefixo: string): string {
  sequencia += 1;
  return `${prefixo}_${sequencia}`;
}

function agora(): DataISO {
  return new Date().toISOString();
}

function evento(
  tipo: TipoEventoPedido,
  titulo: string,
  descricao: string | null,
  autorId: ID | null,
  extra: Partial<EventoPedido> = {},
): EventoPedido {
  return {
    id: novoId("evt"),
    tipo,
    titulo,
    descricao,
    ocorridoEm: agora(),
    autorId,
    fonte: "manual",
    ...extra,
  };
}

/** Código de rastreio simulado. A VendLiber devolve o de verdade depois. */
function simularCodigoRastreio(): string {
  const letras = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const l = () => letras[Math.floor(Math.random() * letras.length)];
  const n = String(Math.floor(Math.random() * 900_000_000) + 100_000_000);
  return `${l()}${l()}${n}BR`;
}

export function PedidosProvider({ children }: { children: ReactNode }) {
  const [pedidos, setPedidos] = useState<Pedido[]>(PEDIDOS);

  const aplicar = useCallback(
    (ids: ID[], transformar: (pedido: Pedido) => Pedido) => {
      const alvo = new Set(ids);
      setPedidos((atual) =>
        atual.map((p) => (alvo.has(p.id) ? transformar(p) : p)),
      );
    },
    [],
  );

  const criar = useCallback<ContextoPedidos["criar"]>((rascunho, vendedorId) => {
    const kit = KIT_POR_ID.get(rascunho.kitId);
    if (!kit) throw new Error(`Kit desconhecido: ${rascunho.kitId}`);

    const criadoEm = agora();
    const pedidoId = novoId("ped");
    const temAjuste = rascunho.ajuste !== null;
    const valorTotal = kit.precoTabela;

    const linha =
      [...LINHA_POR_ID.values()].find((l) =>
        l.vendedoresIds.includes(vendedorId),
      ) ?? null;

    const anexos: Anexo[] = rascunho.anexos.map((a) => ({
      ...a,
      id: novoId("anx"),
      criadoEm,
      criadoPor: vendedorId,
      url: "#",
    }));

    const ajustes: AjusteValor[] = temAjuste
      ? [
          {
            id: novoId("aju"),
            pedidoId,
            tipo: rascunho.ajuste!.tipo,
            valorAnterior: valorTotal,
            valorSolicitado:
              rascunho.ajuste!.tipo === "desconto"
                ? valorTotal - rascunho.ajuste!.valor
                : valorTotal + rascunho.ajuste!.valor,
            motivo: rascunho.ajuste!.motivo,
            solicitadoPor: vendedorId,
            solicitadoEm: criadoEm,
            status: "pendente",
            decididoPor: null,
            decididoEm: null,
            observacaoDecisao: null,
          },
        ]
      : [];

    const linhaDoTempo: EventoPedido[] = [
      evento(
        "criacao",
        "Pedido criado",
        `Fechamento por telefone, valor de ${formatBRL(valorTotal)}.`,
        vendedorId,
        { ocorridoEm: criadoEm, status: "agendado", valor: valorTotal },
      ),
      ...anexos.map((a) =>
        evento("anexo", "Anexo adicionado", a.nome, vendedorId, {
          ocorridoEm: criadoEm,
        }),
      ),
      ...ajustes.map((a) =>
        evento(
          "ajuste",
          "Ajuste de valor solicitado",
          `${a.motivo} De ${formatBRL(a.valorAnterior)} para ${formatBRL(a.valorSolicitado)}.`,
          vendedorId,
          { ocorridoEm: criadoEm, valor: a.valorSolicitado },
        ),
      ),
    ];

    const pedido: Pedido = {
      id: pedidoId,
      codigo: `AX-${proximoCodigo++}`,
      status: "agendado",
      cliente: { ...rascunho.cliente, id: novoId("cli"), criadoEm },
      itens: [
        {
          kitId: kit.id,
          kitNome: kit.nome,
          quantidade: 1,
          precoUnitario: valorTotal,
        },
      ],
      valorTotal,
      frete: kit.freteEstimado,
      vendedorId,
      criativoId:
        rascunho.criativoId === CRIATIVO_NAO_IDENTIFICADO
          ? null
          : rascunho.criativoId,
      linhaWhatsappId: linha?.id ?? null,
      agendadoPara: criadoEm,
      criadoEm,
      autorizadoEm: null,
      autorizadoPor: null,
      rastreio: null,
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
      anexos,
      linhaDoTempo,
      confirmacaoPorTexto: rascunho.confirmacaoPorTexto,
      enderecoValidado: true,
      motivoCancelamento: null,
      observacoes: rascunho.observacoes.trim() || null,
      fonte: "manual",
      atualizadoEm: criadoEm,
    };

    setPedidos((atual) => [pedido, ...atual]);
    return pedido;
  }, []);

  /**
   * Autoriza em lote. O resultado é calculado antes do `setPedidos` para que a
   * função de atualização continue pura — em desenvolvimento o React a chama
   * duas vezes, e um acumulador dentro dela duplicaria os itens.
   */
  const autorizar = useCallback<ContextoPedidos["autorizar"]>(
    (ids, autorId) => {
      const alvo = new Set(ids);
      const autorizados: Pedido[] = [];
      const bloqueados: ResultadoAutorizacao["bloqueados"] = [];
      const porId = new Map<ID, Pedido>();

      for (const pedido of pedidos) {
        if (!alvo.has(pedido.id)) continue;

        const pendencias = pendenciasDe(pedido);
        if (pendencias.length > 0) {
          bloqueados.push({
            pedido,
            motivo: pendencias[0].motivo ?? "Checagem pendente.",
          });
          continue;
        }

        const quando = agora();
        const codigo = simularCodigoRastreio();
        const autorizado: Pedido = {
          ...pedido,
          status: "autorizado",
          autorizadoEm: quando,
          autorizadoPor: autorId,
          atualizadoEm: quando,
          cobranca: { ...pedido.cobranca, responsavelId: COBRADOR_PADRAO },
          rastreio: {
            codigo,
            status: "aguardando_postagem",
            servico: "PAC Contrato",
            postadoEm: null,
            previsaoEntrega: null,
            entregueEm: null,
            tentativasEntrega: 0,
            eventos: [
              {
                id: novoId("rst"),
                status: "aguardando_postagem",
                titulo: "Etiqueta emitida",
                detalhe: "Objeto ainda não postado nos Correios.",
                unidade: "Agência dos Correios, São Paulo/SP",
                cidade: "São Paulo",
                uf: "SP",
                ocorridoEm: quando,
              },
            ],
            motivoFalha: null,
            retirada: null,
            destacado: true,
            arquivado: false,
            arquivadoEm: null,
            atualizadoEm: quando,
            // Simulado. Vira `api` quando a VendLiber entrar.
            fonte: "manual",
          },
          linhaDoTempo: [
            ...pedido.linhaDoTempo,
            evento(
              "autorizacao",
              "Envio autorizado",
              `Código de rastreio ${codigo} gerado.`,
              autorId,
              { ocorridoEm: quando, status: "autorizado" },
            ),
          ],
        };
        autorizados.push(autorizado);
        porId.set(pedido.id, autorizado);
      }

      if (porId.size > 0) {
        setPedidos((atual) => atual.map((p) => porId.get(p.id) ?? p));
      }
      return { autorizados, bloqueados };
    },
    [pedidos],
  );

  const cancelar = useCallback<ContextoPedidos["cancelar"]>(
    (ids, motivo, autorId) => {
      const alvo = new Set(ids);
      const porId = new Map<ID, Pedido>();

      for (const pedido of pedidos) {
        if (!alvo.has(pedido.id)) continue;
        // Cancelar só faz sentido antes de autorizar: depois disso o custo já
        // existe e a saída é reembolso.
        if (!["agendado", "aguardando_autorizacao"].includes(pedido.status)) {
          continue;
        }
        const quando = agora();
        porId.set(pedido.id, {
          ...pedido,
          status: "cancelado" as StatusPedido,
          motivoCancelamento: motivo,
          atualizadoEm: quando,
          linhaDoTempo: [
            ...pedido.linhaDoTempo,
            evento("status", "Pedido cancelado", motivo, autorId, {
              ocorridoEm: quando,
              status: "cancelado",
              valor: 0,
            }),
          ],
        });
      }

      if (porId.size > 0) {
        setPedidos((atual) => atual.map((p) => porId.get(p.id) ?? p));
      }
      return porId.size;
    },
    [pedidos],
  );

  const solicitarAjuste = useCallback<ContextoPedidos["solicitarAjuste"]>(
    (pedidoId, entrada, solicitanteId) => {
      aplicar([pedidoId], (pedido) => {
        const quando = agora();
        const ajuste: AjusteValor = {
          id: novoId("aju"),
          pedidoId,
          tipo: entrada.tipo,
          valorAnterior: pedido.valorTotal,
          valorSolicitado: entrada.valorSolicitado,
          motivo: entrada.motivo,
          solicitadoPor: solicitanteId,
          solicitadoEm: quando,
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
          atualizadoEm: quando,
          linhaDoTempo: [
            ...pedido.linhaDoTempo,
            evento("ajuste", titulo, entrada.motivo, solicitanteId, {
              ocorridoEm: quando,
            }),
          ],
        };
      });
    },
    [aplicar],
  );

  const decidirAjuste = useCallback<ContextoPedidos["decidirAjuste"]>(
    (pedidoId, ajusteId, decisao, autorId, observacao) => {
      aplicar([pedidoId], (pedido) => {
        const quando = agora();
        const ajuste = pedido.ajustes.find((a) => a.id === ajusteId);
        if (!ajuste || ajuste.status !== "pendente") return pedido;

        const ajustes = pedido.ajustes.map((a) =>
          a.id === ajusteId
            ? {
                ...a,
                status: decisao,
                decididoPor: autorId,
                decididoEm: quando,
                observacaoDecisao: observacao,
              }
            : a,
        );

        // Aprovar um ajuste de valor muda o valor do pedido de verdade.
        const mexeNoValor =
          decisao === "aprovado" &&
          (ajuste.tipo === "desconto" || ajuste.tipo === "acrescimo");
        const valorTotal = mexeNoValor ? ajuste.valorSolicitado : pedido.valorTotal;

        return {
          ...pedido,
          ajustes,
          valorTotal,
          itens: mexeNoValor
            ? pedido.itens.map((i, idx) =>
                idx === 0 ? { ...i, precoUnitario: valorTotal } : i,
              )
            : pedido.itens,
          atualizadoEm: quando,
          linhaDoTempo: [
            ...pedido.linhaDoTempo,
            evento(
              "ajuste",
              decisao === "aprovado" ? "Ajuste aprovado" : "Ajuste recusado",
              observacao,
              autorId,
              {
                ocorridoEm: quando,
                valor: mexeNoValor ? valorTotal : undefined,
              },
            ),
          ],
        };
      });
    },
    [aplicar],
  );

  const registrarPagamento = useCallback<ContextoPedidos["registrarPagamento"]>(
    (pedidoId, dados, autorId) => {
      aplicar([pedidoId], (pedido) => {
        const quando = agora();
        const taxa = taxaEstimada(dados.bancoId, dados.forma, dados.valorRecebido);
        return {
          ...pedido,
          status: "pago" as StatusPedido,
          // Pago é o fim do ciclo: o custo que a inadimplência tinha gerado
          // deixa de valer.
          custos: { frete: 0, pote: 0, total: 0 },
          cobranca: {
            ...pedido.cobranca,
            formaPagamento: dados.forma,
            pagoEm: dados.data,
            valorRecebido: dados.valorRecebido,
            taxaAplicada: taxa,
            bancoId: dados.bancoId,
            proximoContatoEm: null,
            observacoes: dados.observacoes,
          },
          atualizadoEm: quando,
          linhaDoTempo: [
            ...pedido.linhaDoTempo,
            evento(
              "cobranca",
              "Pagamento recebido",
              `Recebido via ${ROTULO_FORMA[dados.forma].toLowerCase()}. Taxa estimada de ${formatBRL(taxa)}.`,
              autorId,
              {
                ocorridoEm: dados.data,
                status: "pago",
                valor: dados.valorRecebido,
              },
            ),
          ],
        };
      });
    },
    [aplicar],
  );

  const marcarInadimplente = useCallback<ContextoPedidos["marcarInadimplente"]>(
    (pedidoId, autorId) => {
      aplicar([pedidoId], (pedido) => {
        const quando = agora();
        const pote = custoPotesDoKit(pedido.itens[0]?.kitId ?? "");
        const custos = {
          frete: pedido.frete,
          pote,
          total: pedido.frete + pote,
        };
        return {
          ...pedido,
          status: "inadimplente" as StatusPedido,
          custos,
          atualizadoEm: quando,
          linhaDoTempo: [
            ...pedido.linhaDoTempo,
            evento(
              "custo",
              "Custo de frete e de pote gerado",
              `Entregue e não pago. Frete ${formatBRL(custos.frete)} e pote ${formatBRL(custos.pote)}.`,
              autorId,
              {
                ocorridoEm: quando,
                status: "inadimplente",
                valor: custos.total,
              },
            ),
          ],
        };
      });
    },
    [aplicar],
  );

  const excluir = useCallback<ContextoPedidos["excluir"]>((pedidoId) => {
    setPedidos((atual) => atual.filter((p) => p.id !== pedidoId));
  }, []);

  /* ---------------- rastreio ---------------- */

  const arquivarRastreio = useCallback<ContextoPedidos["arquivarRastreio"]>(
    (ids, arquivar) => {
      const alvo = new Set(ids);
      const quando = new Date().toISOString();
      const novos = new Map<ID, Pedido>();

      for (const pedido of pedidos) {
        if (!alvo.has(pedido.id) || !pedido.rastreio) continue;
        if (pedido.rastreio.arquivado === arquivar) continue;
        novos.set(pedido.id, {
          ...pedido,
          rastreio: {
            ...pedido.rastreio,
            arquivado: arquivar,
            // O prazo de arquivamento recomeça do zero ao desarquivar.
            arquivadoEm: arquivar ? quando : null,
          },
        });
      }

      if (novos.size > 0) {
        setPedidos((atual) => atual.map((p) => novos.get(p.id) ?? p));
      }
      return novos.size;
    },
    [pedidos],
  );

  const limparDestaque = useCallback<ContextoPedidos["limparDestaque"]>(
    (pedidoId) => {
      setPedidos((atual) =>
        atual.map((p) =>
          p.id === pedidoId && p.rastreio?.destacado
            ? { ...p, rastreio: { ...p.rastreio, destacado: false } }
            : p,
        ),
      );
    },
    [],
  );

  const redefinirDestaques = useCallback<ContextoPedidos["redefinirDestaques"]>(
    () => {
      setPedidos((atual) =>
        atual.map((p) =>
          p.rastreio?.destacado
            ? { ...p, rastreio: { ...p.rastreio, destacado: false } }
            : p,
        ),
      );
    },
    [],
  );

  const atualizarRastreios = useCallback<ContextoPedidos["atualizarRastreios"]>(
    () => {
      // O resultado é calculado antes do setPedidos para a função de
      // atualização continuar pura — em desenvolvimento o React a chama duas
      // vezes, e um acumulador dentro dela contaria em dobro.
      const novos = new Map<ID, Pedido>();
      let verificados = 0;

      for (const pedido of pedidos) {
        if (!pedido.rastreio || pedido.rastreio.arquivado) continue;
        verificados += 1;
        const { rastreio } = avancarRastreio(pedido);
        if (rastreio) novos.set(pedido.id, { ...pedido, rastreio });
      }

      // Sem novidade não mexe no estado: repintar rolaria a lista de quem
      // está lendo.
      if (novos.size > 0) {
        setPedidos((atual) => atual.map((p) => novos.get(p.id) ?? p));
      }
      return { atualizados: novos.size, verificados };
    },
    [pedidos],
  );

  const valor = useMemo<ContextoPedidos>(
    () => ({
      pedidos,
      criar,
      autorizar,
      cancelar,
      solicitarAjuste,
      decidirAjuste,
      registrarPagamento,
      marcarInadimplente,
      excluir,
      arquivarRastreio,
      limparDestaque,
      redefinirDestaques,
      atualizarRastreios,
    }),
    [
      pedidos,
      criar,
      autorizar,
      cancelar,
      solicitarAjuste,
      decidirAjuste,
      registrarPagamento,
      marcarInadimplente,
      excluir,
      arquivarRastreio,
      limparDestaque,
      redefinirDestaques,
      atualizarRastreios,
    ],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function usePedidos() {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("usePedidos precisa do PedidosProvider.");
  return ctx;
}
