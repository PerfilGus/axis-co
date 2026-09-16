"use client";

import { cn } from "@/lib/utils";
import {
  hoje,
  periodoDoPreset,
  PRESETS_PERIODO,
  type PeriodoAnalise,
  type PresetPeriodo,
} from "@/lib/periodos";
import { Input } from "@/components/ui/input";
import {
  Selecao,
  SelecaoConteudo,
  SelecaoGatilho,
  SelecaoItem,
  SelecaoValor,
} from "@/components/ui/select";

/**
 * Período de análise: atalhos e, no personalizado, as duas datas. As datas
 * valem inteiras nas duas pontas, no fuso de São Paulo.
 */
export function SeletorPeriodo({
  valor,
  aoMudar,
  className,
}: {
  valor: PeriodoAnalise;
  aoMudar: (periodo: PeriodoAnalise) => void;
  className?: string;
}) {
  const limite = hoje();
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Selecao
        value={valor.preset}
        onValueChange={(preset) =>
          aoMudar(
            preset === "personalizado"
              ? { ...valor, preset: "personalizado" }
              : periodoDoPreset(preset as PresetPeriodo),
          )
        }
      >
        <SelecaoGatilho className="w-auto min-w-36 rounded-full" aria-label="Período">
          <SelecaoValor />
        </SelecaoGatilho>
        <SelecaoConteudo>
          {PRESETS_PERIODO.map((p) => (
            <SelecaoItem key={p.valor} value={p.valor}>
              {p.rotulo}
            </SelecaoItem>
          ))}
        </SelecaoConteudo>
      </Selecao>
      {valor.preset === "personalizado" && (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            aria-label="De"
            value={valor.de}
            max={valor.ate}
            onChange={(e) => e.target.value && aoMudar({ ...valor, de: e.target.value })}
            className="tabular w-auto rounded-full"
          />
          <span className="text-xs text-muted-fg">até</span>
          <Input
            type="date"
            aria-label="Até"
            value={valor.ate}
            min={valor.de}
            max={limite}
            onChange={(e) => e.target.value && aoMudar({ ...valor, ate: e.target.value })}
            className="tabular w-auto rounded-full"
          />
        </div>
      )}
    </div>
  );
}
