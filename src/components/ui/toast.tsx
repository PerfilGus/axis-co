"use client";

import { Toaster as Sonner, toast } from "sonner";
import { CheckCircle, Info, WarningCircle } from "@phosphor-icons/react/ssr";

/**
 * Toast restilizado: pílula escura, ícone sólido, sem sombra no tema escuro.
 */
export function Avisos() {
  return (
    <Sonner
      position="bottom-right"
      offset={20}
      gap={10}
      icons={{
        success: <CheckCircle size={18} weight="fill" />,
        error: <WarningCircle size={18} weight="fill" />,
        info: <Info size={18} weight="fill" />,
        warning: <WarningCircle size={18} weight="fill" />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex w-full items-center gap-3 rounded-full border border-border bg-surface-2 px-4 py-3 text-sm text-fg",
          title: "font-medium",
          description: "text-[13px] text-muted-fg",
          success: "[&_[data-icon]]:text-[var(--st-verde-fg)]",
          error: "[&_[data-icon]]:text-[var(--st-vermelho-fg)]",
          info: "[&_[data-icon]]:text-[var(--st-azul-fg)]",
          warning: "[&_[data-icon]]:text-[var(--st-laranja-fg)]",
          actionButton:
            "ml-auto rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-medium text-[var(--accent-fg)]",
          closeButton: "rounded-full border border-border bg-surface-3 text-muted-fg",
        },
      }}
    />
  );
}

export { toast };
