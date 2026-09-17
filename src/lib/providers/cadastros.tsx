"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { BancoPlataforma, Criativo, ID, Kit, LinhaWhatsApp, Produto } from "@/lib/types";
import type { DadosCadastros } from "@/lib/servidor/dados";
import * as acoes from "@/app/acoes/cadastros";
import { chamar } from "./acao";

/**
 * Cadastros de Configurações: produtos e kits, criativos e linhas, bancos e
 * plataformas. Cada `salvar` é o upsert do servidor — sem id cria, com id
 * substitui — e o estado é trocado pelo que o banco devolveu.
 */

/** Dados de entrada de um cadastro: o registro sem os campos de sistema. */
export type Entrada<T extends { id: ID }, Sistema extends keyof T = never> = Omit<
  T,
  "id" | Sistema
> & { id?: ID };

interface ContextoCadastros extends DadosCadastros {
  salvarProduto: (entrada: Entrada<Produto, "criadoEm">) => Promise<Produto | null>;
  salvarKit: (entrada: Entrada<Kit, "criadoEm">) => Promise<Kit | null>;
  salvarLinha: (entrada: Entrada<LinhaWhatsApp, "criadaEm">) => Promise<LinhaWhatsApp | null>;
  salvarCriativo: (entrada: Entrada<Criativo, "criadoEm">) => Promise<Criativo | null>;
  salvarBanco: (
    entrada: Entrada<BancoPlataforma, "atualizadoEm" | "fonte" | "saldo">,
  ) => Promise<BancoPlataforma | null>;
  /** Liga ou desliga sem abrir o formulário. */
  alternarAtivo: (
    tipo: "produto" | "kit" | "linha" | "criativo" | "banco",
    id: ID,
  ) => Promise<boolean>;
}

const Contexto = createContext<ContextoCadastros | null>(null);

export function CadastrosProvider({ inicial, children }: { inicial: DadosCadastros; children: ReactNode }) {
  const [dados, setDados] = useState(inicial);

  /** Troca os cadastros pelo que voltou e devolve o registro salvo. */
  const receber = useCallback(
    async <T,>(promessa: Promise<{ ok: true; dados: { cadastros: DadosCadastros; extra: T } } | { ok: false; erro: string }>) => {
      const resposta = await chamar(promessa);
      if (!resposta) return null;
      setDados(resposta.cadastros);
      return resposta.extra;
    },
    [],
  );

  const salvarProduto = useCallback<ContextoCadastros["salvarProduto"]>((e) => receber(acoes.salvarProduto(e)), [receber]);
  const salvarKit = useCallback<ContextoCadastros["salvarKit"]>((e) => receber(acoes.salvarKit(e)), [receber]);
  const salvarLinha = useCallback<ContextoCadastros["salvarLinha"]>((e) => receber(acoes.salvarLinha(e)), [receber]);
  const salvarCriativo = useCallback<ContextoCadastros["salvarCriativo"]>((e) => receber(acoes.salvarCriativo(e)), [receber]);
  const salvarBanco = useCallback<ContextoCadastros["salvarBanco"]>((e) => receber(acoes.salvarBanco(e)), [receber]);
  const alternarAtivo = useCallback<ContextoCadastros["alternarAtivo"]>(async (tipo, id) => {
    const resposta = await chamar(acoes.alternarAtivo(tipo, id));
    if (resposta) setDados(resposta.cadastros);
    return resposta !== null;
  }, []);

  const valor = useMemo<ContextoCadastros>(
    () => ({
      ...dados,
      salvarProduto,
      salvarKit,
      salvarLinha,
      salvarCriativo,
      salvarBanco,
      alternarAtivo,
    }),
    [dados, salvarProduto, salvarKit, salvarLinha, salvarCriativo, salvarBanco, alternarAtivo],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useCadastros() {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("useCadastros precisa do CadastrosProvider.");
  return ctx;
}
