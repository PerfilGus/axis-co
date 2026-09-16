"use client";

import { cn } from "@/lib/utils";
import { Icone, type NomeIcone } from "@/components/icone";
import { Contador } from "@/components/ui/badge";

export interface OpcaoSegmento<T extends string> {
  valor: T;
  rotulo: string;
  icone?: NomeIcone;
  contador?: number;
}

/**
 * Controle segmentado em pílula. O item selecionado recebe a cor de destaque
 * preenchida; os demais ficam em texto secundário.
 */
export function ControleSegmentado<T extends string>({
  opcoes,
  valor,
  aoMudar,
  className,
  tamanho = "md",
}: {
  opcoes: OpcaoSegmento<T>[];
  valor: T;
  aoMudar: (valor: T) => void;
  className?: string;
  tamanho?: "sm" | "md";
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "scrollbar-none inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-surface-2 p-1",
        className,
      )}
    >
      {opcoes.map((opcao) => {
        const ativo = opcao.valor === valor;
        return (
          <button
            key={opcao.valor}
            role="tab"
            aria-selected={ativo}
            onClick={() => aoMudar(opcao.valor)}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-full font-medium whitespace-nowrap transition-colors",
              tamanho === "sm" ? "h-7 px-3 text-xs" : "h-9 px-4 text-[13px]",
              ativo
                ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                : "text-muted-fg hover:bg-surface-3 hover:text-fg",
            )}
          >
            {opcao.icone && <Icone nome={opcao.icone} size={tamanho === "sm" ? 13 : 15} />}
            {opcao.rotulo}
            {typeof opcao.contador === "number" && opcao.contador > 0 && (
              <Contador valor={opcao.contador} ativo={ativo} />
            )}
          </button>
        );
      })}
    </div>
  );
}

export interface OpcaoChip<T extends string> {
  valor: T;
  rotulo: string;
  /** Linha de cima do chip, como o dia do mês na referência. */
  marcador?: string;
}

/**
 * Chips verticais arredondados para seletores de dia ou período, com
 * marcador em ponto acima do texto. O selecionado recebe contorno na cor de
 * destaque, não preenchimento.
 */
export function ChipsPeriodo<T extends string>({
  opcoes,
  valor,
  aoMudar,
  className,
}: {
  opcoes: OpcaoChip<T>[];
  valor: T;
  aoMudar: (valor: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("scrollbar-none flex gap-2 overflow-x-auto", className)}>
      {opcoes.map((opcao) => {
        const ativo = opcao.valor === valor;
        return (
          <button
            key={opcao.valor}
            onClick={() => aoMudar(opcao.valor)}
            aria-pressed={ativo}
            className={cn(
              "flex w-14 shrink-0 flex-col items-center gap-1.5 rounded-full border py-3 transition-colors",
              ativo
                ? "border-[var(--accent)] bg-transparent text-fg"
                : "border-transparent bg-surface-2 text-muted-fg hover:bg-surface-3",
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                ativo ? "bg-[var(--accent)]" : "bg-muted-fg/40",
              )}
              aria-hidden
            />
            {opcao.marcador && (
              <span className="tabular text-sm leading-none font-medium">
                {opcao.marcador}
              </span>
            )}
            <span className="text-[11px] leading-none">{opcao.rotulo}</span>
          </button>
        );
      })}
    </div>
  );
}
