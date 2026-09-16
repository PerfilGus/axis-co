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
  AliquotaMensal,
  Centavos,
  DataISO,
  DespesaFixa,
  Divida,
  FaturaFornecedor,
  ID,
  PagamentoFornecedor,
  ParametrosFornecedor,
} from "@/lib/types";
import { ALIQUOTAS, DESPESAS_FIXAS, DIVIDAS } from "@/lib/mock/financeiro";
import {
  FATURAS_FORNECEDOR,
  PAGAMENTOS_FORNECEDOR,
  PARAMETROS_FORNECEDOR,
} from "@/lib/mock/fornecedor";
import type { Entrada } from "./cadastros";

/**
 * Financeiro: fornecedor, alíquotas do Simples, despesas fixas e dívidas.
 *
 * Nada é persistido: recarregar volta ao mock. Guarda só o que é lançado à
 * mão — previsto, DRE e previsão são recalculados dos pedidos em
 * `lib/fornecedor.ts` e `lib/resultado.ts`.
 */

let sequencia = 7000;
function novoId(prefixo: string): string {
  sequencia += 1;
  return `${prefixo}_${sequencia}`;
}

function agora(): DataISO {
  return new Date().toISOString();
}

function upsert<T extends { id: ID }>(lista: T[], item: T): T[] {
  return lista.some((x) => x.id === item.id)
    ? lista.map((x) => (x.id === item.id ? item : x))
    : [...lista, item];
}

export interface EntradaDivida {
  credor: string;
  descricao: string;
  valorOriginal: Centavos;
  jurosBps: number;
  quantidadeParcelas: number;
  valorParcela: Centavos;
  primeiroVencimento: DataISO;
}

interface ContextoFinanceiro {
  parametros: ParametrosFornecedor;
  pagamentosFornecedor: PagamentoFornecedor[];
  faturas: FaturaFornecedor[];
  aliquotas: AliquotaMensal[];
  despesas: DespesaFixa[];
  dividas: Divida[];

  salvarParametros: (entrada: Omit<ParametrosFornecedor, "atualizadoEm">) => void;
  lancarPagamentoFornecedor: (
    entrada: Omit<PagamentoFornecedor, "id" | "lancadoEm">,
  ) => PagamentoFornecedor;
  excluirPagamentoFornecedor: (id: ID) => void;
  salvarFatura: (entrada: Entrada<FaturaFornecedor, "lancadaEm">) => FaturaFornecedor;
  excluirFatura: (id: ID) => void;
  /** Lança ou corrige a alíquota de uma competência; `null` volta a estimar. */
  definirAliquota: (competencia: string, aliquotaBps: number | null) => void;
  salvarDespesa: (entrada: Entrada<DespesaFixa>) => DespesaFixa;
  excluirDespesa: (id: ID) => void;
  criarDivida: (entrada: EntradaDivida) => Divida;
  /** Marca ou desmarca uma parcela como paga. */
  alternarParcela: (dividaId: ID, numero: number, pagaEm: DataISO | null) => void;
  excluirDivida: (id: ID) => void;
}

const Contexto = createContext<ContextoFinanceiro | null>(null);

export function FinanceiroProvider({ children }: { children: ReactNode }) {
  const [parametros, setParametros] = useState(PARAMETROS_FORNECEDOR);
  const [pagamentosFornecedor, setPagamentosFornecedor] = useState(PAGAMENTOS_FORNECEDOR);
  const [faturas, setFaturas] = useState(FATURAS_FORNECEDOR);
  const [aliquotas, setAliquotas] = useState(ALIQUOTAS);
  const [despesas, setDespesas] = useState(DESPESAS_FIXAS);
  const [dividas, setDividas] = useState(DIVIDAS);

  const salvarParametros = useCallback<ContextoFinanceiro["salvarParametros"]>((entrada) => {
    setParametros({ ...entrada, atualizadoEm: agora() });
  }, []);

  const lancarPagamentoFornecedor = useCallback<ContextoFinanceiro["lancarPagamentoFornecedor"]>(
    (entrada) => {
      const pagamento: PagamentoFornecedor = { ...entrada, id: novoId("pfor"), lancadoEm: agora() };
      setPagamentosFornecedor((atual) => [...atual, pagamento]);
      return pagamento;
    },
    [],
  );

  const excluirPagamentoFornecedor = useCallback((id: ID) => {
    setPagamentosFornecedor((atual) => atual.filter((p) => p.id !== id));
  }, []);

  const salvarFatura = useCallback<ContextoFinanceiro["salvarFatura"]>(
    (entrada) => {
      const existente = entrada.id ? faturas.find((f) => f.id === entrada.id) : null;
      const fatura: FaturaFornecedor = {
        ...entrada,
        id: existente?.id ?? novoId("fat"),
        lancadaEm: existente?.lancadaEm ?? agora(),
      };
      setFaturas((atual) => upsert(atual, fatura));
      return fatura;
    },
    [faturas],
  );

  const excluirFatura = useCallback((id: ID) => {
    setFaturas((atual) => atual.filter((f) => f.id !== id));
  }, []);

  const definirAliquota = useCallback<ContextoFinanceiro["definirAliquota"]>(
    (competencia, aliquotaBps) => {
      const lancadaEm = agora();
      setAliquotas((atual) => {
        const outras = atual.filter((a) => a.competencia !== competencia);
        return aliquotaBps === null ? outras : [...outras, { competencia, aliquotaBps, lancadaEm }];
      });
    },
    [],
  );

  const salvarDespesa = useCallback<ContextoFinanceiro["salvarDespesa"]>((entrada) => {
    const despesa: DespesaFixa = { ...entrada, id: entrada.id ?? novoId("dsp") };
    setDespesas((atual) => upsert(atual, despesa));
    return despesa;
  }, []);

  const excluirDespesa = useCallback((id: ID) => {
    setDespesas((atual) => atual.filter((d) => d.id !== id));
  }, []);

  const criarDivida = useCallback<ContextoFinanceiro["criarDivida"]>((entrada) => {
    const inicio = new Date(entrada.primeiroVencimento);
    const divida: Divida = {
      id: novoId("div"),
      credor: entrada.credor,
      descricao: entrada.descricao,
      valorOriginal: entrada.valorOriginal,
      jurosBps: entrada.jurosBps,
      contratadaEm: agora(),
      parcelas: Array.from({ length: entrada.quantidadeParcelas }, (_, i) => {
        const vence = new Date(inicio.getTime());
        vence.setUTCMonth(vence.getUTCMonth() + i);
        return { numero: i + 1, valor: entrada.valorParcela, venceEm: vence.toISOString(), pagaEm: null };
      }),
    };
    setDividas((atual) => [...atual, divida]);
    return divida;
  }, []);

  const alternarParcela = useCallback<ContextoFinanceiro["alternarParcela"]>(
    (dividaId, numero, pagaEm) => {
      setDividas((atual) =>
        atual.map((d) =>
          d.id === dividaId
            ? { ...d, parcelas: d.parcelas.map((p) => (p.numero === numero ? { ...p, pagaEm } : p)) }
            : d,
        ),
      );
    },
    [],
  );

  const excluirDivida = useCallback((id: ID) => {
    setDividas((atual) => atual.filter((d) => d.id !== id));
  }, []);

  const valor = useMemo<ContextoFinanceiro>(
    () => ({
      parametros,
      pagamentosFornecedor,
      faturas,
      aliquotas,
      despesas,
      dividas,
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
      parametros,
      pagamentosFornecedor,
      faturas,
      aliquotas,
      despesas,
      dividas,
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
