"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import {
  CHAVES_COR,
  contraste,
  cor,
  FAMILIAS,
  partesDaCor,
  rotuloDaCor,
  VARIACOES,
  type ChaveCor,
  type Variacao,
} from "@/lib/cores";
import { STATUS_PEDIDO, STATUS_RASTREIO } from "@/lib/status";
import { Icone } from "@/components/icone";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { Card, CardConteudo, CardDescricao, CardTitulo } from "@/components/ui/card";
import { SeloFamilia } from "@/components/shared/selo-status";
import { SeletorCor } from "@/components/shared/seletor-cor";

/* ---------------------------------------------------------------
   Valores efetivos da paleta, lidos do CSS do tema em uso: a página
   nunca repete um hex, e o contraste acompanha a troca de tema.
   --------------------------------------------------------------- */

function assinarTema(aoMudar: () => void) {
  const observador = new MutationObserver(aoMudar);
  observador.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observador.disconnect();
}

function lerPaleta(): string {
  const css = getComputedStyle(document.documentElement);
  const ler = (nome: string) => css.getPropertyValue(nome).trim().toLowerCase();
  return [ler("--bg"), ...CHAVES_COR.map((c) => ler(`--cor-${c}`))].join(",");
}

function usePaleta() {
  const bruto = useSyncExternalStore(assinarTema, lerPaleta, () => "");
  return useMemo(() => {
    if (!bruto) return null;
    const [fundo, ...valores] = bruto.split(",");
    const mapa = Object.fromEntries(CHAVES_COR.map((c, i) => [c, valores[i]])) as Record<
      ChaveCor,
      string
    >;
    return { fundo, mapa };
  }, [bruto]);
}

/** Mínimo por papel: texto pede 4,5; ícone e gráfico, 3. */
const MINIMO: Record<Variacao, number> = { vibrante: 3, pastel: 4.5, escuro: 4.5, claro: 4.5 };

function formatarContraste(valor: number) {
  return `${valor.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}:1`;
}

