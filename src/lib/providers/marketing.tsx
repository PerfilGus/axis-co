"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Centavos, DiaMetaAds, LancamentoMetaAds } from "@/lib/types";
import type { DadosMarketing } from "@/lib/servidor/dados";
import * as acoes from "@/app/acoes/financeiro";
import { chamar } from "./acao";

/**
 * Meta Ads: o detalhe por criativo que a API traz e os totais lançados à mão.
 * A sincronização com a API ainda não existe: `lancamentos` chega vazio até a
 * integração entrar.
 */

interface ContextoMarketing {
  /** Detalhe por criativo, vindo da API. Só leitura. */
  lancamentos: LancamentoMetaAds[];
  diasManuais: DiaMetaAds[];
  /** Dias que a API já trouxe: esses não aceitam lançamento manual. */
  diasComApi: Set<string>;
  /** Lança ou corrige o total de um dia. O servidor recusa dia que veio da API. */
  lancarDia: (data: string, investimento: Centavos, leads: number) => Promise<boolean>;
  excluirDia: (data: string) => Promise<boolean>;
}

const Contexto = createContext<ContextoMarketing | null>(null);

export function MarketingProvider({ inicial, children }: { inicial: DadosMarketing; children: ReactNode }) {
  const [dados, setDados] = useState(inicial);
  const diasComApi = useMemo(() => new Set(dados.lancamentos.map((l) => l.data)), [dados.lancamentos]);

  const receber = useCallback(
    async (promessa: Promise<{ ok: true; dados: DadosMarketing } | { ok: false; erro: string }>) => {
      const novo = await chamar(promessa);
      if (novo) setDados(novo);
      return novo !== null;
    },
    [],
  );

  const lancarDia = useCallback<ContextoMarketing["lancarDia"]>(
    (data, investimento, leads) => receber(acoes.lancarDiaMetaAds(data, investimento, leads)),
    [receber],
  );
  const excluirDia = useCallback((data: string) => receber(acoes.excluirDiaMetaAds(data)), [receber]);

  const valor = useMemo<ContextoMarketing>(
    () => ({ ...dados, diasComApi, lancarDia, excluirDia }),
    [dados, diasComApi, lancarDia, excluirDia],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useMarketing() {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("useMarketing precisa do MarketingProvider.");
  return ctx;
}
