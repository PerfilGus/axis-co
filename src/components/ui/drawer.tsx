"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";
import { Botao } from "./button";

/**
 * Drawer: painel lateral no desktop, folha inferior no mobile.
 * Usa o mesmo primitivo do modal, com foco preso e fechamento por Esc.
 */
export const Gaveta = DialogPrimitive.Root;
export const GavetaGatilho = DialogPrimitive.Trigger;
export const GavetaFechar = DialogPrimitive.Close;

export function GavetaConteudo({
  className,
  children,
  larguraMaxima = "sm:max-w-xl",
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  larguraMaxima?: string;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className={cn(
          "fixed inset-0 z-50 bg-[var(--overlay)] backdrop-blur-[2px]",
          "data-[state=open]:[animation:axis-overlay-in_160ms_ease-out]",
        )}
      />
      <DialogPrimitive.Content
        className={cn(
          "fixed z-50 flex flex-col border-border bg-surface-1",
          // mobile: folha inferior
          "inset-x-0 bottom-0 max-h-[88vh] rounded-t-[var(--radius-card)] border-t",
          "data-[state=open]:[animation:axis-slide-bottom_220ms_cubic-bezier(0.32,0.72,0,1)]",
          // desktop: painel à direita
          "sm:inset-y-0 sm:right-0 sm:left-auto sm:h-full sm:max-h-none sm:w-full sm:rounded-none sm:rounded-l-[var(--radius-card)] sm:border-t-0 sm:border-l",
          "sm:data-[state=open]:[animation:axis-slide-right_240ms_cubic-bezier(0.32,0.72,0,1)]",
          larguraMaxima,
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function GavetaCabecalho({
  titulo,
  descricao,
  acoes,
  className,
}: {
  titulo: React.ReactNode;
  descricao?: React.ReactNode;
  acoes?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-start justify-between gap-4 border-b border-border p-5",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <DialogPrimitive.Title className="truncate text-xl font-medium tracking-tight">
          {titulo}
        </DialogPrimitive.Title>
        {descricao ? (
          <DialogPrimitive.Description asChild>
            <div className="text-[13px] text-muted-fg">{descricao}</div>
          </DialogPrimitive.Description>
        ) : (
          <DialogPrimitive.Description className="sr-only">
            Detalhe
          </DialogPrimitive.Description>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {acoes}
        <GavetaFechar asChild>
          <Botao variante="secundaria" tamanho="sm">
            <X weight="bold" />
            Fechar
          </Botao>
        </GavetaFechar>
      </div>
    </div>
  );
}

export function GavetaCorpo({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("min-h-0 flex-1 overflow-y-auto p-5", className)} {...props} />;
}

export function GavetaRodape({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-end gap-2 border-t border-border p-5",
        className,
      )}
      {...props}
    />
  );
}
