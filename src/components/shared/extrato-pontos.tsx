"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { EventoPontos, LancamentoPontos } from "@/lib/types";
import { formatDataHoraCurta, formatNumero } from "@/lib/format";
import { periodoDoPreset, type PeriodoAnalise } from "@/lib/periodos";
import { useEquipe } from "@/lib/providers/equipe";
import { Icone, type NomeIcone } from "@/components/icone";
import { EstadoVazio } from "./estado-vazio";
import { SeletorPeriodo } from "./seletor-periodo";

/**
 * Extrato de pontos de um colaborador: cada lançamento com pedido, evento,
 * pontos e data. É a mesma lista na Minha área e na gaveta do Admin.
 *
 * O período fica na tela; a busca vai ao servidor, porque a sessão só carrega
 * o mês passado e este.
 */

const ICONE_EVENTO: Record<EventoPontos, NomeIcone> = {
  agendamento: "calendario",
  cancelamento: "proibido",
  cancelamento_revertido: "atualizar",
  frustracao: "alerta",
  frustracao_revertida: "atualizar",
  pagamento: "dinheiro",
  pagamento_revertido: "atualizar",
  exclusao: "excluir",
  conquista: "medalha",
};

export function ExtratoPontos({
  colaboradorId,
  className,
}: {
  colaboradorId: string;
  className?: string;
}) {
  const { extratoDePontos } = useEquipe();
  const [periodo, setPeriodo] = useState<PeriodoAnalise>(() => periodoDoPreset("30d"));
  // A chave do pedido em andamento: resposta de busca antiga não sobrescreve a nova.
  const chave = `${colaboradorId}|${periodo.de}|${periodo.ate}`;
  const [resposta, setResposta] = useState<{ chave: string; linhas: LancamentoPontos[] } | null>(null);
  const linhas = resposta?.chave === chave ? resposta.linhas : null;

  useEffect(() => {
    let atual = true;
    extratoDePontos(colaboradorId, periodo.de, periodo.ate).then((lista) => {
      if (atual) setResposta({ chave, linhas: lista ?? [] });
    });
    return () => {
      atual = false;
    };
  }, [chave, colaboradorId, periodo.de, periodo.ate, extratoDePontos]);

  const total = (linhas ?? []).reduce((s, l) => s + l.pontos, 0);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SeletorPeriodo valor={periodo} aoMudar={setPeriodo} />
        <span className="tabular text-[13px]">
          <span className="text-muted-fg">No período: </span>
          <span className={cn("font-medium", total < 0 && "text-[var(--st-vermelho-fg)]")}>
            {total > 0 ? "+" : ""}
            {formatNumero(total)} pts
          </span>
        </span>
      </div>

      {linhas === null ? (
        <p className="py-6 text-center text-[13px] text-muted-fg">Carregando o extrato…</p>
      ) : linhas.length === 0 ? (
        <EstadoVazio
          compacto
          icone="lista"
          titulo="Nenhum lançamento no período"
          descricao="Pontos aparecem aqui assim que um pedido muda de status."
        />
      ) : (
        <ul className="flex flex-col">
          {linhas.map((l) => (
            <li
              key={l.id}
              className="flex items-center gap-3 border-b border-border py-2.5 last:border-b-0"
            >
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full",
                  l.pontos >= 0 ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "bg-surface-2 text-muted-fg",
                )}
              >
                <Icone nome={ICONE_EVENTO[l.evento]} size={15} />
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[13px]">{l.descricao}</span>
                <span className="tabular text-xs text-muted-fg">
                  {l.pedidoCodigo ? `${l.pedidoCodigo} · ` : ""}
                  {formatDataHoraCurta(l.ocorridoEm)}
                </span>
              </div>
              <span
                className={cn(
                  "tabular shrink-0 text-sm font-medium",
                  l.pontos < 0 && "text-[var(--st-vermelho-fg)]",
                )}
              >
                {l.pontos > 0 ? "+" : ""}
                {formatNumero(l.pontos)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
