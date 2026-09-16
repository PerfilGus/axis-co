"use client";

import { cn } from "@/lib/utils";
import { DESTAQUES, useAparencia, type Tema } from "@/lib/providers/aparencia";
import { Icone } from "@/components/icone";

const TEMAS: Array<{ chave: Tema; rotulo: string; icone: "lua" | "sol" }> = [
  { chave: "escuro", rotulo: "Escuro", icone: "lua" },
  { chave: "claro", rotulo: "Claro", icone: "sol" },
];

/** Tema escuro ou claro, com uma miniatura de cada. */
export function SeletorTema({ className }: { className?: string }) {
  const { tema, definirTema } = useAparencia();
  return (
    <div role="radiogroup" aria-label="Tema" className={cn("grid grid-cols-2 gap-3", className)}>
      {TEMAS.map((opcao) => {
        const ativo = tema === opcao.chave;
        return (
          <button
            key={opcao.chave}
            role="radio"
            onClick={() => definirTema(opcao.chave)}
            aria-checked={ativo}
            className={cn(
              "flex flex-col gap-3 rounded-[var(--radius-card-sm)] border p-4 text-left transition-colors",
              ativo ? "border-[var(--accent)]" : "border-border hover:border-border-strong",
            )}
          >
            <span
              className="flex h-16 items-end gap-1.5 rounded-[var(--radius-input)] border border-border p-2"
              style={{ backgroundColor: opcao.chave === "escuro" ? "#121212" : "#eaeaea" }}
              aria-hidden
            >
              <span
                className="h-4 flex-1 rounded-full"
                style={{ backgroundColor: opcao.chave === "escuro" ? "#202020" : "#fbfbfa" }}
              />
              <span className="h-4 w-8 rounded-full" style={{ backgroundColor: "var(--accent)" }} />
            </span>
            <span className="flex items-center gap-2 text-[13px] font-medium">
              <Icone nome={opcao.icone} size={15} />
              {opcao.rotulo}
              {ativo && (
                <Icone nome="checkCircle" size={15} className="ml-auto text-[var(--accent)]" />
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** As oito cores de destaque. As de status nunca acompanham a escolha. */
export function SeletorDestaque({ className }: { className?: string }) {
  const { destaque, definirDestaque } = useAparencia();
  return (
    <div
      role="radiogroup"
      aria-label="Cor de destaque"
      className={cn("grid grid-cols-4 justify-items-center gap-3", className)}
    >
      {DESTAQUES.map((opcao) => {
        const ativo = destaque === opcao.chave;
        return (
          <button
            key={opcao.chave}
            role="radio"
            onClick={() => definirDestaque(opcao.chave)}
            aria-checked={ativo}
            title={opcao.rotulo}
            className={cn(
              "flex size-12 items-center justify-center rounded-full border-2 transition-colors",
              ativo ? "border-fg" : "border-transparent hover:border-border-strong",
            )}
          >
            <span
              className="flex size-9 items-center justify-center rounded-full"
              style={{ backgroundColor: opcao.cor }}
            >
              {ativo && <Icone nome="check" size={16} className="text-[#121212]" />}
            </span>
            <span className="sr-only">{opcao.rotulo}</span>
          </button>
        );
      })}
    </div>
  );
}
