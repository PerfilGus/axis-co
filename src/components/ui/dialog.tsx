"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";
import { Botao } from "./button";

export const Modal = DialogPrimitive.Root;
export const ModalGatilho = DialogPrimitive.Trigger;
export const ModalFechar = DialogPrimitive.Close;

function Fundo({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        "fixed inset-0 z-50 bg-[var(--overlay)] backdrop-blur-[2px]",
        "data-[state=open]:[animation:axis-overlay-in_160ms_ease-out]",
        className,
      )}
      {...props}
    />
  );
}

export function ModalConteudo({
  className,
  children,
  larguraMaxima = "max-w-lg",
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  larguraMaxima?: string;
}) {
  return (
    <DialogPrimitive.Portal>
      <Fundo />
      <DialogPrimitive.Content
        className={cn(
          "fixed top-1/2 left-1/2 z-50 w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2",
          "max-h-[calc(100vh-4rem)] overflow-y-auto rounded-[var(--radius-card)] border border-border bg-surface-1 p-6",
          "data-[state=open]:[animation:axis-in_180ms_ease-out]",
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

export function ModalCabecalho({
  titulo,
  descricao,
  className,
}: {
  titulo: string;
  descricao?: string;
  className?: string;
}) {
  return (
    <div className={cn("mb-5 flex items-start justify-between gap-4", className)}>
      <div className="flex flex-col gap-1">
        <DialogPrimitive.Title className="text-xl font-medium tracking-tight">
          {titulo}
        </DialogPrimitive.Title>
        {descricao ? (
          <DialogPrimitive.Description className="text-[13px] text-muted-fg">
            {descricao}
          </DialogPrimitive.Description>
        ) : (
          <DialogPrimitive.Description className="sr-only">
            {titulo}
          </DialogPrimitive.Description>
        )}
      </div>
      <ModalFechar asChild>
        <Botao variante="secundaria" tamanho="sm" className="-mt-1">
          <X weight="bold" />
          Fechar
        </Botao>
      </ModalFechar>
    </div>
  );
}

export function ModalRodape({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}
