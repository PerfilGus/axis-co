"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { ROTULO_FORMATO } from "@/lib/types";
import {
  diaDaSemana,
  formatBRL,
  formatBRLCompacto,
  formatDia,
  formatDiaCurto,
  formatNumero,
  formatPercentual,
} from "@/lib/format";
import {
  agruparPorLinha,
  analisarCriativos,
  evolucaoDoCriativo,
  fracao,
  ID_NAO_IDENTIFICADO,
  totaisDosDias,
  type LinhaCriativo,
} from "@/lib/meta-ads";
import { codigoCompleto } from "@/lib/mock/marketing";
import { periodoDoPreset, type PeriodoAnalise } from "@/lib/periodos";
import { useCadastros } from "@/lib/providers/cadastros";
import { useMarketing } from "@/lib/providers/marketing";
import { usePedidos } from "@/lib/providers/pedidos";
import { Icone } from "@/components/icone";
import { Gaveta, GavetaCabecalho, GavetaConteudo, GavetaCorpo } from "@/components/ui/drawer";
import {
  Selecao,
  SelecaoConteudo,
  SelecaoGatilho,
  SelecaoItem,
  SelecaoValor,
} from "@/components/ui/select";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { ControleSegmentado } from "@/components/shared/controles";
import { Grafico } from "@/components/shared/grafico";
import { LinhaIndicadores } from "@/components/shared/indicadores";
import { SeletorPeriodo } from "@/components/shared/seletor-periodo";
import { SeloTom } from "@/components/shared/selo-status";
import { Tabela, type ColunaTabela } from "@/components/shared/tabela";

type Agrupamento = "criativo" | "linha";
type FiltroStatus = "todos" | "ativos" | "inativos";

function Custo({ valor }: { valor: number | null }) {
  return valor === null ? <span className="text-muted-fg/60">—</span> : <>{formatBRL(valor)}</>;
}

function Percentual({ parte, linha }: { parte: number; linha: LinhaCriativo }) {
  const valor = fracao(parte, linha);
  return valor === null ? <span className="text-muted-fg/60">—</span> : <>{formatPercentual(valor)}</>;
}

function NomeLinha({ item }: { item: LinhaCriativo }) {
  if (item.id === ID_NAO_IDENTIFICADO) {
    return (
      <div className="flex min-w-0 flex-col">
        <span className="font-medium">Criativo não identificado</span>
        <span className="text-[11px] text-muted-fg">Leads sem código e investimento lançado à mão</span>
      </div>
    );
  }
  if (item.criativo) {
    return (
      <div className="flex min-w-0 flex-col">
        <span className="flex items-center gap-2">
          <span className="tabular font-medium">{codigoCompleto(item.criativo)}</span>
          {!item.criativo.ativo && (
            <SeloTom tom="cinza" ponto={false} className="px-2 py-0 text-[11px]">
              Inativo
            </SeloTom>
          )}
        </span>
        <span className="truncate text-[11px] text-muted-fg">
          {item.criativo.nome} · {ROTULO_FORMATO[item.criativo.formato]}
        </span>
      </div>
    );
  }
  return <span className="font-medium">{item.linha?.nome ?? "Sem linha"}</span>;
}

