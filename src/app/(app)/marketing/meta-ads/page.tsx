"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  diaDaSemana,
  formatBRL,
  formatBRLCompacto,
  formatDia,
  formatDiaCurto,
  formatNumero,
} from "@/lib/format";
import { diasDeAds, totaisDosDias, type DiaAds } from "@/lib/meta-ads";
import { hoje, periodoDoPreset, type PeriodoAnalise } from "@/lib/periodos";
import { useMarketing } from "@/lib/providers/marketing";
import { usePedidos } from "@/lib/providers/pedidos";
import { Icone } from "@/components/icone";
import { BotaoAdicionar } from "@/components/ui/button";
import { Card, CardCabecalho, CardConteudo, CardDescricao, CardTitulo } from "@/components/ui/card";
import { Dica } from "@/components/ui/tooltip";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { Grafico } from "@/components/shared/grafico";
import { LinhaIndicadores } from "@/components/shared/indicadores";
import { SeletorPeriodo } from "@/components/shared/seletor-periodo";
import { SeloFonte } from "@/components/shared/selo-status";
import { Tabela, type ColunaTabela } from "@/components/shared/tabela";
import { ModalDiaMeta } from "@/components/marketing/modal-dia-meta";

function Custo({ valor }: { valor: number | null }) {
  return valor === null ? (
    <span className="text-muted-fg/60">—</span>
  ) : (
    <span className="tabular">{formatBRL(valor)}</span>
  );
}

