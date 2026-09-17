import type { Colaborador, Nivel, Pedido, Setor } from "@/lib/types";
import { desempenhoNo, type Desempenho } from "@/lib/desempenho";
import type { Intervalo } from "@/lib/periodos";
import { progressoNivel } from "@/lib/dominio/equipe";

/**
 * Classificação da equipe. A tela de Ranking e o card de Equipe da Minha área
 * leem daqui, para a posição de alguém nunca ser uma numa tela e outra na
 * vizinha.
 */

export type FiltroSetorRanking = "todos" | Exclude<Setor, "administracao">;

export interface PosicaoRanking {
  colaborador: Colaborador;
  desempenho: Desempenho;
  nivel: string;
  progresso: number;
}

/** Mais pedidos primeiro; empate sai pela menor frustração, depois faturamento e nome. */
export function classificarEquipe(
  colaboradores: Colaborador[],
  niveis: Nivel[],
  pedidos: Pedido[],
  intervalo: Intervalo,
  setor: FiltroSetorRanking,
): PosicaoRanking[] {
  return colaboradores
    .filter((c) => c.ativo && c.setor !== "administracao")
    .filter((c) => setor === "todos" || c.setor === setor)
    .map((colaborador) => {
      const { atual, progresso } = progressoNivel(niveis, colaborador);
      return {
        colaborador,
        desempenho: desempenhoNo(colaborador, pedidos, intervalo),
        nivel: atual?.nome ?? "—",
        progresso,
      };
    })
    .sort(
      (a, b) =>
        b.desempenho.pedidos - a.desempenho.pedidos ||
        (a.desempenho.frustracao ?? 1) - (b.desempenho.frustracao ?? 1) ||
        b.desempenho.faturamento - a.desempenho.faturamento ||
        a.colaborador.nome.localeCompare(b.colaborador.nome, "pt-BR"),
    );
}