function Detalhe({
  item,
  periodo,
  aoFechar,
}: {
  item: LinhaCriativo | null;
  periodo: PeriodoAnalise;
  aoFechar: () => void;
}) {
  const { lancamentos, diasManuais } = useMarketing();
  const { pedidos } = usePedidos();
  const dias = useMemo(
    () =>
      item ? evolucaoDoCriativo(item.id, periodo.de, periodo.ate, lancamentos, diasManuais, pedidos) : [],
    [item, periodo, lancamentos, diasManuais, pedidos],
  );
  const totais = totaisDosDias(dias);
  const titulo =
    item?.id === ID_NAO_IDENTIFICADO
      ? "Criativo não identificado"
      : item?.criativo
        ? `${codigoCompleto(item.criativo)} · ${item.linha?.nome ?? "sem linha"}`
        : "";

  const pontos = (valor: (d: (typeof dias)[number]) => number | null) =>
    dias.map((d) => ({
      id: d.data,
      rotulo: formatDiaCurto(d.data),
      tituloDica: `${formatDia(d.data)}, ${diaDaSemana(d.data)}`,
      valor: valor(d),
    }));

  return (
    <Gaveta open={item !== null} onOpenChange={(v) => !v && aoFechar()}>
      <GavetaConteudo larguraMaxima="sm:max-w-2xl">
        {item && (
          <>
            <GavetaCabecalho
              titulo={titulo}
              descricao={
                item.criativo
                  ? `${item.criativo.nome} · ${formatDia(periodo.de)} a ${formatDia(periodo.ate)}`
                  : `Pedidos sem código e dias lançados à mão · ${formatDia(periodo.de)} a ${formatDia(periodo.ate)}`
              }
            />
            <GavetaCorpo className="flex flex-col gap-6">
              <div className="grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-4">
                {[
                  ["Investimento", formatBRL(item.investimento)],
                  ["CPA", item.cpa !== null ? formatBRL(item.cpa) : "—"],
                  ["Vendas", formatNumero(item.vendas)],
                  ["Faturamento", formatBRL(item.faturamento)],
                  ["Leads", formatNumero(item.leads)],
                  ["CPL", item.cpl !== null ? formatBRL(item.cpl) : "—"],
                  ["Conversão", item.leads > 0 ? formatPercentual(item.vendas / item.leads) : "—"],
                  ["Agendados", formatNumero(item.agendados)],
                ].map(([rotulo, valor]) => (
                  <div key={rotulo} className="flex flex-col gap-0.5">
                    <span className="tabular text-lg font-medium">{valor}</span>
                    <span className="text-xs text-muted-fg">{rotulo}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-[13px] font-medium text-muted-fg">Desfecho dos agendados</span>
                <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-surface-3">
                  {(
                    [
                      [item.pagos, "var(--st-esmeralda-fg)"],
                      [item.reembolsados, "var(--st-rosa-fg)"],
                      [item.cancelados, "var(--st-cinza-fg)"],
                    ] as const
                  ).map(([valor, cor], i) =>
                    valor > 0 ? (
                      <span key={i} style={{ flex: valor, backgroundColor: cor }} />
                    ) : null,
                  )}
                  {item.agendados - item.pagos - item.reembolsados - item.cancelados > 0 && (
                    <span style={{ flex: item.agendados - item.pagos - item.reembolsados - item.cancelados }} />
                  )}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-fg">
                  {(
                    [
                      ["Pagos", item.pagos, "var(--st-esmeralda-fg)"],
                      ["Reembolsados", item.reembolsados, "var(--st-rosa-fg)"],
                      ["Cancelados", item.cancelados, "var(--st-cinza-fg)"],
                    ] as const
                  ).map(([rotulo, valor, cor]) => (
                    <span key={rotulo} className="inline-flex items-center gap-1.5">
                      <span className="size-2 rounded-full" style={{ backgroundColor: cor }} aria-hidden />
                      {rotulo}{" "}
                      <span className="tabular text-fg">
                        {fracao(valor, item) !== null ? formatPercentual(fracao(valor, item)!) : "—"}
                      </span>
                    </span>
                  ))}
                  <span>O restante segue em andamento ou inadimplente.</span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-[13px] font-medium text-muted-fg">Investimento por dia</span>
                <Grafico
                  pontos={pontos((d) => d.investimento)}
                  formatarValor={formatBRL}
                  formatarEixo={formatBRLCompacto}
                  altura={120}
                  rotuloAcessivel={`Investimento por dia, total ${formatBRL(totais.investimento)}`}
                />
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-[13px] font-medium text-muted-fg">Leads por dia</span>
                <Grafico
                  pontos={pontos((d) => d.leads)}
                  formatarValor={(v) => `${formatNumero(v)} leads`}
                  formatarEixo={formatNumero}
                  altura={100}
                  rotuloAcessivel={`Leads por dia, total ${formatNumero(totais.leads)}`}
                />
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-[13px] font-medium text-muted-fg">Vendas por dia</span>
                <Grafico
                  pontos={pontos((d) => d.vendas)}
                  formatarValor={(v) => `${formatNumero(v)} ${v === 1 ? "venda" : "vendas"}`}
                  formatarEixo={formatNumero}
                  altura={100}
                  rotuloAcessivel={`Vendas por dia, total ${formatNumero(totais.vendas)}`}
                />
              </div>
            </GavetaCorpo>
          </>
        )}
      </GavetaConteudo>
    </Gaveta>
  );
}

export default function PaginaMarketingCriativos() {
  const { criativos, linhas } = useCadastros();
  const { lancamentos, diasManuais } = useMarketing();
  const { pedidos } = usePedidos();

  const [periodo, setPeriodo] = useState<PeriodoAnalise>(() => periodoDoPreset("30d"));
  const [agrupamento, setAgrupamento] = useState<Agrupamento>("criativo");
  const [linhaId, setLinhaId] = useState("todas");
  const [status, setStatus] = useState<FiltroStatus>("todos");
  const [abertoId, setAbertoId] = useState<string | null>(null);

  const analise = useMemo(
    () => analisarCriativos(periodo.de, periodo.ate, criativos, linhas, lancamentos, diasManuais, pedidos),
    [periodo, criativos, linhas, lancamentos, diasManuais, pedidos],
  );

  // O não identificado passa por qualquer filtro: não tem linha nem status.
  const filtrada = analise.filter((item) => {
    if (!item.criativo) return true;
    if (linhaId !== "todas" && item.criativo.linhaWhatsappId !== linhaId) return false;
    if (status === "ativos" && !item.criativo.ativo) return false;
    if (status === "inativos" && item.criativo.ativo) return false;
    return true;
  });
  const dados = agrupamento === "linha" ? agruparPorLinha(filtrada, linhas) : filtrada;
  const aberto = analise.find((i) => i.id === abertoId) ?? null;

  const investimento = filtrada.reduce((s, i) => s + i.investimento, 0);
  const vendas = filtrada.reduce((s, i) => s + i.vendas, 0);
  const comVenda = filtrada.filter((i) => i.criativo && i.vendas > 0 && i.cpa !== null);
  const melhor = [...comVenda].sort((a, b) => a.cpa! - b.cpa!)[0];

  const colunas: Array<ColunaTabela<LinhaCriativo>> = useMemo(
    () => [
      {
        chave: "nome",
        titulo: agrupamento === "linha" ? "Linha" : "Criativo",
        ordenarPor: (i) => (i.criativo ? codigoCompleto(i.criativo) : (i.linha?.nome ?? "zzz")),
        render: (i) => <NomeLinha item={i} />,
      },
      ...(agrupamento === "criativo"
        ? [
            {
              chave: "linha",
              titulo: "Linha",
              escondeEm: "md" as const,
              ordenarPor: (i: LinhaCriativo) => i.linha?.nome ?? "",
              render: (i: LinhaCriativo) => <span className="text-muted-fg">{i.linha?.nome ?? "—"}</span>,
            },
          ]
        : []),
      {
        chave: "investimento",
        titulo: "Investimento",
        alinhamento: "direita",
        ordenarPor: (i) => i.investimento,
        render: (i) => formatBRL(i.investimento),
      },
      { chave: "leads", titulo: "Leads", alinhamento: "direita", escondeEm: "sm", ordenarPor: (i) => i.leads, render: (i) => formatNumero(i.leads) },
      { chave: "cpl", titulo: "CPL", alinhamento: "direita", escondeEm: "lg", ordenarPor: (i) => i.cpl ?? Infinity, render: (i) => <Custo valor={i.cpl} /> },
      { chave: "vendas", titulo: "Vendas", alinhamento: "direita", ordenarPor: (i) => i.vendas, render: (i) => formatNumero(i.vendas) },
      {
        chave: "cpa",
        titulo: "CPA",
        alinhamento: "direita",
        ordenarPor: (i) => i.cpa ?? Infinity,
        render: (i) => <span className="font-medium"><Custo valor={i.cpa} /></span>,
      },
      { chave: "faturamento", titulo: "Faturamento", alinhamento: "direita", escondeEm: "md", ordenarPor: (i) => i.faturamento, render: (i) => formatBRL(i.faturamento) },
      { chave: "pago", titulo: "% pago", alinhamento: "direita", escondeEm: "lg", ordenarPor: (i) => fracao(i.pagos, i) ?? -1, render: (i) => <Percentual parte={i.pagos} linha={i} /> },
      { chave: "reembolsado", titulo: "% reembolsado", alinhamento: "direita", escondeEm: "lg", ordenarPor: (i) => fracao(i.reembolsados, i) ?? -1, render: (i) => <Percentual parte={i.reembolsados} linha={i} /> },
      { chave: "cancelado", titulo: "% cancelado", alinhamento: "direita", escondeEm: "lg", ordenarPor: (i) => fracao(i.cancelados, i) ?? -1, render: (i) => <Percentual parte={i.cancelados} linha={i} /> },
    ],
    [agrupamento],
  );

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Criativos"
        descricao="Quanto cada criativo custou, quanto vendeu e como os pedidos dele terminaram."
        extras={<SeletorPeriodo valor={periodo} aoMudar={setPeriodo} />}
      />

      <LinhaIndicadores
        itens={[
          { icone: "dinheiro", valor: formatBRL(investimento), rotulo: "Investimento" },
          { icone: "pedidos", valor: formatNumero(vendas), rotulo: "Vendas" },
          { icone: "metaAds", valor: vendas > 0 ? formatBRL(Math.round(investimento / vendas)) : "—", rotulo: "CPA médio" },
          {
            icone: "ranking",
            valor: melhor?.criativo ? codigoCompleto(melhor.criativo) : "—",
            rotulo: melhor ? `Menor CPA, ${formatBRL(melhor.cpa!)}` : "Menor CPA",
          },
        ]}
      />

      <div className="flex flex-wrap items-center gap-2">
        <ControleSegmentado
          opcoes={[
            { valor: "criativo", rotulo: "Por criativo", icone: "criativos" },
            { valor: "linha", rotulo: "Por linha", icone: "whatsapp" },
          ]}
          valor={agrupamento}
          aoMudar={setAgrupamento}
        />
        <Selecao value={linhaId} onValueChange={setLinhaId}>
          <SelecaoGatilho className="w-auto min-w-40 rounded-full" aria-label="Linha de WhatsApp">
            <SelecaoValor />
          </SelecaoGatilho>
          <SelecaoConteudo>
            <SelecaoItem value="todas">Linha: todas</SelecaoItem>
            {linhas.map((l) => (
              <SelecaoItem key={l.id} value={l.id}>
                {l.nome}
              </SelecaoItem>
            ))}
          </SelecaoConteudo>
        </Selecao>
        <Selecao value={status} onValueChange={(v) => setStatus(v as FiltroStatus)}>
          <SelecaoGatilho className="w-auto min-w-40 rounded-full" aria-label="Status do criativo">
            <SelecaoValor />
          </SelecaoGatilho>
          <SelecaoConteudo>
            <SelecaoItem value="todos">Status: todos</SelecaoItem>
            <SelecaoItem value="ativos">Ativos</SelecaoItem>
            <SelecaoItem value="inativos">Inativos</SelecaoItem>
          </SelecaoConteudo>
        </Selecao>
      </div>

      <Tabela
        dados={dados}
        colunas={colunas}
        aoClicarLinha={agrupamento === "criativo" ? (i) => setAbertoId(i.id) : undefined}
        rodape={(visiveis) => {
          const inv = visiveis.reduce((s, i) => s + i.investimento, 0);
          const lds = visiveis.reduce((s, i) => s + i.leads, 0);
          const vds = visiveis.reduce((s, i) => s + i.vendas, 0);
          return {
            nome: "Total",
            investimento: formatBRL(inv),
            leads: formatNumero(lds),
            cpl: lds > 0 ? formatBRL(Math.round(inv / lds)) : "—",
            vendas: formatNumero(vds),
            cpa: vds > 0 ? formatBRL(Math.round(inv / vds)) : "—",
            faturamento: formatBRL(visiveis.reduce((s, i) => s + i.faturamento, 0)),
          };
        }}
      />
      <p className={cn("-mt-3 flex items-start gap-2 text-xs text-muted-fg")}>
        <Icone nome="info" size={13} className="mt-0.5 shrink-0" />
        Vendas são os pedidos agendados no período, sem cancelados; os percentuais contam todos os agendados.
        {agrupamento === "criativo" ? " Clique num criativo para ver a evolução diária." : ""}
      </p>

      <Detalhe item={aberto} periodo={periodo} aoFechar={() => setAbertoId(null)} />
    </div>
  );
}