export default function PaginaDesign() {
  const paleta = usePaleta();
  const [escolhida, setEscolhida] = useState<ChaveCor | null>("roxo-vibrante");
  const [fundoSelo, setFundoSelo] = useState<"escuro" | "transparente">("escuro");

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Design"
        descricao="Paleta, badges e seletor de cor para aprovar antes de aplicar no sistema."
        comSubAbas={false}
      />

      {/* ---------------- famílias ---------------- */}
      <Card>
        <CardConteudo className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <CardTitulo>Famílias e variações</CardTitulo>
            <CardDescricao>
              Contraste medido sobre o fundo do tema atual. No tom escuro, o número é o do
              texto pastel sobre ele, que é como o badge usa.
            </CardDescricao>
          </div>

          <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {VARIACOES.map((v) => (
              <div key={v.chave} className="rounded-[var(--radius-input)] bg-surface-2 px-3.5 py-2.5">
                <dt className="text-[13px] font-medium">{v.rotulo}</dt>
                <dd className="text-xs text-muted-fg">{v.uso}</dd>
              </div>
            ))}
          </dl>

          <div className="flex flex-col gap-6">
            {FAMILIAS.map((familia) => (
              <section key={familia.chave} className="flex flex-col gap-2.5">
                <h3 className="flex items-center gap-2 text-sm font-medium">
                  <Icone
                    nome="aparencia"
                    size={15}
                    style={{ color: cor(familia.chave, "vibrante") }}
                  />
                  {familia.rotulo}
                </h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {VARIACOES.map((v) => {
                    const chave = `${familia.chave}-${v.chave}` as ChaveCor;
                    const hex = paleta?.mapa[chave];
                    const razao =
                      paleta && hex
                        ? v.chave === "escuro"
                          ? contraste(paleta.mapa[`${familia.chave}-pastel`], hex)
                          : contraste(hex, paleta.fundo)
                        : null;
                    const passa = razao !== null && razao >= MINIMO[v.chave];
                    return (
                      <div key={v.chave} className="flex flex-col gap-2">
                        <div
                          className="flex h-16 items-end rounded-[var(--radius-input)] border border-border p-2.5"
                          style={{ backgroundColor: cor(familia.chave, v.chave) }}
                        >
                          {v.chave === "escuro" && (
                            <span
                              className="text-xs font-medium"
                              style={{ color: cor(familia.chave, "pastel") }}
                            >
                              Texto pastel
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col gap-0.5 px-0.5">
                          <span className="text-[13px] font-medium">{v.rotulo}</span>
                          <span className="tabular text-xs text-muted-fg uppercase">
                            {hex ?? "—"}
                          </span>
                          {razao !== null && (
                            <span
                              className="tabular inline-flex items-center gap-1 text-xs"
                              style={{
                                color: passa ? cor("verde", "pastel") : cor("vermelho", "pastel"),
                              }}
                            >
                              <Icone nome={passa ? "checkCircle" : "alerta"} size={12} />
                              {formatarContraste(razao)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </CardConteudo>
      </Card>

      {/* ---------------- badges ---------------- */}
      <Card>
        <CardConteudo className="flex flex-col gap-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <CardTitulo>Badges</CardTitulo>
              <CardDescricao>
                Texto e ícone em pastel. Compare os dois fundos e escolha um para o sistema.
              </CardDescricao>
            </div>
            <div
              role="radiogroup"
              aria-label="Fundo do badge"
              className="inline-flex items-center gap-1 rounded-full bg-surface-2 p-1"
            >
              {(
                [
                  ["escuro", "Tom escuro"],
                  ["transparente", "Baixa opacidade"],
                ] as const
              ).map(([chave, rotulo]) => (
                <button
                  key={chave}
                  type="button"
                  role="radio"
                  aria-checked={fundoSelo === chave}
                  onClick={() => setFundoSelo(chave)}
                  className={cn(
                    "h-11 rounded-full px-4 text-[13px] font-medium transition-colors",
                    fundoSelo === chave
                      ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                      : "text-muted-fg",
                  )}
                >
                  {rotulo}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {FAMILIAS.map((f) => (
              <SeloFamilia key={f.chave} familia={f.chave} icone="etiqueta" fundo={fundoSelo}>
                {f.rotulo}
              </SeloFamilia>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-medium">Status do pedido</h3>
              <ul className="flex flex-col divide-y divide-border rounded-[var(--radius-card-sm)] border border-border">
                {Object.values(STATUS_PEDIDO).map((s) => (
                  <li key={s.chave} className="flex flex-col gap-1.5 px-4 py-3">
                    <SeloFamilia
                      familia={s.familia}
                      icone={s.icone}
                      fundo={fundoSelo}
                      className="self-start"
                    >
                      {s.rotulo}
                    </SeloFamilia>
                    <span className="text-xs text-muted-fg">{s.descricao}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-medium">Status do rastreio</h3>
              <ul className="flex flex-col divide-y divide-border rounded-[var(--radius-card-sm)] border border-border">
                {Object.values(STATUS_RASTREIO).map((s) => (
                  <li key={s.chave} className="flex flex-col gap-1.5 px-4 py-3">
                    <SeloFamilia
                      familia={s.familia}
                      icone={s.icone}
                      fundo={fundoSelo}
                      className="self-start"
                    >
                      {s.rotulo}
                    </SeloFamilia>
                    <span className="text-xs text-muted-fg">{s.descricao}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </CardConteudo>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ---------------- seletor ---------------- */}
        <Card>
          <CardConteudo className="flex flex-col gap-5">
            <div className="flex flex-col gap-1">
              <CardTitulo>Seletor de cor</CardTitulo>
              <CardDescricao>
                O mesmo componente de bancos, plataformas, níveis e conquistas.
              </CardDescricao>
            </div>
            <SeletorCor valor={escolhida} aoMudar={setEscolhida} />
            {escolhida && <PreviaCor chave={escolhida} />}
          </CardConteudo>
        </Card>

        {/* ---------------- gráfico e destaque ---------------- */}
        <div className="flex flex-col gap-6">
          <Card>
            <CardConteudo className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <CardTitulo>Gráficos</CardTitulo>
                <CardDescricao>Séries no tom vibrante de cada família.</CardDescricao>
              </div>
              <div className="flex h-36 items-end gap-2" aria-hidden>
                {FAMILIAS.map((f, i) => (
                  <div key={f.chave} className="flex flex-1 flex-col items-center gap-1.5">
                    <div
                      className="w-full rounded-t-[6px]"
                      style={{
                        height: `${40 + ((i * 37) % 60)}%`,
                        backgroundColor: cor(f.chave, "vibrante"),
                      }}
                    />
                    <span className="text-[10px] text-muted-fg">{f.rotulo.slice(0, 3)}</span>
                  </div>
                ))}
              </div>
            </CardConteudo>
          </Card>

          <div
            className="relative overflow-hidden rounded-[var(--radius-card)] border p-5"
            style={{
              borderColor: `color-mix(in srgb, ${cor("amarelo", "vibrante")} 28%, transparent)`,
              background: `radial-gradient(120% 90% at 0% 0%, color-mix(in srgb, ${cor("amarelo", "vibrante")} 14%, transparent) 0%, transparent 60%), var(--surface-1)`,
            }}
          >
            <div className="flex items-start gap-3">
              <span
                className="flex size-11 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: cor("amarelo", "escuro") }}
              >
                <Icone nome="ranking" size={20} style={{ color: cor("amarelo", "vibrante") }} />
              </span>
              <div className="flex flex-col gap-1">
                <span className="text-base font-medium">Card de destaque</span>
                <span className="text-[13px] text-muted-fg">
                  Brilho, borda translúcida e gradiente ficam só aqui: premiação e metas
                  batidas. Telas operacionais usam o card liso.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviaCor({ chave }: { chave: ChaveCor }) {
  const { familia } = partesDaCor(chave);
  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-card-sm)] border border-border p-4">
      <div className="flex items-center gap-3">
        <span
          className="size-11 shrink-0 rounded-full border border-border"
          style={{ backgroundColor: cor(familia, partesDaCor(chave).variacao) }}
        />
        <div className="flex min-w-0 flex-col">
          <span className="text-sm font-medium">{rotuloDaCor(chave)}</span>
          <span className="text-xs text-muted-fg">Gravado como “{chave}”</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <SeloFamilia familia={familia} icone="medalha">
          Badge
        </SeloFamilia>
        <span
          className="inline-flex items-center gap-1.5 text-[13px] font-medium"
          style={{ color: cor(familia, "claro") }}
        >
          <Icone nome="aparencia" size={15} style={{ color: cor(familia, "vibrante") }} />
          Texto claro com ícone vibrante
        </span>
      </div>
    </div>
  );
}
