import type {
  Colaborador,
  Conquista,
  ConquistaDesbloqueada,
  Meta,
  Recompensa,
  RecompensaLiberada,
} from "@/lib/types";
import { formatBRL } from "@/lib/format";
import { rotuloDaJanela, vigenteNaJanela, type Janela } from "@/lib/periodos";
import { medirMeta } from "@/lib/metas";
import {
  alcanca,
  atende,
  descreverCondicao,
  medirMetrica,
  progressoDaCondicao,
  type FontesMetricas,
} from "@/lib/metricas";

/**
 * O que uma janela fechada rendeu: conquistas desbloqueadas e recompensas
 * liberadas.
 *
 * Puro e idempotente — o que já foi registrado para a janela não volta. A
 * rotina diária (`api/cron/pontos`) executa isto sobre os dados do banco; a
 * Minha área usa as mesmas funções na janela corrente, só para mostrar o
 * progresso.
 */

export interface ConquistaNaJanela {
  conquista: Conquista;
  janela: Janela;
  atual: number | null;
  feita: boolean;
  progresso: number;
  /** Já registrada para esta janela (ou para sempre, na conquista única). */
  registrada: boolean;
}

export function conquistaVale(conquista: Conquista, colaborador: Colaborador, janela: Janela) {
  return conquista.ativa && conquista.periodo === janela.periodo && alcanca(
    { colaboradorId: null, setor: conquista.setor },
    colaborador,
  );
}

/** As conquistas do colaborador naquela janela, com o que já foi feito. */
export function conquistasNaJanela(
  colaborador: Colaborador,
  conquistas: Conquista[],
  desbloqueadas: ConquistaDesbloqueada[],
  janela: Janela,
  fontes: FontesMetricas,
): ConquistaNaJanela[] {
  return conquistas
    .filter((c) => conquistaVale(c, colaborador, janela))
    .map((conquista) => {
      const minhas = desbloqueadas.filter(
        (d) => d.conquistaId === conquista.id && d.colaboradorId === colaborador.id,
      );
      const registrada = conquista.repetivel
        ? minhas.some((d) => d.janela === janela.chave)
        : minhas.length > 0;
      const atual = medirMetrica(conquista.metrica, colaborador, janela, fontes);
      return {
        conquista,
        janela,
        atual,
        feita: atende(atual, conquista.operador, conquista.valor),
        progresso: progressoDaCondicao(atual, conquista.operador, conquista.valor),
        registrada,
      };
    })
    .filter((etapa) => !(etapa.registrada && !etapa.conquista.repetivel));
}

/** O que registrar ao fechar a janela: nada que já esteja registrado. */
export function conquistasADesbloquear(
  colaborador: Colaborador,
  conquistas: Conquista[],
  desbloqueadas: ConquistaDesbloqueada[],
  janela: Janela,
  fontes: FontesMetricas,
): ConquistaNaJanela[] {
  return conquistasNaJanela(colaborador, conquistas, desbloqueadas, janela, fontes).filter(
    (e) => e.feita && !e.registrada && e.conquista.pontos > 0,
  );
}

/* ================================================================
   Recompensas
   ================================================================ */

export interface RecompensaNaJanela {
  recompensa: Recompensa;
  janela: Janela;
  atual: number | null;
  liberada: boolean;
  progresso: number;
  /** Já registrada para esta janela. */
  registrada: boolean;
  condicao: string;
}

export function recompensaVale(recompensa: Recompensa, colaborador: Colaborador, janela: Janela) {
  return (
    recompensa.ativa &&
    recompensa.periodo === janela.periodo &&
    alcanca(recompensa, colaborador) &&
    vigenteNaJanela(recompensa, janela)
  );
}

/** Em palavras: `Meta do dia batida` ou `pelo menos 10 pagos`. */
export function descreverRecompensa(recompensa: Recompensa, metas: Meta[]): string {
  if (recompensa.condicao.tipo === "meta") {
    const meta = metas.find((m) => m.id === (recompensa.condicao as { metaId: string }).metaId);
    return meta ? `Bater a meta ${meta.nome}` : "Bater uma meta que não existe mais";
  }
  const { metrica, operador, valor } = recompensa.condicao;
  return descreverCondicao(metrica, operador, valor);
}

export function recompensasNaJanela(
  colaborador: Colaborador,
  recompensas: Recompensa[],
  liberadas: RecompensaLiberada[],
  janela: Janela,
  fontes: FontesMetricas,
): RecompensaNaJanela[] {
  return recompensas
    .filter((r) => recompensaVale(r, colaborador, janela))
    .map((recompensa) => {
      const registrada = liberadas.some(
        (l) =>
          l.recompensaId === recompensa.id &&
          l.colaboradorId === colaborador.id &&
          l.janela === janela.chave,
      );
      if (recompensa.condicao.tipo === "meta") {
        const meta = fontes.metas.find(
          (m) => m.id === (recompensa.condicao as { metaId: string }).metaId,
        );
        const progresso = meta ? medirMeta(meta, colaborador, fontes, janela) : null;
        return {
          recompensa,
          janela,
          atual: progresso?.atual ?? null,
          liberada: progresso?.batida ?? false,
          progresso: progresso?.progresso ?? 0,
          registrada,
          condicao: descreverRecompensa(recompensa, fontes.metas),
        };
      }
      const { metrica, operador, valor } = recompensa.condicao;
      const atual = medirMetrica(metrica, colaborador, janela, fontes);
      return {
        recompensa,
        janela,
        atual,
        liberada: atende(atual, operador, valor),
        progresso: progressoDaCondicao(atual, operador, valor),
        registrada,
        condicao: descreverRecompensa(recompensa, fontes.metas),
      };
    });
}

export function recompensasALiberar(
  colaborador: Colaborador,
  recompensas: Recompensa[],
  liberadas: RecompensaLiberada[],
  janela: Janela,
  fontes: FontesMetricas,
): RecompensaNaJanela[] {
  return recompensasNaJanela(colaborador, recompensas, liberadas, janela, fontes).filter(
    (r) => r.liberada && !r.registrada && r.recompensa.valor > 0,
  );
}

/** `R$ 100,00 · semana de 15/09`. */
export function rotuloRecompensaLiberada(liberada: RecompensaLiberada): string {
  return `${formatBRL(liberada.valor)} · ${rotuloDaJanela(liberada.janela)}`;
}
