"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "@/lib/utils";

export function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "text-[13px] font-medium text-muted-fg select-none",
        "peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

/** Campo = rótulo + controle + ajuda/erro, com o espaçamento padrão. */
export function Campo({
  rotulo,
  ajuda,
  erro,
  obrigatorio,
  children,
  className,
}: {
  rotulo: string;
  ajuda?: string;
  erro?: string | null;
  obrigatorio?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label>
        {rotulo}
        {obrigatorio && <span className="text-[var(--accent)]"> *</span>}
      </Label>
      {children}
      {erro ? (
        <p className="text-xs text-[var(--st-vermelho-fg)]">{erro}</p>
      ) : ajuda ? (
        <p className="text-xs text-muted-fg/80">{ajuda}</p>
      ) : null}
    </div>
  );
}
