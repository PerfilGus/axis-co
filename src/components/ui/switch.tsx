"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

export function Interruptor({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="interruptor"
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-border transition-colors",
        "data-[state=unchecked]:bg-surface-3 data-[state=checked]:border-[var(--accent)] data-[state=checked]:bg-[var(--accent)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block size-4.5 rounded-full bg-fg transition-transform",
          "data-[state=unchecked]:translate-x-0.5 data-[state=checked]:translate-x-[22px]",
          "data-[state=checked]:bg-[var(--accent-fg)]",
        )}
      />
    </SwitchPrimitive.Root>
  );
}
