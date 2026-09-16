import { cn } from "@/lib/utils";
import { Icone, type NomeIcone } from "@/components/icone";

/**
 * Estado vazio. Diz o que falta e oferece o próximo passo — nunca só
 * "nenhum resultado".
 */
export function EstadoVazio({
  icone = "info",
  titulo,
  descricao,
  acao,
  className,
  compacto = false,
}: {
  icone?: NomeIcone;
  titulo: string;
  descricao?: string;
  acao?: React.ReactNode;
  className?: string;
  compacto?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-border text-center",
        compacto ? "gap-2 px-6 py-10" : "gap-3 px-6 py-16",
        className,
      )}
    >
      <span
        className={cn(
          "flex items-center justify-center rounded-full bg-surface-2 text-muted-fg",
          compacto ? "size-10" : "size-14",
        )}
      >
        <Icone nome={icone} size={compacto ? 18 : 24} />
      </span>
      <div className="flex flex-col gap-1">
        <p className={cn("font-medium", compacto ? "text-sm" : "text-base")}>
          {titulo}
        </p>
        {descricao && (
          <p className="max-w-sm text-[13px] text-muted-fg">{descricao}</p>
        )}
      </div>
      {acao && <div className="mt-2">{acao}</div>}
    </div>
  );
}

/**
 * Marcador das telas que ainda serão construídas nas próximas fases.
 * Mantém o cabeçalho e a navegação verificáveis desde já.
 */
export function EmConstrucao({
  titulo,
  descricao,
  fase,
}: {
  titulo: string;
  descricao: string;
  fase?: string;
}) {
  return (
    <EstadoVazio
      icone="lista"
      titulo={titulo}
      descricao={descricao}
      acao={
        fase ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-[11px] text-muted-fg">
            <span
              className="size-1.5 rounded-full"
              style={{ backgroundColor: "var(--st-bronze-fg)" }}
              aria-hidden
            />
            {fase}
          </span>
        ) : null
      }
    />
  );
}
