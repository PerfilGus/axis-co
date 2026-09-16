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
  BancoPlataforma,
  Criativo,
  ID,
  Kit,
  LinhaWhatsApp,
  Produto,
} from "@/lib/types";
import { PRODUTOS, KITS } from "@/lib/mock/catalogo";
import { CRIATIVOS, LINHAS_WHATSAPP } from "@/lib/mock/marketing";
import { BANCOS_PLATAFORMAS } from "@/lib/mock/financeiro";

/**
 * Cadastros de Configurações: produtos e kits, criativos e linhas, bancos e
 * plataformas.
 *
 * Nada é persistido: recarregar volta ao mock. Cada `salvar` é o upsert que o
 * backend expõe depois — sem id cria, com id substitui.
 */

let sequencia = 5000;
function novoId(prefixo: string): string {
  sequencia += 1;
  return `${prefixo}_${sequencia}`;
}

function agora(): string {
  return new Date().toISOString();
}

/** Dados de entrada de um cadastro: o registro sem os campos de sistema. */
export type Entrada<T extends { id: ID }, Sistema extends keyof T = never> = Omit<
  T,
  "id" | Sistema
> & { id?: ID };

interface ContextoCadastros {
  produtos: Produto[];
  kits: Kit[];
  linhas: LinhaWhatsApp[];
  criativos: Criativo[];
  bancos: BancoPlataforma[];

  salvarProduto: (entrada: Entrada<Produto, "criadoEm">) => Produto;
  salvarKit: (entrada: Entrada<Kit, "criadoEm">) => Kit;
  salvarLinha: (entrada: Entrada<LinhaWhatsApp, "criadaEm">) => LinhaWhatsApp;
  salvarCriativo: (entrada: Entrada<Criativo, "criadoEm">) => Criativo;
  salvarBanco: (
    entrada: Entrada<BancoPlataforma, "atualizadoEm" | "fonte" | "saldo">,
  ) => BancoPlataforma;
  /** Liga ou desliga sem abrir o formulário. */
  alternarAtivo: (
    tipo: "produto" | "kit" | "linha" | "criativo" | "banco",
    id: ID,
  ) => void;
}

const Contexto = createContext<ContextoCadastros | null>(null);

/** Substitui pelo id ou acrescenta no fim. */
function upsert<T extends { id: ID }>(lista: T[], item: T): T[] {
  return lista.some((x) => x.id === item.id)
    ? lista.map((x) => (x.id === item.id ? item : x))
    : [...lista, item];
}

export function CadastrosProvider({ children }: { children: ReactNode }) {
  const [produtos, setProdutos] = useState(PRODUTOS);
  const [kits, setKits] = useState(KITS);
  const [linhas, setLinhas] = useState(LINHAS_WHATSAPP);
  const [criativos, setCriativos] = useState(CRIATIVOS);
  const [bancos, setBancos] = useState(BANCOS_PLATAFORMAS);

  const salvarProduto = useCallback<ContextoCadastros["salvarProduto"]>(
    (entrada) => {
      const existente = entrada.id ? produtos.find((p) => p.id === entrada.id) : null;
      const produto: Produto = {
        ...entrada,
        id: existente?.id ?? novoId("prod"),
        criadoEm: existente?.criadoEm ?? agora(),
      };
      setProdutos((atual) => upsert(atual, produto));
      return produto;
    },
    [produtos],
  );

  const salvarKit = useCallback<ContextoCadastros["salvarKit"]>(
    (entrada) => {
      const existente = entrada.id ? kits.find((k) => k.id === entrada.id) : null;
      const kit: Kit = {
        ...entrada,
        id: existente?.id ?? novoId("kit"),
        criadoEm: existente?.criadoEm ?? agora(),
      };
      setKits((atual) => upsert(atual, kit));
      return kit;
    },
    [kits],
  );

  const salvarLinha = useCallback<ContextoCadastros["salvarLinha"]>(
    (entrada) => {
      const existente = entrada.id ? linhas.find((l) => l.id === entrada.id) : null;
      const linha: LinhaWhatsApp = {
        ...entrada,
        id: existente?.id ?? novoId("lin"),
        criadaEm: existente?.criadaEm ?? agora(),
      };
      setLinhas((atual) => upsert(atual, linha));
      return linha;
    },
    [linhas],
  );

  const salvarCriativo = useCallback<ContextoCadastros["salvarCriativo"]>(
    (entrada) => {
      const existente = entrada.id ? criativos.find((c) => c.id === entrada.id) : null;
      const criativo: Criativo = {
        ...entrada,
        id: existente?.id ?? novoId("cri"),
        criadoEm: existente?.criadoEm ?? agora(),
      };
      setCriativos((atual) => upsert(atual, criativo));
      return criativo;
    },
    [criativos],
  );

  const salvarBanco = useCallback<ContextoCadastros["salvarBanco"]>(
    (entrada) => {
      const existente = entrada.id ? bancos.find((b) => b.id === entrada.id) : null;
      const banco: BancoPlataforma = {
        ...entrada,
        id: existente?.id ?? novoId(entrada.tipo === "banco" ? "bnc" : "plt"),
        saldo: existente?.saldo ?? 0,
        fonte: "manual",
        atualizadoEm: agora(),
      };
      setBancos((atual) => upsert(atual, banco));
      return banco;
    },
    [bancos],
  );

  const alternarAtivo = useCallback<ContextoCadastros["alternarAtivo"]>((tipo, id) => {
    const inverter = <T extends { id: ID; ativo: boolean }>(lista: T[]) =>
      lista.map((x) => (x.id === id ? { ...x, ativo: !x.ativo } : x));
    if (tipo === "produto") setProdutos(inverter);
    if (tipo === "kit") setKits(inverter);
    if (tipo === "criativo") setCriativos(inverter);
    if (tipo === "banco") setBancos(inverter);
    if (tipo === "linha") {
      setLinhas((atual) => atual.map((l) => (l.id === id ? { ...l, ativa: !l.ativa } : l)));
    }
  }, []);

  const valor = useMemo<ContextoCadastros>(
    () => ({
      produtos,
      kits,
      linhas,
      criativos,
      bancos,
      salvarProduto,
      salvarKit,
      salvarLinha,
      salvarCriativo,
      salvarBanco,
      alternarAtivo,
    }),
    [
      produtos,
      kits,
      linhas,
      criativos,
      bancos,
      salvarProduto,
      salvarKit,
      salvarLinha,
      salvarCriativo,
      salvarBanco,
      alternarAtivo,
    ],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useCadastros() {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("useCadastros precisa do CadastrosProvider.");
  return ctx;
}
