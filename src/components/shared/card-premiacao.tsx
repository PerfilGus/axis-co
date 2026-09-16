import { cn } from "@/lib/utils";
import { Icone, type NomeIcone } from "@/components/icone";

/**
 * Card de premiação — metas, conquistas e níveis. É o único lugar onde o
 * gradiente da cor de destaque aparece; telas operacionais nunca o usam.
 */
export function CardPremiacao({
  icone = "ranking",
  titulo,
  descricao,
  rodape,
  progresso,
  className,
  animar = false,
}: {
  icone?: NomeIcone;
  titulo: string;
  descricao?: string;
  rodape?: React.ReactNode;
  /** 0 a 1. Omita para um card sem barra. */
  progresso?: number;
  className?: string;
  /** Liga a animação de premiação (bateu meta, subiu de nível). */
  animar?: boolean;
}) {
  const pct = progresso === undefined ? null : Math.min(Math.max(progresso, 0), 1);
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[var(--radius-card)] p-5 text-[var(--accent-fg)]",
        animar && "[animation:axis-premio_420ms_cubic-bezier(0.22,1,0.36,1)]",
        className,
      )}
      style={{
        background:
          "linear-gradient(135deg, var(--accent) 0%, color-mix(in oklab, var(--accent) 72%, #ffffff) 100%)",
      }}
    >
      <span
        className="pointer-events-none absolute -top-10 -right-8 size-40 rounded-full opacity-20"
        style={{ background: "radial-gradient(circle, #fff 0%, transparent 70%)" }}
        aria-hidden
      />
      <div className="relative flex items-start gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--accent-fg)]/12">
          <Icone nome={icone} size={22} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-base leading-tight font-medium">{titulo}</p>
          {descricao && (
            <p className="text-[13px] opacity-75">{descricao}</p>
          )}
        </div>
      </div>

      {pct !== null && (
        <div className="relative mt-5">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--accent-fg)]/15">
            <div
              className="h-full rounded-full bg-[var(--accent-fg)] transition-[width] duration-500"
              style={{ width: `${pct * 100}%` }}
            />
          </div>
        </div>
      )}

      {rodape && <div className="relative mt-4 text-[13px]">{rodape}</div>}
    </div>
  );
}
