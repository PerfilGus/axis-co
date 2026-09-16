import { cn } from "@/lib/utils";
import { Check } from "@phosphor-icons/react/ssr";

export interface Etapa {
  chave: string;
  rotulo: string;
}

/**
 * Indicador de etapas em pontos. A etapa atual é marcada por um check dentro
 * de um círculo; as anteriores ficam preenchidas, as seguintes esvaziadas.
 */
export function IndicadorEtapas({
  etapas,
  atual,
  className,
  comRotulos = true,
  interrompida,
}: {
  etapas: Etapa[];
  /** Índice da etapa atual. */
  atual: number;
  className?: string;
  comRotulos?: boolean;
  /** Rótulo da saída quando o ciclo não terminou bem. */
  interrompida?: { rotulo: string; cor: string } | null;
}) {
  return (
    <div className={cn("flex items-start", className)}>
      {etapas.map((etapa, i) => {
        const concluida = i < atual;
        const ehAtual = i === atual;
        const ultima = i === etapas.length - 1;
        return (
          <div key={etapa.chave} className="flex flex-1 items-start last:flex-none">
            <div className="flex flex-col items-center gap-2">
              <span
                className={cn(
                  "flex items-center justify-center rounded-full transition-colors",
                  ehAtual
                    ? "size-6 bg-[var(--accent)] text-[var(--accent-fg)]"
                    : concluida
                      ? "size-2.5 bg-[var(--accent)]"
                      : "size-2.5 border border-border-strong bg-transparent",
                )}
              >
                {ehAtual && <Check size={13} weight="bold" />}
              </span>
              {comRotulos && (
                <span
                  className={cn(
                    "max-w-20 text-center text-[11px] leading-tight",
                    ehAtual ? "text-fg" : "text-muted-fg",
                  )}
                >
                  {etapa.rotulo}
                </span>
              )}
            </div>
            {!ultima && (
              <span
                className={cn(
                  "mx-2 h-px flex-1 translate-y-3",
                  concluida ? "bg-[var(--accent)]" : "bg-border",
                )}
                aria-hidden
              />
            )}
          </div>
        );
      })}
      {interrompida && (
        <div className="flex items-start">
          <span className="mx-2 h-px w-6 translate-y-3 bg-border" aria-hidden />
          <div className="flex flex-col items-center gap-2">
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: interrompida.cor }}
            />
            {comRotulos && (
              <span
                className="max-w-20 text-center text-[11px] leading-tight"
                style={{ color: interrompida.cor }}
              >
                {interrompida.rotulo}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
