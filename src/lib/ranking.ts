import type { Colaborador, LancamentoPontos, Nivel, Pedido, Setor } from "@/lib/types";
import { desempenhoNo, type Desempenho } from "@/lib/desempenho";
import { dentro, type Intervalo } from "@/lib/periodos";
import { progressoNivel } from "@/lib/dominio/equipe";

/**
 * Classificação da equipe. A tela de Ranking e o card de Equipe da Minha área
 * leem daqui, para a posição de alguém nunca ser uma numa tela e outra na
 * vizinha.
 */

export type FiltroSetorRanking = "todos" | Exclude<Setor, "administracao">;

/** O que ordena a lista: o número do setor ou os pontos ganhos no período. */
export type CriterioRanking = "pedidos" | "pontos";

export interface PosicaoRanking {
  colaborador: Colaborador;
  desempenho: Desempenho;
  /** Pontos ganhos no período, já com estornos e penalidades. */
  pontos: number;
  nivel: string;
  progresso: number;
}

/**
 * Mais pedidos (ou mais pontos) primeiro; empate sai pela menor frustração,
 * depois faturamento e nome.
 */
export function classificarEquipe(
  colaboradores: Colaborador[],
  niveis: Nivel[],
  pedidos: Pedido[],
  intervalo: Intervalo,
  setor: FiltroSetorRanking,
  lancamentos: LancamentoPontos[] = [],
  criterio: CriterioRanking = "pedidos",
): PosicaoRanking[] {
  return colaboradores
    .filter((c) => c.ativo && c.setor !== "administracao")
    .filter((c) => setor === "todos" || c.setor === setor)
    .map((colaborador) => {
      const { atual, progresso } = progressoNivel(niveis, colaborador);
      return {
        colaborador,
        desempenho: desempenhoNo(colaborador, pedidos, intervalo),
        pontos: lancamentos
          .filter((l) => l.colaboradorId === colaborador.id && dentro(l.ocorridoEm, intervalo))
          .reduce((s, l) => s + l.pontos, 0),
        nivel: atual?.nome ?? "—",
        progresso,
      };
    })
    .sort(
      (a, b) =>
        (criterio === "pontos" ? b.pontos - a.pontos : b.desempenho.pedidos - a.desempenho.pedidos) ||
        (a.desempenho.frustracao ?? 1) - (b.desempenho.frustracao ?? 1) ||
        b.desempenho.faturamento - a.desempenho.faturamento ||
        a.colaborador.nome.localeCompare(b.colaborador.nome, "pt-BR"),
    );
}
