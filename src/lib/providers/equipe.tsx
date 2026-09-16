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
  ConquistaDesbloqueada,
  ID,
  Meta,
  Nivel,
  PagamentoColaborador,
} from "@/lib/types";
import {
  BONUS_NIVEL,
  COLABORADORES,
  CONQUISTAS,
  CONQUISTAS_DESBLOQUEADAS,
  METAS,
  NIVEIS,
} from "@/lib/mock/equipe";
import { PEDIDOS } from "@/lib/mock/pedidos";
import { ultimasCompetencias } from "@/lib/periodos";
import {
  ativoNaCompetencia,
  calcularFechamento,
  comissionavel,
} from "@/lib/comissoes";
import type { Entrada } from "./cadastros";

/**
 * Equipe durante a sessão: colaboradores, metas, níveis, conquistas, bônus de
 * nível e os fechamentos já pagos.
 *
 * Fechamento pendente não é guardado: é recalculado dos pedidos a cada
 * render. Só o pago vira registro, com os valores congelados no momento em
 * que o Admin marcou.
 */

let sequencia = 7000;
function novoId(prefixo: string): string {
  sequencia += 1;
  return `${prefixo}_${sequencia}`;
}

function agora(): string {
  return new Date().toISOString();
}

/** O nível que a pontuação alcança. */
export function nivelPorPontos(niveis: Nivel[], pontos: number): Nivel | null {
  return (
    [...niveis]
      .sort((a, b) => b.pontosNecessarios - a.pontosNecessarios)
      .find((n) => pontos >= n.pontosNecessarios) ?? null
  );
}

/** Próximo degrau da trilha e quanto falta, para o anel do avatar. */
export function progressoNivel(niveis: Nivel[], colaborador: Colaborador) {
  const ordenados = [...niveis].sort((a, b) => a.ordem - b.ordem);
  const atual = ordenados.find((n) => n.id === colaborador.nivelId) ?? ordenados[0] ?? null;
  const proximo = atual ? (ordenados.find((n) => n.ordem > atual.ordem) ?? null) : null;
  if (!atual || !proximo) return { atual, proximo, progresso: 1 };
  const faixa = proximo.pontosNecessarios - atual.pontosNecessarios;
  const progresso = faixa > 0 ? (colaborador.pontos - atual.pontosNecessarios) / faixa : 1;
  return { atual, proximo, progresso: Math.min(Math.max(progresso, 0), 1) };
}

/**
 * Sobe de nível quem já tem pontos para isso e libera o bônus de cada degrau
 * alcançado. Nunca rebaixa: o bônus de um nível já conquistado não volta.
 */
function promover(
  colaboradores: Colaborador[],
  niveis: Nivel[],
  bonus: BonusNivel[],
): { colaboradores: Colaborador[]; bonus: BonusNivel[]; liberados: BonusNivel[] } {
  const liberados: BonusNivel[] = [];
  const ordenados = [...niveis].sort((a, b) => a.ordem - b.ordem);
  const novos = colaboradores.map((c) => {
    const atual = ordenados.find((n) => n.id === c.nivelId);
    const alcancado = nivelPorPontos(niveis, c.pontos);
    if (!alcancado || (atual && alcancado.ordem <= atual.ordem)) return c;
    for (const nivel of ordenados) {
      if (nivel.ordem <= (atual?.ordem ?? 0) || nivel.ordem > alcancado.ordem) continue;
      if (nivel.bonus <= 0) continue;
      if (bonus.some((b) => b.colaboradorId === c.id && b.nivelId === nivel.id)) continue;
      liberados.push({
        id: novoId("bnv"),
        colaboradorId: c.id,
        nivelId: nivel.id,
        valor: nivel.bonus,
        liberadoEm: agora(),
        status: "liberado",
        pagoEm: null,
      });
    }
    return { ...c, nivelId: alcancado.id };
  });
  return { colaboradores: novos, bonus: [...bonus, ...liberados], liberados };
}

/**
 * Os meses fechados desde março nascem pagos, para a tela ter história e o
 * relatório financeiro ter a folha de cada mês no caixa.
 */
