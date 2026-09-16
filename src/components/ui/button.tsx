"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Botão em pílula — o formato padrão da linguagem visual.
 * Ações secundárias são pílulas escuras com ícone + texto.
 */
const botaoVariantes = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap transition-colors outline-none select-none disabled:pointer-events-none disabled:opacity-45 [&_svg]:shrink-0",
  {
    variants: {
      variante: {
        principal:
          "bg-[var(--accent)] text-[var(--accent-fg)] hover:brightness-[1.08] active:brightness-95",
        secundaria:
          "bg-surface-2 text-fg hover:bg-surface-3 border border-transparent",
        contorno:
          "border border-border bg-transparent text-fg hover:bg-surface-2 hover:border-border-strong",
        fantasma: "bg-transparent text-muted-fg hover:bg-surface-2 hover:text-fg",
        destaqueSuave:
          "bg-[var(--accent-soft)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--accent-fg)]",
        perigo:
          "bg-[var(--st-vermelho-bg)] text-[var(--st-vermelho-fg)] hover:brightness-110",
      },
      tamanho: {
        sm: "h-8 px-3.5 text-[13px] [&_svg]:size-4",
        md: "h-10 px-4.5 text-sm [&_svg]:size-[18px]",
        lg: "h-12 px-6 text-[15px] [&_svg]:size-5",
        icone: "size-10 p-0 [&_svg]:size-[18px]",
        iconeSm: "size-8 p-0 [&_svg]:size-4",
        iconeLg: "size-12 p-0 [&_svg]:size-5",
      },
    },
    defaultVariants: { variante: "secundaria", tamanho: "md" },
  },
);

export interface BotaoProps
  extends React.ComponentProps<"button">,
    VariantProps<typeof botaoVariantes> {
  asChild?: boolean;
}

export function Botao({
  className,
  variante,
  tamanho,
  asChild = false,
  ...props
}: BotaoProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="botao"
      className={cn(botaoVariantes({ variante, tamanho }), className)}
      {...props}
    />
  );
}

/**
 * Ação principal de adicionar: círculo preenchido com a cor de destaque.
 * Pode aparecer colado a um valor, como o saldo com "+" da referência.
 */
export function BotaoAdicionar({
  className,
  tamanho = "icone",
  ...props
}: Omit<BotaoProps, "variante">) {
  return (
    <Botao
      variante="principal"
      tamanho={tamanho}
      className={cn("shadow-none", className)}
      aria-label={props["aria-label"] ?? "Adicionar"}
      {...props}
    />
  );
}

/**
 * Agrupa ações relacionadas dentro de uma mesma pílula, com divisor fino.
 */
export function GrupoPilula({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full bg-surface-2 p-1",
        "[&>*]:rounded-full [&>*:not(:first-child)]:border-l [&>*:not(:first-child)]:border-border",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export { botaoVariantes };
