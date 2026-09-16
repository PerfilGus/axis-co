"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

export const ProvedorDica = TooltipPrimitive.Provider;

export function Dica({
  conteudo,
  children,
  lado = "bottom",
}: {
  conteudo: React.ReactNode;
  children: React.ReactNode;
  lado?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <TooltipPrimitive.Root delayDuration={250}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={lado}
          sideOffset={8}
          className={cn(
            "z-50 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-xs text-fg",
            "data-[state=delayed-open]:[animation:axis-in_120ms_ease-out]",
          )}
        >
          {conteudo}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
