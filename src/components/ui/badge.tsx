import * as React from "react";
import { cn } from "@/lib/utils";

/** Badge genérico em pílula. Cores de status vêm do SeloStatus. */
export function Badge({
  className,
  tom = "neutro",
  ...props
}: React.ComponentProps<"span"> & { tom?: "neutro" | "destaque" | "contorno" }) {
  return (
    <span
      data-slot="badge"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        tom === "neutro" && "bg-surface-3 text-muted-fg",
        tom === "destaque" && "bg-[var(--accent)] text-[var(--accent-fg)]",
        tom === "contorno" && "border border-border text-muted-fg",
        className,
      )}
      {...props}
    />
  );
}

/** Contador numérico usado nas subabas. */
export function Contador({
  valor,
  ativo,
  className,
}: {
  valor: number;
  ativo?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "tabular inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-medium",
        ativo
          ? "bg-[var(--accent-fg)]/15 text-[var(--accent-fg)]"
          : "bg-surface-3 text-muted-fg",
        className,
      )}
    >
      {valor}
    </span>
  );
}
