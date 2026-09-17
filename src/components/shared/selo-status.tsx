import { cn } from "@/lib/utils";
import {
  corComOpacidade,
  coresRastreio,
  estiloDoTom,
  STATUS_PEDIDO,
  STATUS_RASTREIO,
  type TomStatus,
} from "@/lib/status";
import type { Fonte, StatusPedido, StatusRastreio } from "@/lib/types";
import { cor, type Familia } from "@/lib/cores";
import { Icone, type NomeIcone } from "@/components/icone";

/**
 * Selo da paleta nova: sempre ícone e rótulo, nunca só cor. O fundo é o tom
 * escuro da família (padrão) ou o vibrante em baixa opacidade; o texto e o
 * ícone, o pastel. Nunca um bloco saturado.
 */
export function SeloFamilia({
  familia,
  icone,
  children,
  fundo = "escuro",
  className,
}: {
  familia: Familia;
  icone: NomeIcone;
  children: React.ReactNode;
  fundo?: "escuro" | "transparente";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full pr-2.5 pl-2 text-xs font-medium whitespace-nowrap",
        className,
      )}
      style={{
        color: cor(familia, "pastel"),
        backgroundColor:
          fundo === "escuro"
            ? cor(familia, "escuro")
            : `color-mix(in srgb, ${cor(familia, "vibrante")} 16%, transparent)`,
      }}
    >
      <Icone nome={icone} size={13} className="shrink-0" />
      {children}
    </span>
  );
}

/**
 * Selo de status. As cores são fixas e nunca acompanham o destaque escolhido
 * pelo usuário — por isso vêm de variáveis CSS próprias, e não de classes.
 */
export function SeloTom({
  tom,
  children,
  ponto = true,
  className,
}: {
  tom: TomStatus;
  children: React.ReactNode;
  ponto?: boolean;
  className?: string;
}) {
  const estilo = estiloDoTom(tom);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        className,
      )}
      style={{ color: estilo.cor, backgroundColor: estilo.fundo }}
    >
      {ponto && (
        <span
          className="size-1.5 rounded-full"
          style={{ backgroundColor: "currentColor" }}
          aria-hidden
        />
      )}
      {children}
    </span>
  );
}

export function SeloStatusPedido({
  status,
  className,
}: {
  status: StatusPedido;
  className?: string;
}) {
  const def = STATUS_PEDIDO[status];
  return (
    <SeloTom tom={def.tom} className={className}>
      {def.rotulo}
    </SeloTom>
  );
}

/**
 * Badge de status de rastreio. Reproduz o do axis-tracking: fundo com 18% da
 * cor base, borda com 40% e o rótulo na cor de texto do status.
 */
export function SeloStatusRastreio({
  status,
  className,
}: {
  status: StatusRastreio;
  className?: string;
}) {
  const def = STATUS_RASTREIO[status];
  const { base, texto } = coresRastreio(status);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        className,
      )}
      style={{
        color: texto,
        backgroundColor: corComOpacidade(base, 0.18),
        borderColor: corComOpacidade(base, 0.4),
      }}
    >
      {def.rotulo}
    </span>
  );
}

/**
 * Selo de origem do dado. Enquanto as integrações não existem, tudo é
 * `manual` — o selo é o ponto de entrada visual de cada uma delas.
 */
export function SeloFonte({
  fonte,
  integracao,
  className,
}: {
  fonte: Fonte;
  integracao?: string;
  className?: string;
}) {
  const api = fonte === "api";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-fg",
        className,
      )}
      title={
        api
          ? `Dado sincronizado${integracao ? ` via ${integracao}` : ""}.`
          : "Dado preenchido à mão. A integração entra numa fase seguinte."
      }
    >
      <span
        className="size-1.5 rounded-full"
        style={{
          backgroundColor: api ? "var(--st-verde-fg)" : "var(--st-cinza-fg)",
        }}
        aria-hidden
      />
      Fonte: {api ? (integracao ?? "API") : "manual"}
    </span>
  );
}
