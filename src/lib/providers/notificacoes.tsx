"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ID } from "@/lib/types";
import type { EstadoNotificacoes, Notificacao, PreferenciaNotificacao } from "@/lib/notificacoes";
import * as acoes from "@/app/acoes/notificacoes";
import { chamar } from "./acao";
import { usePedidos } from "./pedidos";

/**
 * Notificações da sessão.
 *
 * Atualização: consulta leve a cada minuto, só com a aba visível, e na hora em
 * que o app volta ao primeiro plano (ou quando o service worker avisa que chegou
 * um push). Sem conexão aberta: na Vercel, uma conexão SSE parada cobra memória
 * o tempo todo e ainda precisaria consultar o banco do mesmo jeito.
 */

const INTERVALO_MS = 60_000;

interface ContextoNotificacoes {
  itens: Notificacao[];
  preferencias: PreferenciaNotificacao[];
  naoLidas: number;
  atualizar: () => Promise<void>;
  marcarLidas: (ids: ID[]) => void;
  marcarTodas: () => Promise<boolean>;
  salvarPreferencia: (preferencia: PreferenciaNotificacao) => Promise<boolean>;
}

const Contexto = createContext<ContextoNotificacoes | null>(null);

export function NotificacoesProvider({
  inicial,
  children,
}: {
  inicial: EstadoNotificacoes;
  children: ReactNode;
}) {
  const [estado, setEstado] = useState(inicial);
  const { recarregar } = usePedidos();
  const conhecidas = useRef(new Set(inicial.itens.map((n) => n.id)));

  /**
   * Troca o estado pelo que veio do servidor. Pedidos citados em notificação
   * nova mudaram por mão de outra pessoa: são relidos para a lista não mentir.
   */
  const receber = useCallback(
    (novo: EstadoNotificacoes) => {
      const pedidos = new Set<ID>();
      for (const n of novo.itens) {
        if (conhecidas.current.has(n.id)) continue;
        conhecidas.current.add(n.id);
        if (n.pedidoId) pedidos.add(n.pedidoId);
      }
      setEstado(novo);
      if (pedidos.size > 0) void recarregar([...pedidos]);
    },
    [recarregar],
  );

  const atualizar = useCallback(async () => {
    try {
      const resposta = await fetch("/api/notificacoes", { cache: "no-store" });
      if (resposta.ok) receber((await resposta.json()) as EstadoNotificacoes);
    } catch {
      // Sem rede: tenta de novo no próximo ciclo, sem incomodar ninguém.
    }
  }, [receber]);

  useEffect(() => {
    let ciclo: number | undefined;
    const ligar = () => {
      window.clearInterval(ciclo);
      if (document.visibilityState !== "visible") return;
      ciclo = window.setInterval(atualizar, INTERVALO_MS);
    };
    const aoMudarVisibilidade = () => {
      if (document.visibilityState === "visible") void atualizar();
      ligar();
    };
    // O service worker avisa quando um push chega com o app aberto.
    const aoReceberMensagem = (e: MessageEvent) => {
      if (e.data?.tipo === "axis-notificacao") void atualizar();
    };
    ligar();
    document.addEventListener("visibilitychange", aoMudarVisibilidade);
    navigator.serviceWorker?.addEventListener("message", aoReceberMensagem);
    return () => {
      window.clearInterval(ciclo);
      document.removeEventListener("visibilitychange", aoMudarVisibilidade);
      navigator.serviceWorker?.removeEventListener("message", aoReceberMensagem);
    };
  }, [atualizar]);

  /** Marca na hora e grava em segundo plano: é só uma marca de leitura. */
  const marcarLidas = useCallback<ContextoNotificacoes["marcarLidas"]>(
    (ids) => {
      const pendentes = new Set(ids);
      setEstado((atual) => ({
        ...atual,
        itens: atual.itens.map((n) => (pendentes.has(n.id) ? { ...n, lida: true } : n)),
      }));
      void chamar(acoes.marcarNotificacoesLidas(ids)).then((novo) => novo && receber(novo));
    },
    [receber],
  );

  const marcarTodas = useCallback<ContextoNotificacoes["marcarTodas"]>(async () => {
    const maisNova = estado.itens.reduce<string | null>(
      (max, n) => (!max || new Date(n.registradoEm) > new Date(max) ? n.registradoEm : max),
      null,
    );
    if (!maisNova) return true;
    const novo = await chamar(acoes.marcarTodasLidas(maisNova));
    if (!novo) return false;
    receber(novo);
    return true;
  }, [estado.itens, receber]);

  const salvarPreferencia = useCallback<ContextoNotificacoes["salvarPreferencia"]>(
    async (preferencia) => {
      const novo = await chamar(acoes.salvarPreferenciaNotificacao(preferencia));
      if (!novo) return false;
      receber(novo);
      return true;
    },
    [receber],
  );

  const valor = useMemo<ContextoNotificacoes>(
    () => ({
      itens: estado.itens,
      preferencias: estado.preferencias,
      naoLidas: estado.itens.filter((n) => !n.lida).length,
      atualizar,
      marcarLidas,
      marcarTodas,
      salvarPreferencia,
    }),
    [estado, atualizar, marcarLidas, marcarTodas, salvarPreferencia],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useNotificacoes() {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("useNotificacoes precisa do NotificacoesProvider.");
  return ctx;
}