export default function PaginaMarketingMetaAds() {
  const { lancamentos, diasManuais } = useMarketing();
  const { pedidos } = usePedidos();
  const [periodo, setPeriodo] = useState<PeriodoAnalise>(() => periodoDoPreset("30d"));
  const [lancando, setLancando] = useState<{ dia: string | null } | null>(null);

  const dias = useMemo(
    () => diasDeAds(periodo.de, periodo.ate, lancamentos, diasManuais, pedidos),
    [periodo, lancamentos, diasManuais, pedidos],
  );
  const totais = totaisDosDias(dias);
  const semLancamento = dias.filter((d) => d.fonte === null && d.data <= hoje()).length;

  const colunas: Array<ColunaTabela<DiaAds>> = useMemo(
    () => [
      {
        chave: "data",
        titulo: "Data",
        ordenarPor: (d) => d.data,
        render: (d) => (
          <span className="tabular">
            {formatDia(d.data)} <span className="text-muted-fg">{diaDaSemana(d.data)}</span>
          </span>
        ),
      },
      {
        chave: "investimento",
        titulo: "Investimento",
        alinhamento: "direita",
        ordenarPor: (d) => d.investimento,
        render: (d) => (
          <span className={cn(d.investimento === 0 && "text-muted-fg/60")}>{formatBRL(d.investimento)}</span>
        ),
      },
      {
        chave: "leads",
        titulo: "Leads",
        alinhamento: "direita",
        ordenarPor: (d) => d.leads,
        render: (d) => formatNumero(d.leads),
      },
      {
        chave: "cpl",
        titulo: "CPL",
        alinhamento: "direita",
        escondeEm: "md",
        ordenarPor: (d) => d.cpl ?? Number.MAX_SAFE_INTEGER,
        render: (d) => <Custo valor={d.cpl} />,
      },
      {
        chave: "vendas",
        titulo: "Vendas do dia",
        alinhamento: "direita",
        ordenarPor: (d) => d.vendas,
        render: (d) => formatNumero(d.vendas),
      },
      {
        chave: "cpa",
        titulo: "CPA",
        alinhamento: "direita",
        ordenarPor: (d) => d.cpa ?? Number.MAX_SAFE_INTEGER,
        render: (d) => <Custo valor={d.cpa} />,
      },
      {
        chave: "fonte",
        titulo: "Fonte",
        alinhamento: "direita",
        escondeEm: "sm",
        ordenarPor: (d) => d.fonte ?? "",
        render: (d) =>
          d.fonte ? (
            <SeloFonte fonte={d.fonte} integracao="API do Meta" />
          ) : (
            <span className="text-xs text-muted-fg">Sem lançamento</span>
          ),
      },
    ],
    [],
  );

  // Gráficos em ordem cronológica, mesmo que a tabela abra do mais recente.
  const pontosInvestimento = dias.map((d) => ({
    id: d.data,
    rotulo: formatDiaCurto(d.data),
    tituloDica: `${formatDia(d.data)}, ${diaDaSemana(d.data)}`,
    valor: d.investimento,
    dica: `${formatNumero(d.leads)} leads · ${formatNumero(d.vendas)} vendas`,
  }));
  const pontosCpa = dias.map((d) => ({
    id: d.data,
    rotulo: formatDiaCurto(d.data),
    tituloDica: `${formatDia(d.data)}, ${diaDaSemana(d.data)}`,
    valor: d.cpa,
    dica: d.cpa === null ? "Sem venda no dia" : `${formatBRL(d.investimento)} ÷ ${d.vendas} vendas`,
  }));

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Meta Ads"
        descricao="Investimento, leads e custo por venda, dia a dia. A análise por criativo fica em Criativos."
        extras={<SeletorPeriodo valor={periodo} aoMudar={setPeriodo} />}
        acao={
          <Dica conteudo="Lançar dia manualmente">
            <BotaoAdicionar aria-label="Lançar dia manualmente" onClick={() => setLancando({ dia: null })}>
              <Icone nome="adicionar" />
            </BotaoAdicionar>
          </Dica>
        }
      />

      <LinhaIndicadores
        itens={[
          { icone: "dinheiro", valor: formatBRL(totais.investimento), rotulo: "Investimento" },
          { icone: "conversa", valor: formatNumero(totais.leads), rotulo: "Leads" },
          { icone: "etiqueta", valor: totais.cpl !== null ? formatBRL(totais.cpl) : "—", rotulo: "CPL" },
          { icone: "pedidos", valor: formatNumero(totais.vendas), rotulo: "Vendas" },
          { icone: "metaAds", valor: totais.cpa !== null ? formatBRL(totais.cpa) : "—", rotulo: "CPA" },
        ]}
      />

      <Card>
        <CardCabecalho>
          <div className="flex flex-col gap-1">
            <CardTitulo>Investimento × CPA</CardTitulo>
            <CardDescricao>
              Dois gráficos no mesmo eixo de dias: o que foi investido e quanto custou cada venda.
            </CardDescricao>
          </div>
        </CardCabecalho>
        <CardConteudo className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-medium text-muted-fg">Investimento por dia</span>
            <Grafico
              pontos={pontosInvestimento}
              formatarValor={formatBRL}
              formatarEixo={formatBRLCompacto}
              altura={150}
              rotuloAcessivel={`Investimento por dia, total de ${formatBRL(totais.investimento)}`}
            />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-medium text-muted-fg">CPA por dia</span>
            <Grafico
              tipo="linha"
              pontos={pontosCpa}
              formatarValor={formatBRL}
              formatarEixo={formatBRLCompacto}
              altura={150}
              rotuloAcessivel={`CPA por dia, média de ${totais.cpa !== null ? formatBRL(totais.cpa) : "sem vendas"}`}
            />
          </div>
        </CardConteudo>
      </Card>

      {semLancamento > 0 && (
        <p className="flex items-center gap-2 text-[13px] text-muted-fg">
          <Icone nome="alerta" size={15} className="shrink-0 text-[var(--st-bronze-fg)]" />
          {semLancamento === 1 ? "1 dia do período está" : `${semLancamento} dias do período estão`} sem
          investimento lançado: o CPA desses dias aparece vazio.
        </p>
      )}

      <Tabela
        dados={[...dias].reverse()}
        colunas={colunas}
        densidade="compacta"
        aoClicarLinha={(d) => {
          if (d.fonte !== "api") setLancando({ dia: d.data });
        }}
        rodape={(visiveis) => {
          const t = totaisDosDias(visiveis);
          return {
            data: "Total do período",
            investimento: formatBRL(t.investimento),
            leads: formatNumero(t.leads),
            cpl: t.cpl !== null ? formatBRL(t.cpl) : "—",
            vendas: formatNumero(t.vendas),
            cpa: t.cpa !== null ? formatBRL(t.cpa) : "—",
          };
        }}
      />
      <p className="-mt-3 text-xs text-muted-fg">
        Dias da API não se editam. Clique num dia manual ou sem lançamento para lançar os números.
      </p>

      <ModalDiaMeta aberto={lancando !== null} dia={lancando?.dia ?? null} aoFechar={() => setLancando(null)} />
    </div>
  );
}
