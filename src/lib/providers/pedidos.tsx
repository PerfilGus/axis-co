"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AjusteValor, ID, Pedido, TipoAnexo } from "@/lib/types";
import type { DadosPagamento, EdicaoPedido, RascunhoPedido } from "@/lib/dominio/pedidos";
import * as acoes from "@/app/acoes/pedidos";
import type { DadosSensiveis } from "@/app/acoes/pedidos";
import { chamar } from "./acao";

export type { DadosPagamento, EdicaoPedido, RascunhoPedido };

/**
 * Pedidos da sessão.
 *
 * O estado começa com o que o servidor mandou ao abrir o sistema (CPF e
 * telefone já mascarados) e cada mudança passa por uma server action, que
 * confere permissão, grava e devolve os pedidos atualizados. A tela nunca
 * decide o estado final de um pedido.
 */

export interface ResultadoAutorizacao {
  autorizados: Pedido[];
  bloqueados: Array<{ pedido: Pedido; motivo: string }>;
}

export interface ArquivosPedido {
  print: File[];
  audio: File[];
}

interface ContextoPedidos {
  pedidos: Pedido[];
  criar: (rascunho: RascunhoPedido, arquivos: ArquivosPedido) => Promise<Pedido | null>;
  editar: (pedidoId: ID, edicao: EdicaoPedido) => Promise<Pedido | null>;
  anexar: (pedidoId: ID, tipo: TipoAnexo, arquivo: File) => Promise<Pedido | null>;
  autorizar: (ids: ID[]) => Promise<ResultadoAutorizacao | null>;
  cancelar: (ids: ID[], motivo: string) => Promise<number | null>;
  solicitarAjuste: (
    pedidoId: ID,
    entrada: Pick<AjusteValor, "tipo" | "valorSolicitado" | "motivo">,
  ) => Promise<boolean>;
  decidirAjuste: (
    pedidoId: ID,
    ajusteId: ID,
    decisao: "aprovado" | "recusado",
    observacao: string | null,
  ) => Promise<boolean>;
  registrarPagamento: (pedidoId: ID, dados: DadosPagamento) => Promise<boolean>;
  marcarInadimplente: (pedidoId: ID) => Promise<boolean>;
  excluir: (pedidoId: ID) => Promise<boolean>;
  /** CPF e telefone completos. Cada chamada fica registrada nas atividades. */
  revelarDados: (pedidoIds: ID[], motivo?: "detalhe" | "exportacao") => Promise<DadosSensiveis[] | null>;

  /* --- rastreio (portado do axis-tracking) --- */
  /** Arquiva ou desarquiva. É manual e reversível: nada some sozinho. */
  arquivarRastreio: (ids: ID[], arquivar: boolean) => Promise<number | null>;
  /** Tira arquivados da aba Rastreio, sem tocar no pedido. Só Admin. */
  apagarRastreio: (ids: ID[]) => Promise<number | null>;
  /** Ids dos rastreios cujo telefone completo contém os dígitos. */
  buscarPorTelefone: (termo: string) => Promise<ID[] | null>;
  /** Busca global: ids dos pedidos do escopo cujo telefone ou CPF completo contém os dígitos. */
  buscarPorDocumento: (termo: string) => Promise<ID[] | null>;
  /** Relê do banco pedidos que outra pessoa mudou; tira da lista os excluídos. */
  recarregar: (ids: ID[]) => Promise<void>;
  /** Abrir o pedido consome o destaque daquele rastreio. */
  limparDestaque: (pedidoId: ID) => void;
  /** Zera o destaque de todos de uma vez, sem abrir um por um. */
  redefinirDestaques: () => void;
  /** Consulta os Correios; devolve quantos mudaram e se a integração respondeu. */
  atualizarRastreios: () => Promise<{ atualizados: number; verificados: number; integrado: boolean } | null>;
}

const Contexto = createContext<ContextoPedidos | null>(null);

