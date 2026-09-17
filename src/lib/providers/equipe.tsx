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
  BonusNivel,
  Colaborador,
  Conquista,
  ID,
  LancamentoPontos,
  Meta,
  Nivel,
  Recompensa,
  RegraPontuacao,
} from "@/lib/types";
import type { DadosEquipe } from "@/lib/servidor/dados";
import * as acoes from "@/app/acoes/equipe";
import type { EntradaColaborador } from "@/app/acoes/equipe";
import type { Entrada } from "./cadastros";
import { chamar } from "./acao";

export type { EntradaColaborador };

/**
 * Equipe da sessão: colaboradores, metas, níveis, conquistas, bônus de nível e
 * fechamentos pagos.
 *
 * Fechamento pendente não é guardado: é recalculado dos pedidos a cada
 * render. Só o pago vira registro, e o servidor congela o que ele mesmo
 * calculou no momento em que o Admin marcou.
 */

interface ContextoEquipe extends DadosEquipe {
  nomeDe: (id: ID | null) => string;
  /** Criar pede a senha provisória do login; editar ignora. */
  salvarColaborador: (entrada: EntradaColaborador, senhaProvisoria: string | null) => Promise<Colaborador | null>;
  redefinirSenha: (colaboradorId: ID, senhaProvisoria: string) => Promise<boolean>;
  encerrarSessoes: (colaboradorId: ID) => Promise<number | null>;
  redefinirDoisFatores: (colaboradorId: ID) => Promise<boolean>;
  salvarRegra: (entrada: Entrada<RegraPontuacao, "criadoPor" | "criadoEm">) => Promise<RegraPontuacao | null>;
  excluirRegra: (id: ID) => Promise<boolean>;
  salvarMeta: (entrada: Entrada<Meta>) => Promise<Meta | null>;
  excluirMeta: (id: ID) => Promise<boolean>;
  salvarNivel: (entrada: Entrada<Nivel>) => Promise<BonusNivel[] | null>;
  excluirNivel: (id: ID) => Promise<boolean>;
  salvarConquista: (entrada: Entrada<Conquista>) => Promise<Conquista | null>;
  excluirConquista: (id: ID) => Promise<boolean>;
  salvarRecompensa: (entrada: Entrada<Recompensa>) => Promise<Recompensa | null>;
  excluirRecompensa: (id: ID) => Promise<boolean>;
  /** Fecha na hora as janelas já encerradas, sem esperar a rotina da madrugada. */
  avaliarJanelas: () => Promise<{ conquistas: number; recompensas: number; janelas: number } | null>;
  /** Extrato de um período qualquer: o da sessão cobre só o mês passado e este. */
  extratoDePontos: (colaboradorId: ID, de: string, ate: string) => Promise<LancamentoPontos[] | null>;
  /** Soma os pontos da conquista e devolve os bônus de nível liberados. */
  registrarConquista: (colaboradorId: ID, conquistaId: ID) => Promise<BonusNivel[] | null>;
  confirmarBonus: (bonusId: ID) => Promise<boolean>;
  marcarComoPago: (itens: Array<{ colaboradorId: ID; competencia: string }>) => Promise<boolean>;
}

const Contexto = createContext<ContextoEquipe | null>(null);

type Resposta<T> = { ok: true; dados: { equipe: DadosEquipe; extra: T } } | { ok: false; erro: string };

