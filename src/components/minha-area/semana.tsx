import { cn } from "@/lib/utils";
import { diaDaSemana, formatDia } from "@/lib/format";
import type { DiaDaSemana } from "@/lib/minha-area";
import { Icone } from "@/components/icone";

/**
 * A semana em sete chips verticais. O ponto marca dia trabalhado; o check,
 * meta diária batida. Hoje leva o contorno na cor de destaque.
 */
export function SemanaTrabalho({ dias }: { dias: DiaDaSemana[] }) {
  const semMetaDiaria = dias.every((d) => d.metaBatida === null);

  return (
    <section aria-labelledby="titulo-semana" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="titulo-semana" className="text-base font-medium tracking-tight">
          Sua semana
        </h2>
        <span className="text-[11px] text-muted-fg">
          {semMetaDiaria ? "Sem meta diária cadastrada" : "Ponto: trabalhou · check: meta do dia"}
        </span>
      </div>
      <ol className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {dias.map((d) => {
          const descricao = [
            formatDia(d.dia),
            d.futuro ? "ainda não chegou" : d.trabalhado ? "trabalhado" : "sem atividade",
            d.metaBatida ? "meta batida" : null,
          ]
            .filter(Boolean)
            .join(", ");
          return (
            <li
              key={d.dia}
              aria-label={descricao}
              aria-current={d.ehHoje ? "date" : undefined}
              className={cn(
                "flex flex-col items-center gap-2 rounded-full border py-3",
                d.ehHoje
                  ? "border-[var(--accent)] bg-transparent"
                  : "border-transparent bg-surface-2",
                d.futuro && "opacity-55",
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  d.trabalhado ? "bg-[var(--accent)]" : "bg-muted-fg/35",
                )}
                aria-hidden
              />
              <span className="tabular text-sm leading-none font-medium">{d.dia.slice(8, 10)}</span>
              <span className="text-[11px] leading-none text-muted-fg">{diaDaSemana(d.dia)}</span>
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-full",
                  d.metaBatida
                    ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                    : "border border-dashed border-border-strong",
                  d.metaBatida === null && "invisible",
                )}
                aria-hidden
              >
                {d.metaBatida && <Icone nome="check" size={11} weight="bold" />}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
