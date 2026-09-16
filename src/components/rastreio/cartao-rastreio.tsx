"use client";

import { cn } from "@/lib/utils";
import type { Pedido } from "@/lib/types";
import { formatBRL, formatHa, formatTelefone } from "@/lib/format";
import { corComOpacidade, coresRastreio } from "@/lib/status";
import { atualizacaoDe } from "@/lib/rastreio/lista";
import { Icone } from "@/components/icone";
import { SeloStatusRastreio } from "@/components/shared/selo-status";

type PedidoRastreado = Pedido & { rastreio: NonNullable<Pedido["rastreio"]> };

/**
 * Card da lista de rastreio. Campos na mesma ordem do axis-tracking
 * (INVENTARIO.md §6):
 *
 * 1. código monoespaçado + badge de status
 * 2. nome do cliente
 * 3. telefone + tempo desde a última atualização
 * 4. último evento dos Correios, no lugar do endereço
 * 5. motivo da falha à esquerda + valor à direita
 *
 * Destacado = atualização ainda não vista: o card **inteiro** ganha 15% da cor
 * do status. Lido = superfície neutra, com a cor só na barra lateral e no
 * texto do status.
 */
export function CartaoRastreio({
  pedido,
  selecionado,
  marcado,
  modoSelecao,
  aoClicar,
}: {
  pedido: PedidoRastreado;
  selecionado: boolean;
  marcado: boolean;
  modoSelecao: boolean;
  aoClicar: () => void;
}) {
  const { rastreio } = pedido;
  const { base, texto } = coresRastreio(rastreio.status);
  const ultimoEvento = rastreio.eventos[0]?.titulo ?? "";

  return (
    <button
      type="button"
      onClick={aoClicar}
      aria-pressed={modoSelecao ? marcado : undefined}
      className={cn(
        "relative flex flex-col gap-2.5 rounded-[var(--radius-card-sm)] p-4 text-left transition-colors",
        "border border-border",
        selecionado && !modoSelecao && "border-[var(--accent)]",
        marcado && "border-[var(--accent)]",
      )}
      style={{
        // Borda esquerda de 3px na cor do status, sempre.
        borderLeft: `3px solid ${base}`,
        backgroundColor: rastreio.destacado
          ? corComOpacidade(base, 0.15)
          : "var(--surface-2)",
      }}
    >
      {modoSelecao && (
        <span
          className={cn(
            "absolute top-3 right-3 flex size-5 items-center justify-center rounded-md border transition-colors",
            marcado
              ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]"
              : "border-border-strong bg-surface-input text-transparent",
          )}
          aria-hidden
        >
          <Icone nome="check" size={12} weight="bold" />
        </span>
      )}

      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-[13px] font-medium tracking-tight">
          {rastreio.codigo}
        </span>
        {!modoSelecao && <SeloStatusRastreio status={rastreio.status} />}
      </div>

      <div className="text-sm font-medium">
        {pedido.cliente.nome || (
          <span className="text-muted-fg">Sem nome</span>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 text-[12px]">
        <span className="tabular text-muted-fg">
          {formatTelefone(pedido.cliente.telefone)}
        </span>
        <span className="text-muted-fg">{formatHa(atualizacaoDe(pedido))}</span>
      </div>

      <div className="line-clamp-2 text-[12px] leading-snug text-fg/80">
        {ultimoEvento || (
          <span className="text-muted-fg">Sem eventos de rastreio</span>
        )}
      </div>

      <div className="flex items-end justify-between gap-3 pt-0.5">
        {rastreio.status === "falha" && rastreio.motivoFalha ? (
          <span
            className="flex items-center gap-1.5 text-[12px] leading-snug"
            style={{ color: texto }}
          >
            <Icone nome="alerta" size={13} className="shrink-0" />
            {rastreio.motivoFalha}
          </span>
        ) : (
          <span />
        )}
        <span className="tabular shrink-0 text-sm font-medium">
          {formatBRL(pedido.valorTotal)}
        </span>
      </div>
    </button>
  );
}