function fechamentosPagosIniciais(): PagamentoColaborador[] {
  const [, ...anteriores] = ultimasCompetencias(7);
  return anteriores.flatMap((competencia) =>
    COLABORADORES.filter((c) => comissionavel(c) && ativoNaCompetencia(c, competencia)).map(
      (c) => {
        const fechamento = calcularFechamento(c, competencia, PEDIDOS, {
          metas: METAS,
          niveis: NIVEIS,
          bonusNivel: BONUS_NIVEL,
        });
        return { ...fechamento, status: "pago" as const, pagoEm: fechamento.pagarEm };
      },
    ),
  );
}

export type EntradaColaborador = Entrada<
  Colaborador,
  "perfil" | "entrouEm" | "nivelId" | "pontos" | "apelido"
>;

interface ContextoEquipe {
  colaboradores: Colaborador[];
  metas: Meta[];
  niveis: Nivel[];
  conquistas: Conquista[];
  desbloqueadas: ConquistaDesbloqueada[];
  bonusNivel: BonusNivel[];
  /** Só os fechamentos pagos. Os pendentes saem de `calcularFechamento`. */
  pagamentos: PagamentoColaborador[];

  nomeDe: (id: ID | null) => string;
  salvarColaborador: (entrada: EntradaColaborador) => Colaborador;
  salvarMeta: (entrada: Entrada<Meta>) => Meta;
  excluirMeta: (id: ID) => void;
  salvarNivel: (entrada: Entrada<Nivel>) => BonusNivel[];
  salvarConquista: (entrada: Entrada<Conquista>) => Conquista;
  /** Soma os pontos da conquista e devolve os bônus de nível liberados. */
  registrarConquista: (colaboradorId: ID, conquistaId: ID) => BonusNivel[];
  confirmarBonus: (bonusId: ID) => void;
  marcarComoPago: (fechamentos: PagamentoColaborador[]) => void;
}

const Contexto = createContext<ContextoEquipe | null>(null);

