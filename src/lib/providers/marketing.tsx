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
import { DIAS_META_ADS_MANUAIS, LANCAMENTOS_META_ADS } from "@/lib/mock/marketing";

/**
 * Meta Ads da sessão: o detalhe por criativo que a API traria e os totais
 * lançados à mão. Nada é persistido.
 */

let sequencia = 3000;

interface ContextoMarketing {
  /** Detalhe por criativo, vindo da API. Só leitura: a sincronização não é real. */
  lancamentos: LancamentoMetaAds[];
  diasManuais: DiaMetaAds[];
  /** Dias que a API já trouxe: esses não aceitam lançamento manual. */
  diasComApi: Set<string>;
  /** Lança ou corrige o total de um dia. Recusa dia que já veio da API. */
  lancarDia: (data: string, investimento: Centavos, leads: number) => DiaMetaAds | null;
  excluirDia: (data: string) => void;
}

const Contexto = createContext<ContextoMarketing | null>(null);

export function MarketingProvider({ children }: { children: ReactNode }) {
  const [lancamentos] = useState(LANCAMENTOS_META_ADS);
  const [diasManuais, setDiasManuais] = useState(DIAS_META_ADS_MANUAIS);
  const diasComApi = useMemo(() => new Set(lancamentos.map((l) => l.data)), [lancamentos]);

  const lancarDia = useCallback<ContextoMarketing["lancarDia"]>(
    (data, investimento, leads) => {
      if (diasComApi.has(data)) return null;
      const existente = diasManuais.find((d) => d.data === data);
      sequencia += 1;
      const dia: DiaMetaAds = {
        id: existente?.id ?? `mdia_${sequencia}`,
        data,
        investimento,
        leads,
        fonte: "manual",
        lancadoEm: new Date().toISOString(),
      };
      setDiasManuais((atual) => [...atual.filter((d) => d.data !== data), dia]);
      return dia;
    },
    [diasComApi, diasManuais],
  );

  const excluirDia = useCallback((data: string) => {
    setDiasManuais((atual) => atual.filter((d) => d.data !== data));
  }, []);

  const valor = useMemo<ContextoMarketing>(
    () => ({ lancamentos, diasManuais, diasComApi, lancarDia, excluirDia }),
    [lancamentos, diasManuais, diasComApi, lancarDia, excluirDia],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useMarketing() {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("useMarketing precisa do MarketingProvider.");
  return ctx;
}
