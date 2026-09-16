import { cn } from "@/lib/utils";
import { Icone, type NomeIcone } from "@/components/icone";
import { Card } from "@/components/ui/card";

export interface IndicadorProps {
  icone: NomeIcone;
  valor: string;
  rotulo: string;
  /** Variação do período, já formatada (ex.: "+12,4%"). */
  variacao?: string;
  direcao?: "subiu" | "desceu" | "neutra";
  className?: string;
}

/**
 * Indicador: ícone na cor de destaque ao lado do número grande,
 * rótulo abaixo.
 */
export function Indicador({
  icone,
  valor,
  rotulo,
  variacao,
  direcao = "neutra",
  className,
}: IndicadorProps) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-center gap-2">
        <span className="text-[var(--accent)]">
          <Icone nome={icone} size={20} />
        </span>
        <span className="tabular truncate text-2xl leading-none font-medium tracking-tight">
          {valor}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[13px] text-muted-fg">{rotulo}</span>
        {variacao && (
          <span
            className="tabular inline-flex items-center gap-0.5 text-[11px] font-medium"
            style={{
              color:
                direcao === "subiu"
                  ? "var(--st-verde-fg)"
                  : direcao === "desceu"
                    ? "var(--st-vermelho-fg)"
                    : "var(--muted-fg)",
            }}
          >
            {direcao !== "neutra" && (
              <Icone nome={direcao === "subiu" ? "subiu" : "desceu"} size={11} />
            )}
            {variacao}
          </span>
        )}
      </div>
    </div>
  );
}

/** Card de indicador, para quando o número precisa de superfície própria. */
export function CardIndicador({ className, ...props }: IndicadorProps) {
  return (
    <Card className={cn("p-5", className)}>
      <Indicador {...props} />
    </Card>
  );
}

/**
 * Linha de indicadores separados por divisores verticais finos, como a
 * faixa de estatísticas da referência.
 */
export function LinhaIndicadores({
  itens,
  className,
  comCard = true,
}: {
  itens: IndicadorProps[];
  className?: string;
  comCard?: boolean;
}) {
  const conteudo = (
    <div
      className={cn(
        "grid grid-cols-2 gap-x-5 gap-y-6 sm:flex sm:items-center",
        comCard ? "p-5" : "",
      )}
    >
      {itens.map((item, i) => (
        <div
          key={item.rotulo}
          className={cn(
            "flex-1 px-0 sm:px-6 sm:first:pl-0 sm:last:pr-0",
            i > 0 && "sm:border-l sm:border-border",
          )}
        >
          <Indicador {...item} />
        </div>
      ))}
    </div>
  );

  if (!comCard) return <div className={className}>{conteudo}</div>;
  return <Card className={className}>{conteudo}</Card>;
}