export function EquipeProvider({ inicial, children }: { inicial: DadosEquipe; children: ReactNode }) {
  const [dados, setDados] = useState(inicial);

  /** Troca a equipe pelo que voltou; `undefined` quando a ação foi recusada. */
  const receber = useCallback(async <T,>(promessa: Promise<Resposta<T>>): Promise<{ extra: T } | undefined> => {
    const resposta = await chamar(promessa);
    if (!resposta) return undefined;
    setDados(resposta.equipe);
    return { extra: resposta.extra };
  }, []);

  const nomeDe = useCallback(
    (id: ID | null) => (id ? (dados.colaboradores.find((c) => c.id === id)?.nome ?? "—") : "—"),
    [dados.colaboradores],
  );

  const salvarColaborador = useCallback<ContextoEquipe["salvarColaborador"]>(
    async (entrada, senha) => (await receber(acoes.salvarColaborador(entrada, senha)))?.extra ?? null,
    [receber],
  );
  const redefinirSenha = useCallback<ContextoEquipe["redefinirSenha"]>(
    async (id, senha) => (await chamar(acoes.redefinirSenha(id, senha))) !== null,
    [],
  );
  const encerrarSessoes = useCallback<ContextoEquipe["encerrarSessoes"]>(
    (id) => chamar(acoes.encerrarSessoes(id)),
    [],
  );
  const redefinirDoisFatores = useCallback<ContextoEquipe["redefinirDoisFatores"]>(
    async (id) => (await chamar(acoes.redefinirDoisFatores(id))) !== null,
    [],
  );
  const salvarRegra = useCallback<ContextoEquipe["salvarRegra"]>(
    async (entrada) => (await receber(acoes.salvarRegraPontuacao(entrada)))?.extra ?? null,
    [receber],
  );
  const excluirRegra = useCallback<ContextoEquipe["excluirRegra"]>(
    async (id) => (await receber(acoes.excluirRegraPontuacao(id))) !== undefined,
    [receber],
  );
  const excluirNivel = useCallback<ContextoEquipe["excluirNivel"]>(
    async (id) => (await receber(acoes.excluirNivel(id))) !== undefined,
    [receber],
  );
  const excluirConquista = useCallback<ContextoEquipe["excluirConquista"]>(
    async (id) => (await receber(acoes.excluirConquista(id))) !== undefined,
    [receber],
  );
  const salvarRecompensa = useCallback<ContextoEquipe["salvarRecompensa"]>(
    async (entrada) => (await receber(acoes.salvarRecompensa(entrada)))?.extra ?? null,
    [receber],
  );
  const excluirRecompensa = useCallback<ContextoEquipe["excluirRecompensa"]>(
    async (id) => (await receber(acoes.excluirRecompensa(id))) !== undefined,
    [receber],
  );
  const avaliarJanelas = useCallback<ContextoEquipe["avaliarJanelas"]>(
    async () => (await receber(acoes.avaliarJanelas()))?.extra ?? null,
    [receber],
  );
  const extratoDePontos = useCallback<ContextoEquipe["extratoDePontos"]>(
    (id, de, ate) => chamar(acoes.extratoDePontos(id, de, ate)),
    [],
  );
  const salvarMeta = useCallback<ContextoEquipe["salvarMeta"]>(
    async (entrada) => (await receber(acoes.salvarMeta(entrada)))?.extra ?? null,
    [receber],
  );
  const excluirMeta = useCallback<ContextoEquipe["excluirMeta"]>(
    async (id) => (await receber(acoes.excluirMeta(id))) !== undefined,
    [receber],
  );
  const salvarNivel = useCallback<ContextoEquipe["salvarNivel"]>(
    async (entrada) => (await receber(acoes.salvarNivel(entrada)))?.extra ?? null,
    [receber],
  );
  const salvarConquista = useCallback<ContextoEquipe["salvarConquista"]>(
    async (entrada) => (await receber(acoes.salvarConquista(entrada)))?.extra ?? null,
    [receber],
  );
  const registrarConquista = useCallback<ContextoEquipe["registrarConquista"]>(
    async (colaboradorId, conquistaId) =>
      (await receber(acoes.registrarConquista(colaboradorId, conquistaId)))?.extra ?? null,
    [receber],
  );
  const confirmarBonus = useCallback<ContextoEquipe["confirmarBonus"]>(
    async (id) => (await receber(acoes.confirmarBonus(id))) !== undefined,
    [receber],
  );
  const marcarComoPago = useCallback<ContextoEquipe["marcarComoPago"]>(
    async (itens) => (await receber(acoes.marcarComoPago(itens))) !== undefined,
    [receber],
  );

  const valor = useMemo<ContextoEquipe>(
    () => ({
      ...dados,
      nomeDe,
      salvarColaborador,
      redefinirSenha,
      encerrarSessoes,
      redefinirDoisFatores,
      salvarRegra,
      excluirRegra,
      salvarMeta,
      excluirMeta,
      salvarNivel,
      excluirNivel,
      salvarConquista,
      excluirConquista,
      salvarRecompensa,
      excluirRecompensa,
      avaliarJanelas,
      extratoDePontos,
      registrarConquista,
      confirmarBonus,
      marcarComoPago,
    }),
    [
      dados,
      nomeDe,
      salvarColaborador,
      redefinirSenha,
      encerrarSessoes,
      redefinirDoisFatores,
      salvarRegra,
      excluirRegra,
      salvarMeta,
      excluirMeta,
      salvarNivel,
      excluirNivel,
      salvarConquista,
      excluirConquista,
      salvarRecompensa,
      excluirRecompensa,
      avaliarJanelas,
      extratoDePontos,
      registrarConquista,
      confirmarBonus,
      marcarComoPago,
    ],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useEquipe() {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("useEquipe precisa do EquipeProvider.");
  return ctx;
}