export function EquipeProvider({ children }: { children: ReactNode }) {
  const [colaboradores, setColaboradores] = useState(COLABORADORES);
  const [metas, setMetas] = useState(METAS);
  const [niveis, setNiveis] = useState(NIVEIS);
  const [conquistas, setConquistas] = useState(CONQUISTAS);
  const [desbloqueadas, setDesbloqueadas] = useState(CONQUISTAS_DESBLOQUEADAS);
  const [bonusNivel, setBonusNivel] = useState(BONUS_NIVEL);
  const [pagamentos, setPagamentos] = useState(fechamentosPagosIniciais);

  const nomeDe = useCallback(
    (id: ID | null) => (id ? (colaboradores.find((c) => c.id === id)?.nome ?? "—") : "—"),
    [colaboradores],
  );

  const salvarColaborador = useCallback<ContextoEquipe["salvarColaborador"]>(
    (entrada) => {
      const existente = entrada.id ? colaboradores.find((c) => c.id === entrada.id) : null;
      const primeiroNivel = [...niveis].sort((a, b) => a.ordem - b.ordem)[0];
      const colaborador: Colaborador = {
        ...entrada,
        id: existente?.id ?? novoId("col"),
        apelido: entrada.nome.trim().split(/\s+/)[0] ?? entrada.nome,
        perfil: entrada.setor === "financeiro" ? "financeiro" : "vendedor",
        entrouEm: existente?.entrouEm ?? agora(),
        nivelId: existente?.nivelId ?? primeiroNivel?.id ?? "",
        pontos: existente?.pontos ?? 0,
        vendedoresAtribuidos: entrada.setor === "financeiro" ? entrada.vendedoresAtribuidos : [],
        frustradoBps: entrada.setor === "vendas" ? entrada.frustradoBps : null,
      };
      setColaboradores((atual) =>
        existente
          ? atual.map((c) => (c.id === colaborador.id ? colaborador : c))
          : [...atual, colaborador],
      );
      return colaborador;
    },
    [colaboradores, niveis],
  );

  const salvarMeta = useCallback<ContextoEquipe["salvarMeta"]>((entrada) => {
    const meta: Meta = { ...entrada, id: entrada.id ?? novoId("meta") };
    setMetas((atual) =>
      atual.some((m) => m.id === meta.id)
        ? atual.map((m) => (m.id === meta.id ? meta : m))
        : [...atual, meta],
    );
    return meta;
  }, []);

  const excluirMeta = useCallback((id: ID) => {
    setMetas((atual) => atual.filter((m) => m.id !== id));
  }, []);

  const salvarNivel = useCallback<ContextoEquipe["salvarNivel"]>(
    (entrada) => {
      const nivel: Nivel = { ...entrada, id: entrada.id ?? novoId("niv") };
      // A ordem sai da pontuação mínima, para a trilha nunca sair de sequência.
      const novosNiveis = (
        niveis.some((n) => n.id === nivel.id)
          ? niveis.map((n) => (n.id === nivel.id ? nivel : n))
          : [...niveis, nivel]
      )
        .sort((a, b) => a.pontosNecessarios - b.pontosNecessarios)
        .map((n, i) => ({ ...n, ordem: i + 1 }));
      const resultado = promover(colaboradores, novosNiveis, bonusNivel);
      setNiveis(novosNiveis);
      setColaboradores(resultado.colaboradores);
      setBonusNivel(resultado.bonus);
      return resultado.liberados;
    },
    [niveis, colaboradores, bonusNivel],
  );

  const salvarConquista = useCallback<ContextoEquipe["salvarConquista"]>((entrada) => {
    const conquista: Conquista = { ...entrada, id: entrada.id ?? novoId("conq") };
    setConquistas((atual) =>
      atual.some((c) => c.id === conquista.id)
        ? atual.map((c) => (c.id === conquista.id ? conquista : c))
        : [...atual, conquista],
    );
    return conquista;
  }, []);

  const registrarConquista = useCallback<ContextoEquipe["registrarConquista"]>(
    (colaboradorId, conquistaId) => {
      const conquista = conquistas.find((c) => c.id === conquistaId);
      if (!conquista) return [];
      const pontuados = colaboradores.map((c) =>
        c.id === colaboradorId ? { ...c, pontos: c.pontos + conquista.pontos } : c,
      );
      const resultado = promover(pontuados, niveis, bonusNivel);
      setColaboradores(resultado.colaboradores);
      setBonusNivel(resultado.bonus);
      setDesbloqueadas((atual) => [
        ...atual,
        { conquistaId, colaboradorId, desbloqueadaEm: agora() },
      ]);
      return resultado.liberados;
    },
    [conquistas, colaboradores, niveis, bonusNivel],
  );

  const confirmarBonus = useCallback((bonusId: ID) => {
    const pagoEm = agora();
    setBonusNivel((atual) =>
      atual.map((b) => (b.id === bonusId ? { ...b, status: "pago" as const, pagoEm } : b)),
    );
  }, []);

  const marcarComoPago = useCallback<ContextoEquipe["marcarComoPago"]>((fechamentos) => {
    const pagoEm = agora();
    const pagos = fechamentos.map((f) => ({ ...f, status: "pago" as const, pagoEm }));
    const bonusQuitados = new Set(fechamentos.flatMap((f) => f.bonusNivelIds));
    setPagamentos((atual) => [
      ...atual.filter((p) => !pagos.some((n) => n.id === p.id)),
      ...pagos,
    ]);
    setBonusNivel((atual) =>
      atual.map((b) =>
        bonusQuitados.has(b.id) && b.status === "liberado"
          ? { ...b, status: "pago" as const, pagoEm }
          : b,
      ),
    );
  }, []);

  const valor = useMemo<ContextoEquipe>(
    () => ({
      colaboradores,
      metas,
      niveis,
      conquistas,
      desbloqueadas,
      bonusNivel,
      pagamentos,
      nomeDe,
      salvarColaborador,
      salvarMeta,
      excluirMeta,
      salvarNivel,
      salvarConquista,
      registrarConquista,
      confirmarBonus,
      marcarComoPago,
    }),
    [
      colaboradores,
      metas,
      niveis,
      conquistas,
      desbloqueadas,
      bonusNivel,
      pagamentos,
      nomeDe,
      salvarColaborador,
      salvarMeta,
      excluirMeta,
      salvarNivel,
      salvarConquista,
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
