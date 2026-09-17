"use client";

import { useState } from "react";
import type { Colaborador, Meta, PeriodoMeta, Recompensa, RecompensaLiberada } from "@/lib/types";
import { formatBRL } from "@/lib/format";
import { janelaCorrente } from "@/lib/periodos";
import { medirMeta } from "@/lib/metas";
import { formatarMetrica, type FontesMetricas } from "@/lib/metricas";
import { recompensaVale } from "@/lib/recompensas";
import { Icone } from "@/components/icone";
import { Card } from "@/components/ui/card";
import { CardPremiacao } from "@/components/shared/card-premiacao";
import { ControleSegmentado } from "@/components/shared/controles";
import { EstadoVazio } from "@/components/shared/estado-vazio";

const ROTULO_JANELA: Record<PeriodoMeta, string> = {
  diaria: "Hoje",
  semanal: "Semana",
  mensal: "Mês",
};

/**
 * A meta da janela numa barra que enche até o alvo, com a recompensa que vem
 * junto. Batida, vira o card de premiação.
 */
export function MetaDoPeriodo({
  colaborador,
  metas,
  recompensas,
  liberadas,
  fontes,
}: {
  colaborador: Colaborador;
  /** Só as ativas do colaborador, já ordenadas. */
  metas: Meta[];
  recompensas: Recompensa[];
  liberadas: RecompensaLiberada[];
  fontes: FontesMetricas;
}) {
  const [metaId, setMetaId] = useState<string | null>(null);
  const meta = metas.find((m) => m.id === metaId) ?? metas[0];

  if (!meta) {
    return (
      <EstadoVazio
        compacto
        icone="metas"
        titulo="Você ainda não tem meta ativa"
        descricao="Quando o Admin cadastrar a sua em Pontos e metas, o progresso aparece aqui."
      />
    );
  }

  const periodosRepetidos = new Set(metas.map((m) => m.periodo)).size < metas.length;
  const seletor =
    metas.length > 1 ? (
      <ControleSegmentado
        tamanho="sm"
        valor={meta.id}
        aoMudar={setMetaId}
        opcoes={metas.map((m) => ({
          valor: m.id,
          rotulo: periodosRepetidos ? m.nome : ROTULO_JANELA[m.periodo],
        }))}
      />
    ) : null;

  const janela = janelaCorrente(meta.periodo);
  const { atual, batida, progresso } = medirMeta(meta, colaborador, fontes, janela);

  // O que essa meta paga: recompensa com condição nesta meta, valendo na janela.
  const premios = recompensas.filter(
    (r) =>
      r.condicao.tipo === "meta" &&
      r.condicao.metaId === meta.id &&
      recompensaVale(r, colaborador, janela),
  );
  const valorDosPremios = premios.reduce((s, r) => s + r.valor, 0);
  const jaLiberada = liberadas.some(
    (l) => premios.some((p) => p.id === l.recompensaId) && l.janela === janela.chave,
  );

  const alvo = formatarMetrica(meta.metrica, meta.alvo);
  const agora = formatarMetrica(meta.metrica, atual);

  if (batida) {
    return (
      <div className="flex flex-col gap-3">
        {seletor}
        <CardPremiacao
          key={`${meta.id}-${janela.chave}`}
          animar
          icone="ranking"
          titulo="Meta batida!"
          descricao={`${meta.nome}: ${agora} de ${alvo}.`}
          rodape={
            valorDosPremios > 0
              ? jaLiberada
                ? `Recompensa de ${formatBRL(valorDosPremios)} já liberada; entra no fechamento do mês.`
                : `Vale ${formatBRL(valorDosPremios)}, liberado quando a janela fechar.`
              : "Sem recompensa em dinheiro nesta meta — mas os pontos do período seguem contando."
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {seletor}
      <Card className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 className="text-base font-medium tracking-tight">{meta.nome}</h2>
            <p className="tabular text-[13px] text-muted-fg">
              {agora} de {alvo}
            </p>
          </div>
          {valorDosPremios > 0 && (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-[13px] font-medium text-fg">
              <Icone nome="dinheiro" size={14} className="text-[var(--accent)]" />
              {formatBRL(valorDosPremios)}
            </span>
          )}
        </div>

        <div
          role="progressbar"
          aria-label={`Progresso de ${meta.nome}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progresso * 100)}
          className="h-3 w-full overflow-hidden rounded-full bg-surface-3"
        >
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-500"
            style={{ width: `${progresso * 100}%` }}
          />
        </div>

        <p className="text-[13px] text-muted-fg">
          {ROTULO_JANELA[meta.periodo]}: falta chegar a{" "}
          <span className="tabular font-medium text-fg">{alvo}</span>
          {valorDosPremios > 0 && ` para ganhar ${formatBRL(valorDosPremios)}`}.
        </p>
      </Card>
    </div>
  );
}
