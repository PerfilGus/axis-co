"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Centavos, DataISO, DespesaFixa, FaturaFornecedor, ID } from "@/lib/types";
import type { DadosFinanceiro } from "@/lib/servidor/dados";
import * as acoes from "@/app/acoes/financeiro";
import type { EntradaDivida } from "@/app/acoes/financeiro";
import type { Entrada } from "./cadastros";
import { chamar } from "./acao";

export type { EntradaDivida };

/**
 * Financeiro: fornecedor, alíquotas do Simples, despesas fixas e dívidas.
 *
 * Guarda só o que é lançado à mão — previsto, DRE e previsão são recalculados
 * dos pedidos em `lib/fornecedor.ts` e `lib/resultado.ts`. Só o Admin recebe
 * estes dados; para os demais perfis o estado nasce vazio.
 */

interface ContextoFinanceiro extends DadosFinanceiro {
  salvarParametros: (entrada: { fornecedor: string; custoPote: Centavos; freteEnvio: Centavos }) => Promise<boolean>;
  lancarPagamentoFornecedor: (
    entrada: { pagoEm: DataISO; valor: Centavos; observacoes: string | null },
    comprovante: File | null,
  ) => Promise<boolean>;
  excluirPagamentoFornecedor: (id: ID) => Promise<boolean>;
  salvarFatura: (entrada: Entrada<FaturaFornecedor, "lancadaEm">) => Promise<boolean>;
  excluirFatura: (id: ID) => Promise<boolean>;
  /** Lança ou corrige a alíquota de uma competência; `null` volta a estimar. */
  definirAliquota: (competencia: string, aliquotaBps: number | null) => Promise<boolean>;
  salvarDespesa: (entrada: Entrada<DespesaFixa>) => Promise<boolean>;
  excluirDespesa: (id: ID) => Promise<boolean>;
  criarDivida: (entrada: EntradaDivida) => Promise<boolean>;
  /** Marca ou desmarca uma parcela como paga. */
  alternarParcela: (dividaId: ID, numero: number, pagaEm: DataISO | null) => Promise<boolean>;
  excluirDivida: (id: ID) => Promise<boolean>;
}

const Contexto = createContext<ContextoFinanceiro | null>(null);

export function FinanceiroProvider({ inicial, children }: { inicial: DadosFinanceiro; children: ReactNode }) {
  const [dados, setDados] = useState(inicial);

  const receber = useCallback(
    async (promessa: Promise<{ ok: true; dados: DadosFinanceiro } | { ok: false; erro: string }>) => {
      const novo = await chamar(promessa);
      if (novo) setDados(novo);
      return novo !== null;
    },
    [],
  );

  const salvarParametros = useCallback<ContextoFinanceiro["salvarParametros"]>((e) => receber(acoes.salvarParametros(e)), [receber]);
  const lancarPagamentoFornecedor = useCallback<ContextoFinanceiro["lancarPagamentoFornecedor"]>(
    (entrada, comprovante) => {
      const formulario = new FormData();
      formulario.set("dados", JSON.stringify({ ...entrada, observacoes: entrada.observacoes ?? "" }));
      if (comprovante) formulario.set("comprovante", comprovante);
      return receber(acoes.lancarPagamentoFornecedor(formulario));
    },
    [receber],
  );
  const excluirPagamentoFornecedor = useCallback((id: ID) => receber(acoes.excluirPagamentoFornecedor(id)), [receber]);
  const salvarFatura = useCallback<ContextoFinanceiro["salvarFatura"]>((e) => receber(acoes.salvarFatura(e)), [receber]);
  const excluirFatura = useCallback((id: ID) => receber(acoes.excluirFatura(id)), [receber]);
  const definirAliquota = useCallback<ContextoFinanceiro["definirAliquota"]>(
    (competencia, bps) => receber(acoes.definirAliquota(competencia, bps)),
    [receber],
  );
  const salvarDespesa = useCallback<ContextoFinanceiro["salvarDespesa"]>((e) => receber(acoes.salvarDespesa(e)), [receber]);
  const excluirDespesa = useCallback((id: ID) => receber(acoes.excluirDespesa(id)), [receber]);
  const criarDivida = useCallback<ContextoFinanceiro["criarDivida"]>((e) => receber(acoes.criarDivida(e)), [receber]);
  const alternarParcela = useCallback<ContextoFinanceiro["alternarParcela"]>(
    (dividaId, numero, pagaEm) => receber(acoes.alternarParcela(dividaId, numero, pagaEm)),
    [receber],
  );
  const excluirDivida = useCallback((id: ID) => receber(acoes.excluirDivida(id)), [receber]);

  const valor = useMemo<ContextoFinanceiro>(
    () => ({
      ...dados,
      salvarParametros,
      lancarPagamentoFornecedor,
      excluirPagamentoFornecedor,
      salvarFatura,
      excluirFatura,
      definirAliquota,
      salvarDespesa,
      excluirDespesa,
      criarDivida,
      alternarParcela,
      excluirDivida,
    }),
    [
      dados,
      salvarParametros,
      lancarPagamentoFornecedor,
      excluirPagamentoFornecedor,
      salvarFatura,
      excluirFatura,
      definirAliquota,
      salvarDespesa,
      excluirDespesa,
      criarDivida,
      alternarParcela,
      excluirDivida,
    ],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useFinanceiro() {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("useFinanceiro precisa do FinanceiroProvider.");
  return ctx;
}
