"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Gráfico de uma série: barras ou linha, com dica ao passar o mouse.
 *
 * Um eixo só. Duas medidas de escala diferente (investimento e CPA, por
 * exemplo) viram dois gráficos alinhados, nunca um gráfico com dois eixos.
 * O layout é HTML; só a linha é SVG, com traço que não estica.
 */

export interface PontoGrafico {
  id: string;
  /** Rótulo do eixo horizontal. */
  rotulo: string;
  valor: number | null;
  /** Título da dica; sem ele, vale o rótulo. */
  tituloDica?: string;
  /** Linhas extras da dica, abaixo do valor. */
  dica?: ReactNode;
}

function escala(minimo: number, maximo: number, divisoes = 4) {
  const lo = Math.min(0, minimo);
  const hi = Math.max(0, maximo);
  const bruto = (hi - lo || 1) / divisoes;
  const magnitude = 10 ** Math.floor(Math.log10(bruto));
  const norma = bruto / magnitude;
  const passo = (norma <= 1 ? 1 : norma <= 2 ? 2 : norma <= 5 ? 5 : 10) * magnitude;
  const inicio = Math.floor(lo / passo) * passo;
  const fim = Math.max(Math.ceil(hi / passo) * passo, inicio + passo);
  const marcas: number[] = [];
  for (let v = inicio; v <= fim + passo / 2; v += passo) marcas.push(Math.round(v * 1000) / 1000);
  return { inicio, fim, marcas };
}

export function Grafico({
  pontos,
  tipo = "barras",
  formatarValor,
  formatarEixo = formatarValor,
  altura = 180,
  cor = "var(--accent)",
  corNegativa,
  rotuloAcessivel,
  maxRotulos = 7,
  className,
}: {
  pontos: PontoGrafico[];
  tipo?: "barras" | "linha";
  formatarValor: (valor: number) => string;
  formatarEixo?: (valor: number) => string;
  altura?: number;
  cor?: string;
  /** Cor das barras abaixo de zero. Sem ela, usa a mesma. */
  corNegativa?: string;
  rotuloAcessivel: string;
  maxRotulos?: number;
  className?: string;
}) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const valores = pontos.map((p) => p.valor).filter((v): v is number => v !== null);
  const { inicio, fim, marcas } = escala(Math.min(0, ...valores), Math.max(0, ...valores));
  const posicao = (v: number) => ((fim - v) / (fim - inicio)) * 100; // % a partir do topo
  const zero = posicao(0);
  const n = pontos.length;
  const passoRotulo = Math.max(1, Math.ceil(n / maxRotulos));
  const pontoAtivo = ativo !== null ? pontos[ativo] : null;

  // Linha: segmentos contínuos, quebrados onde falta valor.
  const segmentos: string[] = [];
  if (tipo === "linha") {
    let atual: string[] = [];
    pontos.forEach((p, i) => {
      if (p.valor === null) {
        if (atual.length) segmentos.push(atual.join(" "));
        atual = [];
        return;
      }
      atual.push(`${((i + 0.5) / n) * 1000},${posicao(p.valor) * 10}`);
    });
    if (atual.length) segmentos.push(atual.join(" "));
  }

  return (
    <div
      className={cn("flex w-full flex-col gap-2", className)}
      role="img"
      aria-label={rotuloAcessivel}
      onMouseLeave={() => setAtivo(null)}
    >
      <div className="flex w-full" style={{ height: altura }}>
        {/* eixo vertical */}
        <div className="relative w-16 shrink-0" aria-hidden>
          {marcas.map((m) => (
            <span
              key={m}
              className="tabular absolute right-2 -translate-y-1/2 text-[11px] whitespace-nowrap text-muted-fg"
              style={{ top: `${posicao(m)}%` }}
            >
              {formatarEixo(m)}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          {marcas.map((m) => (
            <div
              key={m}
              aria-hidden
              className={cn(
                "absolute inset-x-0 border-t",
                m === 0 ? "border-border-strong" : "border-border/60",
              )}
              style={{ top: `${posicao(m)}%` }}
            />
          ))}

          {tipo === "linha" && (
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
              viewBox="0 0 1000 1000"
              preserveAspectRatio="none"
              aria-hidden
            >
              {segmentos.map((pts) => (
                <polyline
                  key={pts}
                  points={pts}
                  fill="none"
                  stroke={cor}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </svg>
          )}

          <div className="absolute inset-0 flex">
            {pontos.map((p, i) => {
              const negativo = p.valor !== null && p.valor < 0;
              const topo = p.valor === null ? zero : Math.min(posicao(p.valor), zero);
              const base = p.valor === null ? zero : Math.max(posicao(p.valor), zero);
              return (
                <div
                  key={p.id}
                  className="relative h-full min-w-0 flex-1"
                  onMouseEnter={() => setAtivo(i)}
                  onClick={() => setAtivo(i)}
                >
                  {ativo === i && (
                    <div
                      aria-hidden
                      className={cn(
                        "absolute inset-y-0 left-1/2 w-px -translate-x-1/2",
                        tipo === "linha" ? "bg-border-strong" : "bg-transparent",
                      )}
                    />
                  )}
                  {tipo === "barras" && p.valor !== null && p.valor !== 0 && (
                    <div
                      className={cn(
                        "absolute left-1/2 w-[62%] max-w-10 -translate-x-1/2 transition-opacity",
                        negativo ? "rounded-b-[4px]" : "rounded-t-[4px]",
                        ativo !== null && ativo !== i && "opacity-45",
                      )}
                      style={{
                        top: `${topo}%`,
                        height: `max(${base - topo}%, 2px)`,
                        backgroundColor: negativo && corNegativa ? corNegativa : cor,
                      }}
                    />
                  )}
                  {tipo === "linha" && p.valor !== null && ativo === i && (
                    <span
                      aria-hidden
                      className="absolute left-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface-1"
                      style={{ top: `${posicao(p.valor)}%`, backgroundColor: cor }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {pontoAtivo && ativo !== null && (
            <div
              className={cn(
                "pointer-events-none absolute top-0 z-10 flex min-w-36 flex-col gap-0.5 rounded-[var(--radius-input)] border border-border bg-surface-2 px-3 py-2 text-xs",
                ativo < n * 0.25 ? "" : ativo > n * 0.75 ? "-translate-x-full" : "-translate-x-1/2",
              )}
              style={{ left: `${((ativo + 0.5) / n) * 100}%` }}
            >
              <span className="text-muted-fg">{pontoAtivo.tituloDica ?? pontoAtivo.rotulo}</span>
              <span className="tabular text-sm font-medium text-fg">
                {pontoAtivo.valor === null ? "—" : formatarValor(pontoAtivo.valor)}
              </span>
              {pontoAtivo.dica && <div className="tabular text-muted-fg">{pontoAtivo.dica}</div>}
            </div>
          )}
        </div>
      </div>

      {/* eixo horizontal */}
      <div className="flex w-full" aria-hidden>
        <div className="w-16 shrink-0" />
        <div className="flex min-w-0 flex-1">
          {pontos.map((p, i) => (
            <span
              key={p.id}
              className="tabular min-w-0 flex-1 overflow-visible text-center text-[11px] whitespace-nowrap text-muted-fg"
            >
              {i % passoRotulo === 0 ? p.rotulo : ""}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