function mesclar(atual: Pedido[], novos: Pedido[]): Pedido[] {
  const porId = new Map(novos.map((p) => [p.id, p]));
  const existentes = new Set(atual.map((p) => p.id));
  return [
    ...novos.filter((p) => !existentes.has(p.id)),
    ...atual.map((p) => porId.get(p.id) ?? p),
  ];
}

export function PedidosProvider({ inicial, children }: { inicial: Pedido[]; children: ReactNode }) {
  const [pedidos, setPedidos] = useState<Pedido[]>(inicial);

  const aplicar = useCallback((novos: Pedido[] | null) => {
    if (novos && novos.length > 0) setPedidos((atual) => mesclar(atual, novos));
    return novos;
  }, []);

  const criar = useCallback<ContextoPedidos["criar"]>(
    async (rascunho, arquivos) => {
      const formulario = new FormData();
      formulario.set("dados", JSON.stringify(rascunho));
      for (const f of arquivos.print) formulario.append("print_confirmacao", f);
      for (const f of arquivos.audio) formulario.append("audio_confirmacao", f);
      const pedido = await chamar(acoes.criarPedido(formulario));
      if (pedido) aplicar([pedido]);
      return pedido;
    },
    [aplicar],
  );

  const editar = useCallback<ContextoPedidos["editar"]>(
    async (pedidoId, edicao) => {
      const pedido = await chamar(acoes.editarPedido(pedidoId, edicao));
      if (pedido) aplicar([pedido]);
      return pedido;
    },
    [aplicar],
  );

  const anexar = useCallback<ContextoPedidos["anexar"]>(
    async (pedidoId, tipo, arquivo) => {
      const formulario = new FormData();
      formulario.set("pedidoId", pedidoId);
      formulario.set("tipo", tipo);
      formulario.set("arquivo", arquivo);
      const pedido = await chamar(acoes.anexarAoPedido(formulario));
      if (pedido) aplicar([pedido]);
      return pedido;
    },
    [aplicar],
  );

  const autorizar = useCallback<ContextoPedidos["autorizar"]>(
    async (ids) => {
      const resultado = await chamar(acoes.autorizarPedidos(ids));
      if (!resultado) return null;
      aplicar(resultado.autorizados);
      return {
        autorizados: resultado.autorizados,
        bloqueados: resultado.bloqueados.flatMap((b) => {
          const pedido = pedidos.find((p) => p.id === b.pedidoId);
          return pedido ? [{ pedido, motivo: b.motivo }] : [];
        }),
      };
    },
    [aplicar, pedidos],
  );

  const cancelar = useCallback<ContextoPedidos["cancelar"]>(
    async (ids, motivo) => {
      const cancelados = aplicar(await chamar(acoes.cancelarPedidos(ids, motivo)));
      return cancelados ? cancelados.length : null;
    },
    [aplicar],
  );

  const solicitarAjuste = useCallback<ContextoPedidos["solicitarAjuste"]>(
    async (pedidoId, entrada) => {
      const pedido = await chamar(acoes.solicitarAjuste(pedidoId, entrada));
      if (pedido) aplicar([pedido]);
      return pedido !== null;
    },
    [aplicar],
  );

  const decidirAjuste = useCallback<ContextoPedidos["decidirAjuste"]>(
    async (pedidoId, ajusteId, decisao, observacao) => {
      const pedido = await chamar(acoes.decidirAjuste(pedidoId, ajusteId, decisao, observacao));
      if (pedido) aplicar([pedido]);
      return pedido !== null;
    },
    [aplicar],
  );

  const registrarPagamento = useCallback<ContextoPedidos["registrarPagamento"]>(
    async (pedidoId, dados) => {
      const pedido = await chamar(acoes.registrarPagamento(pedidoId, dados));
      if (pedido) aplicar([pedido]);
      return pedido !== null;
    },
    [aplicar],
  );

  const marcarInadimplente = useCallback<ContextoPedidos["marcarInadimplente"]>(
    async (pedidoId) => {
      const pedido = await chamar(acoes.marcarInadimplente(pedidoId));
      if (pedido) aplicar([pedido]);
      return pedido !== null;
    },
    [aplicar],
  );

  const excluir = useCallback<ContextoPedidos["excluir"]>(async (pedidoId) => {
    const id = await chamar(acoes.excluirPedido(pedidoId));
    if (id) setPedidos((atual) => atual.filter((p) => p.id !== id));
    return id !== null;
  }, []);

  const revelarDados = useCallback<ContextoPedidos["revelarDados"]>(
    (pedidoIds, motivo = "detalhe") => chamar(acoes.revelarDadosCliente(pedidoIds, motivo)),
    [],
  );

  /* ---------------- rastreio ---------------- */

  const arquivarRastreio = useCallback<ContextoPedidos["arquivarRastreio"]>(
    async (ids, arquivar) => {
      const mudados = aplicar(await chamar(acoes.arquivarRastreios(ids, arquivar)));
      return mudados ? mudados.length : null;
    },
    [aplicar],
  );

  const apagarRastreio = useCallback<ContextoPedidos["apagarRastreio"]>(
    async (ids) => {
      const apagados = aplicar(await chamar(acoes.apagarRastreios(ids)));
      return apagados ? apagados.length : null;
    },
    [aplicar],
  );

  const buscarPorTelefone = useCallback<ContextoPedidos["buscarPorTelefone"]>(
    (termo) => chamar(acoes.buscarRastreiosPorTelefone(termo)),
    [],
  );

  const recarregar = useCallback<ContextoPedidos["recarregar"]>(async (ids) => {
    if (ids.length === 0) return;
    const lidos = await chamar(acoes.relerPedidos(ids));
    if (!lidos) return;
    const existentes = new Set(lidos.map((p) => p.id));
    setPedidos((atual) =>
      mesclar(
        atual.filter((p) => !ids.includes(p.id) || existentes.has(p.id)),
        lidos,
      ),
    );
  }, []);

  const buscarPorDocumento = useCallback<ContextoPedidos["buscarPorDocumento"]>(
    (termo) => chamar(acoes.buscarPedidosPorDocumento(termo)),
    [],
  );

  /** Tira o destaque na hora e grava em segundo plano: é só uma marca de leitura. */
  const tirarDestaque = useCallback((ids: ID[] | null) => {
    setPedidos((atual) =>
      atual.map((p) =>
        p.rastreio?.destacado && (ids === null || ids.includes(p.id))
          ? { ...p, rastreio: { ...p.rastreio, destacado: false } }
          : p,
      ),
    );
    void chamar(acoes.limparDestaques(ids));
  }, []);

  const limparDestaque = useCallback((pedidoId: ID) => tirarDestaque([pedidoId]), [tirarDestaque]);
  const redefinirDestaques = useCallback(() => tirarDestaque(null), [tirarDestaque]);

  const atualizarRastreios = useCallback<ContextoPedidos["atualizarRastreios"]>(
    () => chamar(acoes.atualizarRastreios()),
    [],
  );

  const valor = useMemo<ContextoPedidos>(
    () => ({
      pedidos,
      criar,
      editar,
      anexar,
      autorizar,
      cancelar,
      solicitarAjuste,
      decidirAjuste,
      registrarPagamento,
      marcarInadimplente,
      excluir,
      revelarDados,
      arquivarRastreio,
      apagarRastreio,
      buscarPorTelefone,
      buscarPorDocumento,
      recarregar,
      limparDestaque,
      redefinirDestaques,
      atualizarRastreios,
    }),
    [
      pedidos,
      criar,
      editar,
      anexar,
      autorizar,
      cancelar,
      solicitarAjuste,
      decidirAjuste,
      registrarPagamento,
      marcarInadimplente,
      excluir,
      revelarDados,
      arquivarRastreio,
      apagarRastreio,
      buscarPorTelefone,
      buscarPorDocumento,
      recarregar,
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
