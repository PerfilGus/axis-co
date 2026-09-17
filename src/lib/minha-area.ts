import type { Colaborador, Meta } from "@/lib/types";
import { hoje, intervaloDeDias, janelaCorrente, somarDias, type Janela } from "@/lib/periodos";
import { medirMeta, metasDoColaborador } from "@/lib/metas";
import type { FontesMetricas } from "@/lib/metricas";

/**
 * A Minha área: o que o próprio colaborador vê de si. Tudo é recalculado das
 * metas, dos pedidos e do extrato da sessão — nada aqui é guardado.
 */

export interface DiaDaSemana {
  dia: string;
  trabalhado: boolean;
  /** `null` quando o colaborador não tem meta diária para bater. */
  metaBatida: boolean | null;
  ehHoje: boolean;
  futuro: boolean;
}

/** Segunda a domingo da semana corrente. */
export function semanaDoColaborador(
  colaborador: Colaborador,
  metas: Meta[],
  fontes: FontesMetricas,
  atividade: Set<string>,
  referencia = new Date(),
): DiaDaSemana[] {
  const semana = janelaCorrente("semanal", referencia);
  const hojeDia = hoje(referencia);
  const diarias = metasDoColaborador(metas, colaborador, referencia).filter(
    (m) => m.periodo === "diaria",
  );

  return Array.from({ length: 7 }, (_, i) => {
    const dia = somarDias(semana.de, i);
    const futuro = dia > hojeDia;
    const janela: Janela = {
      chave: dia,
      periodo: "diaria",
      de: dia,
      ate: dia,
      intervalo: intervaloDeDias(dia, dia, referencia),
    };
    return {
      dia,
      trabalhado: !futuro && atividade.has(dia),
      metaBatida:
        diarias.length === 0
          ? null
          : !futuro && diarias.some((m) => medirMeta(m, colaborador, fontes, janela).batida),
      ehHoje: dia === hojeDia,
      futuro,
    };
  });
}

/**
 * Dias seguidos com atividade. Hoje ainda sem movimento não quebra a
 * sequência: ela conta a partir de ontem até o dia acabar.
 */
export function sequenciaDeDias(atividade: Set<string>, referencia = new Date()): number {
  let dia = hoje(referencia);
  if (!atividade.has(dia)) dia = somarDias(dia, -1);
  let total = 0;
  while (atividade.has(dia)) {
    total += 1;
    dia = somarDias(dia, -1);
  }
  return total;
}
