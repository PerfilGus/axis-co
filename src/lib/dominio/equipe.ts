import type { BonusNivel, Colaborador, DataISO, ID, Nivel, SetorPontuavel } from "@/lib/types";
import { nivelComQueda } from "@/lib/pontos";

/**
 * Regras da trilha de níveis. Puras: a tela usa para desenhar o progresso e o
 * servidor para promover, rebaixar e liberar bônus.
 */

/** O nível que a pontuação alcança, sem tolerância de queda. */
export function nivelPorPontos(niveis: Nivel[], pontos: number): Nivel | null {
  return (
    [...niveis]
      .sort((a, b) => b.pontosNecessarios - a.pontosNecessarios)
      .find((n) => pontos >= n.pontosNecessarios) ?? null
  );
}

/** Próximo degrau da trilha e quanto falta, para o anel do avatar. */
export function progressoNivel(niveis: Nivel[], colaborador: Pick<Colaborador, "nivelId" | "pontos">) {
  const ordenados = [...niveis].sort((a, b) => a.ordem - b.ordem);
  const atual = ordenados.find((n) => n.id === colaborador.nivelId) ?? ordenados[0] ?? null;
  const proximo = atual ? (ordenados.find((n) => n.ordem > atual.ordem) ?? null) : null;
  if (!atual || !proximo) return { atual, proximo, progresso: 1 };
  const faixa = proximo.pontosNecessarios - atual.pontosNecessarios;
  const progresso = faixa > 0 ? (colaborador.pontos - atual.pontosNecessarios) / faixa : 1;
  return { atual, proximo, progresso: Math.min(Math.max(progresso, 0), 1) };
}

/** A ordem sai da pontuação mínima, para a trilha nunca sair de sequência. */
export function reordenarNiveis(niveis: Nivel[]): Nivel[] {
  return [...niveis]
    .sort((a, b) => a.pontosNecessarios - b.pontosNecessarios)
    .map((n, i) => ({ ...n, ordem: i + 1 }));
}

export interface MudancaNivel {
  colaboradorId: ID;
  de: Nivel | null;
  para: Nivel | null;
  subiu: boolean;
}

/**
 * Acerta o nível de cada colaborador pelo saldo de pontos e libera o bônus de
 * cada degrau novo.
 *
 * Quem perde pontos pode cair, mas só depois da tolerância da regra do setor:
 * ficando acima dela na faixa do nível anterior, o nível se mantém. O bônus de
 * um nível é pago uma vez na vida — recair e subir de novo não paga outra.
 */
export function ajustarNiveis(
  colaboradores: Colaborador[],
  niveis: Nivel[],
  bonus: BonusNivel[],
  quedaBpsDoSetor: (setor: SetorPontuavel) => number,
  ctx: { agora: DataISO; novoId: () => ID },
): { colaboradores: Colaborador[]; liberados: BonusNivel[]; mudancas: MudancaNivel[] } {
  const liberados: BonusNivel[] = [];
  const mudancas: MudancaNivel[] = [];
  const ordenados = [...niveis].sort((a, b) => a.ordem - b.ordem);

  const novos = colaboradores.map((c) => {
    if (c.setor === "administracao" || ordenados.length === 0) return c;
    const atual = ordenados.find((n) => n.id === c.nivelId) ?? null;
    const destino = nivelComQueda(ordenados, c.nivelId, c.pontos, quedaBpsDoSetor(c.setor));
    if (!destino || destino.id === atual?.id) return c;

    const subiu = destino.ordem > (atual?.ordem ?? 0);
    if (subiu) {
      for (const nivel of ordenados) {
        if (nivel.ordem <= (atual?.ordem ?? 0) || nivel.ordem > destino.ordem) continue;
        if (nivel.bonus <= 0) continue;
        if (bonus.some((b) => b.colaboradorId === c.id && b.nivelId === nivel.id)) continue;
        if (liberados.some((b) => b.colaboradorId === c.id && b.nivelId === nivel.id)) continue;
        liberados.push({
          id: ctx.novoId(),
          colaboradorId: c.id,
          nivelId: nivel.id,
          valor: nivel.bonus,
          liberadoEm: ctx.agora,
          status: "liberado",
          pagoEm: null,
        });
      }
    }
    mudancas.push({ colaboradorId: c.id, de: atual, para: destino, subiu });
    return { ...c, nivelId: destino.id };
  });

  return { colaboradores: novos, liberados, mudancas };
}
