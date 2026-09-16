"use client";

import { cn } from "@/lib/utils";
import { Icone } from "@/components/icone";

export interface OpcaoMultipla {
  valor: string;
  rotulo: string;
  detalhe?: string;
}

/**
 * Seleção múltipla em pílulas. Cabe bem até uma dúzia de opções — vendedores
 * de uma linha ou de um cobrador — sem esconder nada atrás de um menu.
 */
export function SelecaoMultipla({
  opcoes,
  valores,
  aoMudar,
  vazio = "Nenhuma opção disponível.",
  className,
}: {
  opcoes: OpcaoMultipla[];
  valores: string[];
  aoMudar: (valores: string[]) => void;
  vazio?: string;
  className?: string;
}) {
  if (opcoes.length === 0) {
    return <p className="text-[13px] text-muted-fg">{vazio}</p>;
  }
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {opcoes.map((opcao) => {
        const ativo = valores.includes(opcao.valor);
        return (
          <button
            key={opcao.valor}
            type="button"
            aria-pressed={ativo}
            onClick={() =>
              aoMudar(
                ativo ? valores.filter((v) => v !== opcao.valor) : [...valores, opcao.valor],
              )
            }
            className={cn(
              "inline-flex items-center gap-2 rounded-full border py-1.5 pr-3.5 pl-2.5 text-[13px] transition-colors",
              ativo
                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-fg"
                : "border-border text-muted-fg hover:border-border-strong hover:text-fg",
            )}
          >
            <span
              className={cn(
                "flex size-4 items-center justify-center rounded-full",
                ativo ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "border border-border-strong",
              )}
            >
              {ativo && <Icone nome="check" size={10} weight="bold" />}
            </span>
            {opcao.rotulo}
            {opcao.detalhe && <span className="text-xs text-muted-fg">{opcao.detalhe}</span>}
          </button>
        );
      })}
    </div>
  );
}
