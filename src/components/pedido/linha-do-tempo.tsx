import { cn } from "@/lib/utils";
import { formatBRL, formatDataHora } from "@/lib/format";
import { estiloDoTom, STATUS_PEDIDO } from "@/lib/status";
import type { EventoPedido, TipoEventoPedido } from "@/lib/types";
import { Icone, type NomeIcone } from "@/components/icone";
import { useEquipe } from "@/lib/providers/equipe";
import { SeloFonte } from "@/components/shared/selo-status";

const ICONE_POR_TIPO: Record<TipoEventoPedido, NomeIcone> = {
  criacao: "adicionar",
  autorizacao: "autorizar",
  rastreio: "rastreio",
  cobranca: "dinheiro",
  custo: "alerta",
  ajuste: "percentual",
  anexo: "anexo",
  status: "info",
};

/** Eventos de custo e de saída do ciclo merecem destaque visual. */
function corDoEvento(evento: EventoPedido): string | null {
  if (evento.tipo === "custo") return "var(--st-vermelho-fg)";
  if (evento.status && evento.status in STATUS_PEDIDO) {
    return estiloDoTom(STATUS_PEDIDO[evento.status].tom).cor;
  }
  return null;
}

/**
 * Linha do tempo do pedido: criação, autorização, eventos de rastreio,
 * cobrança, custos gerados, ajustes de valor e anexos, em ordem cronológica.
 */
export function LinhaDoTempo({
  eventos,
  className,
}: {
  eventos: EventoPedido[];
  className?: string;
}) {
  const { nomeDe: nomeColaborador } = useEquipe();
  return (
    <ol className={cn("flex flex-col", className)}>
      {eventos.map((evento, i) => {
        const ultimo = i === eventos.length - 1;
        const cor = corDoEvento(evento);
        return (
          <li key={evento.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-surface-2"
                style={cor ? { color: cor } : undefined}
              >
                <Icone nome={ICONE_POR_TIPO[evento.tipo]} size={13} />
              </span>
              {!ultimo && <span className="w-px flex-1 bg-border" aria-hidden />}
            </div>

            <div className={cn("flex min-w-0 flex-1 flex-col gap-0.5", ultimo ? "pb-0" : "pb-5")}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-[13px] font-medium">{evento.titulo}</span>
                {typeof evento.valor === "number" && (
                  <span
                    className="tabular text-[13px] font-medium"
                    style={cor ? { color: cor } : undefined}
                  >
                    {formatBRL(evento.valor)}
                  </span>
                )}
                {evento.tipo === "rastreio" && (
                  <SeloFonte fonte={evento.fonte} integracao="Correios" />
                )}
              </div>

              {evento.descricao && (
                <p className="text-[13px] leading-snug text-muted-fg">
                  {evento.descricao}
                </p>
              )}

              <p className="tabular text-[11px] text-muted-fg/80">
                {formatDataHora(evento.ocorridoEm)}
                {evento.autorId && ` · ${nomeColaborador(evento.autorId)}`}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
