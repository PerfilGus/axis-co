"use client";

import { useState } from "react";
import type { Colaborador, Meta, PeriodoMeta, Pedido } from "@/lib/types";
import { formatBRL, formatBps } from "@/lib/format";
import { faixasOrdenadas, medirMeta } from "@/lib/metas";
import { janelaDaMeta } from "@/lib/periodos";
import { unidadeDaMeta, valorDaFaixa } from "@/lib/minha-area";
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
 * A meta do período numa barra que enche até a próxima faixa, com o que ele
 * ganha ao bater. Batida a primeira faixa, vira o card de premiação.
 */
export function MetaDoPeriodo({
  colaborador,
  metas,
  pedidos,
}: {
  colaborador: Colaborador;
  /** Só as ativas do colaborador, já ordenadas. */
  metas: Meta[];
  pedidos: Pedido[];
}) {
  const [metaId, setMetaId] = useState<string | null>(null);
  const meta = metas.find((m) => m.id === metaId) ?? metas[0];

  if (!meta) {
    return (
      <EstadoVazio
        compacto
        icone="metas"
        titulo="Você ainda não tem meta ativa"
        descricao="Quando o Admin cadastrar a sua em Metas, níveis e conquistas, o progresso aparece aqui."
      />
    );
  }

  const faixas = faixasOrdenadas(meta);
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

  if (faixas.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        {seletor}
        <EstadoVazio
          compacto
          icone="metas"
          titulo={`${meta.nome} ainda sem faixas`}
          descricao="A meta existe, mas sem alvo. Peça ao Admin para definir as faixas."
        />
      </div>
    );
  }

  const janela = janelaDaMeta(meta.periodo);
  const { atual, atingida, proxima, progresso } = medirMeta(meta, colaborador, pedidos, janela);

  const recompensa = (faixa: (typeof faixas)[number]) => {
    const { valor, estimado } = valorDaFaixa(faixa, colaborador, pedidos, janela);
    if (!estimado) return `+${formatBRL(valor)}`;
    return `+${formatBps(faixa.valor)} de comissão${valor > 0 ? ` (≈ ${formatBRL(valor)} até agora)` : ""}`;
  };
  /** `Falta 1 agendado` ou `Faltam R$ 200,00`. */
  const falta = (alvo: number) => {
    const resto = Math.max(alvo - atual, 0);
    const verbo = meta.tipo === "pedidos" && resto === 1 ? "Falta" : "Faltam";
    return `${verbo} ${unidadeDaMeta(colaborador, meta.tipo, resto)}`;
  };

  if (atingida) {
    return (
      <div className="flex flex-col gap-3">
        {seletor}
        <CardPremiacao
          key={`${meta.id}-${atingida.id}`}
          animar
          icone="ranking"
          titulo={proxima ? "Meta batida!" : "Todas as faixas batidas!"}
          descricao={`${meta.nome}: ${unidadeDaMeta(colaborador, meta.tipo, atual)}. Você garantiu ${recompensa(atingida)}.`}
          progresso={proxima ? progresso : undefined}
          rodape={
            proxima
              ? `${falta(proxima.alvo)} para a próxima faixa: ${recompensa(proxima)}. Vale a faixa mais alta, não a soma.`
              : "Não há faixa acima desta no período. Aproveite o embalo para a próxima conquista."
          }
        />
      </div>
    );
  }

  const alvo = proxima ?? faixas[faixas.length - 1];

  return (
    <div className="flex flex-col gap-3">
      {seletor}
      <Card className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 className="text-base font-medium tracking-tight">{meta.nome}</h2>
            <p className="tabular text-[13px] text-muted-fg">
              {unidadeDaMeta(colaborador, meta.tipo, atual)} de{" "}
              {unidadeDaMeta(colaborador, meta.tipo, alvo.alvo)}
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-[13px] font-medium text-fg">
            <Icone nome="dinheiro" size={14} className="text-[var(--accent)]" />
            {recompensa(alvo)}
          </span>
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
          <span className="tabular font-medium text-fg">{falta(alvo.alvo)}</span> para ganhar{" "}
          {recompensa(alvo)}.
          {faixas.length > 1 && ` São ${faixas.length} faixas; vale a mais alta que você bater.`}
        </p>
      </Card>
    </div>
  );
}
