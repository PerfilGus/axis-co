"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils";
import {
  cor,
  FAMILIAS,
  partesDaCor,
  VARIACOES,
  type ChaveCor,
  type Familia,
} from "@/lib/cores";
import { Icone } from "@/components/icone";

/**
 * Seletor de cor único do sistema. Toque numa família e as quatro variações
 * dela abrem logo abaixo. Grava a chave (`roxo-vibrante`), nunca o hex.
 * Alvos de 44px e nada que dependa de hover.
 */
export function SeletorCor({
  valor,
  aoMudar,
  rotulo = "Cor",
  familias = FAMILIAS.map((f) => f.chave),
  className,
}: {
  valor: ChaveCor | null;
  aoMudar: (chave: ChaveCor) => void;
  rotulo?: string;
  familias?: Familia[];
  className?: string;
}) {
  const id = useId();
  const atual = valor ? partesDaCor(valor) : null;
  const [aberta, setAberta] = useState<Familia | null>(atual?.familia ?? null);
  const opcoes = FAMILIAS.filter((f) => familias.includes(f.chave));
  const familiaAberta = opcoes.find((f) => f.chave === aberta);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div
        role="group"
        aria-label={`${rotulo}: família`}
        className="grid grid-cols-4 gap-x-2 gap-y-3 sm:grid-cols-8"
      >
        {opcoes.map((familia) => {
          const expandida = aberta === familia.chave;
          const escolhida = atual?.familia === familia.chave;
          return (
            <button
              key={familia.chave}
              type="button"
              aria-expanded={expandida}
              aria-controls={`${id}-variacoes`}
              onClick={() => setAberta(expandida ? null : familia.chave)}
              className="flex min-h-11 flex-col items-center gap-1.5 rounded-[var(--radius-input)] py-1"
            >
              <span
                className={cn(
                  "flex size-11 items-center justify-center rounded-full border-2 transition-colors",
                  expandida ? "border-fg" : "border-transparent",
                )}
              >
                <span
                  className="flex size-8 items-center justify-center rounded-full"
                  style={{ backgroundColor: cor(familia.chave, "vibrante") }}
                >
                  {escolhida && (
                    <Icone
                      nome="check"
                      size={15}
                      weight="bold"
                      style={{ color: cor(familia.chave, "escuro") }}
                    />
                  )}
                </span>
              </span>
              <span
                className={cn(
                  "text-[11px] leading-none",
                  expandida || escolhida ? "text-fg" : "text-muted-fg",
                )}
              >
                {familia.rotulo}
              </span>
            </button>
          );
        })}
      </div>

      {familiaAberta && (
        <div
          id={`${id}-variacoes`}
          role="radiogroup"
          aria-label={`${rotulo}: variação de ${familiaAberta.rotulo.toLowerCase()}`}
          className="grid grid-cols-4 gap-2 rounded-[var(--radius-card-sm)] bg-surface-2 p-2 [animation:axis-in_160ms_ease-out]"
        >
          {VARIACOES.map((variacao) => {
            const chave = `${familiaAberta.chave}-${variacao.chave}` as ChaveCor;
            const ativo = valor === chave;
            return (
              <button
                key={variacao.chave}
                type="button"
                role="radio"
                aria-checked={ativo}
                onClick={() => aoMudar(chave)}
                className={cn(
                  "flex flex-col items-stretch gap-1.5 rounded-[var(--radius-input)] border-2 p-1 transition-colors",
                  ativo ? "border-fg" : "border-transparent",
                )}
              >
                <span
                  className="flex h-11 items-center justify-center rounded-[10px] border border-border"
                  style={{ backgroundColor: cor(familiaAberta.chave, variacao.chave) }}
                >
                  {ativo && (
                    <span className="flex size-6 items-center justify-center rounded-full bg-bg text-fg">
                      <Icone nome="check" size={13} weight="bold" />
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    "pb-0.5 text-center text-[11px] leading-none",
                    ativo ? "text-fg" : "text-muted-fg",
                  )}
                >
                  {variacao.rotulo}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
