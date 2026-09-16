import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Card: raio grande, superfície levemente mais clara que o fundo,
 * sem sombra no tema escuro.
 */
export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "rounded-[var(--radius-card)] border border-border bg-surface-1 text-fg",
        className,
      )}
      {...props}
    />
  );
}

export function CardCabecalho({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-cabecalho"
      className={cn("flex items-start justify-between gap-3 p-5 pb-0", className)}
      {...props}
    />
  );
}

export function CardTitulo({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      data-slot="card-titulo"
      className={cn("text-base font-medium tracking-tight", className)}
      {...props}
    />
  );
}

export function CardDescricao({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="card-descricao"
      className={cn("text-[13px] text-muted-fg", className)}
      {...props}
    />
  );
}

export function CardConteudo({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-conteudo" className={cn("p-5", className)} {...props} />;
}

export function CardRodape({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-rodape"
      className={cn("flex items-center gap-2 border-t border-border p-5", className)}
      {...props}
    />
  );
}
