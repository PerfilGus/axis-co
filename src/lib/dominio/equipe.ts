import type { BonusNivel, Colaborador, DataISO, ID, Nivel } from "@/lib/types";

/**
 * Regras da trilha de níveis. Puras: a tela usa para desenhar o progresso e o
 * servidor para promover e liberar bônus.
 */

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

/** A ordem sai da pontuação mínima, para a trilha nunca sair de sequência. */
export function reordenarNiveis(niveis: Nivel[]): Nivel[] {
  return [...niveis]
    .sort((a, b) => a.pontosNecessarios - b.pontosNecessarios)
    .map((n, i) => ({ ...n, ordem: i + 1 }));
}

/**
 * Sobe de nível quem já tem pontos para isso e libera o bônus de cada degrau
 * alcançado. Nunca rebaixa: o bônus de um nível já conquistado não volta.
 */
export function promover(
  colaboradores: Colaborador[],
  niveis: Nivel[],
  bonus: BonusNivel[],
  ctx: { agora: DataISO; novoId: () => ID },
): { colaboradores: Colaborador[]; liberados: BonusNivel[] } {
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
        id: ctx.novoId(),
        colaboradorId: c.id,
        nivelId: nivel.id,
        valor: nivel.bonus,
        liberadoEm: ctx.agora,
        status: "liberado",
        pagoEm: null,
      });
    }
    return { ...c, nivelId: alcancado.id };
  });
  return { colaboradores: novos, liberados };
}
