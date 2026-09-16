"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  formatBps,
  formatBRL,
  formatBRLCompacto,
  formatCompetencia,
  formatCompetenciaCurta,
  formatDiaCurto,
  formatNumero,
  formatPercentual,
} from "@/lib/format";
import { ultimasCompetencias } from "@/lib/periodos";
import {
  calcularDre,
  preverEntradas,
  type Dre,
  type LinhaDre,
  type ModoRelatorio,
} from "@/lib/resultado";
import { SITUACAO_ALIQUOTA } from "@/lib/status";
import { usePedidos } from "@/lib/providers/pedidos";
import { Icone } from "@/components/icone";
import { Botao } from "@/components/ui/button";
import { Card, CardCabecalho, CardConteudo, CardDescricao, CardTitulo } from "@/components/ui/card";
import {
  Selecao,
  SelecaoConteudo,
  SelecaoGatilho,
  SelecaoItem,
  SelecaoValor,
} from "@/components/ui/select";
import { Interruptor } from "@/components/ui/switch";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { ControleSegmentado } from "@/components/shared/controles";
import { Grafico } from "@/components/shared/grafico";
import { LinhaIndicadores } from "@/components/shared/indicadores";
import { SeloTom } from "@/components/shared/selo-status";
import { Tabela, type ColunaTabela } from "@/components/shared/tabela";
import { useFontesResultado } from "@/components/financeiro/fontes";
import { ModalAliquota } from "@/components/financeiro/modais-relatorio";
import {
  SecaoAliquotas,
  SecaoDespesas,
  SecaoDividas,
} from "@/components/financeiro/secoes-relatorio";

type Secao = "resultado" | "despesas" | "dividas" | "aliquotas";

const MESES_COMPARATIVO = 6;

function maiuscula(texto: string) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Cor do número com sinal: prejuízo em vermelho, lucro em verde. Tons fixos de status. */
function corDoResultado(valor: number) {
  if (valor === 0) return undefined;
  return valor > 0 ? "var(--st-esmeralda-fg)" : "var(--st-carmim-fg)";
}

function ValorDre({ linha }: { linha: LinhaDre }) {
  const valor = linha.valor || 0; // sem "-R$ 0,00"
  if (linha.naoSeAplica) return <span className="text-xs text-muted-fg/70">não se aplica</span>;
  const destaque = linha.tipo === "subtotal" || linha.tipo === "resultado";
  return (
    <span
      className={cn(
        "tabular whitespace-nowrap",
        destaque ? "font-medium" : valor === 0 && "text-muted-fg/60",
        linha.tipo === "resultado" && "text-lg",
      )}
      style={destaque ? { color: corDoResultado(valor) } : undefined}
    >
      {linha.tipo === "deducao" && valor < 0 ? `− ${formatBRL(-valor)}` : formatBRL(valor)}
    </span>
  );
}

function CardDre({
  dre,
  aoLancarAliquota,
}: {
  dre: Dre;
  aoLancarAliquota: (competencia: string) => void;
}) {
  const [explicar, setExplicar] = useState(false);
  const base = dre.linhas.find((l) => l.chave === "vendas")?.valor ?? 0;

  return (
    <Card>
      <CardCabecalho className="flex-wrap">
        <div className="flex flex-col gap-1">
          <CardTitulo>
            DRE de {formatCompetencia(dre.competencia)} · {dre.modo === "caixa" ? "caixa" : "competência"}
          </CardTitulo>
          <CardDescricao>
            {dre.modo === "caixa"
              ? "O que entrou e saiu da conta no mês, inclusive recebimentos de vendas de meses anteriores."
              : "O resultado das vendas agendadas no mês, com os custos previstos dos envios delas."}
          </CardDescricao>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-fg">
          <Interruptor checked={explicar} onCheckedChange={setExplicar} aria-label="Mostrar de onde vem cada número" />
          De onde vem cada número
        </label>
      </CardCabecalho>
      <CardConteudo>
        {dre.emAberto && (
          <p className="mb-4 flex items-start gap-2 rounded-[var(--radius-card-sm)] bg-surface-2 px-4 py-3 text-[13px] text-muted-fg">
            <Icone nome="relogio" size={15} className="mt-0.5 shrink-0" />
            Mês em aberto: os números mudam a cada pedido, pagamento e lançamento até o fim do mês.
          </p>
        )}
        <div className="flex flex-col">
          <div className="flex items-center justify-between gap-4 border-b border-border pb-2 text-[12px] text-muted-fg">
            <span>Linha</span>
            <span className="flex gap-6">
              <span className="hidden w-16 text-right sm:inline">% vendas</span>
              <span className="w-32 text-right">Valor</span>
            </span>
          </div>
          {dre.linhas.map((linha) => {
            const destaque = linha.tipo === "subtotal" || linha.tipo === "resultado";
            return (
              <div
                key={linha.chave}
                className={cn(
                  "flex items-start justify-between gap-4 py-2.5",
                  destaque ? "border-t border-border-strong" : "border-t border-border/50 first:border-t-0",
                  linha.tipo === "resultado" && "mt-1 rounded-[var(--radius-input)] bg-surface-2 px-3",
                  linha.naoSeAplica && "opacity-60",
                )}
              >
                <div className={cn("flex min-w-0 flex-col gap-0.5", linha.tipo === "deducao" && "pl-4")}>
                  <span className={cn("flex flex-wrap items-center gap-2 text-[13px]", destaque && "font-medium")}>
                    <span className="tabular w-3 text-muted-fg">
                      {linha.tipo === "deducao" ? "−" : destaque ? "=" : ""}
                    </span>
                    {linha.rotulo}
                    {linha.chave === "impostos" && (
                      <>
                        <SeloTom tom={SITUACAO_ALIQUOTA[dre.aliquota.situacao].tom} className="py-0.5 text-[11px]">
                          {SITUACAO_ALIQUOTA[dre.aliquota.situacao].rotulo} · {formatBps(dre.aliquota.aliquotaBps)}
                        </SeloTom>
                        <Botao
                          variante="fantasma"
                          tamanho="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => aoLancarAliquota(dre.aliquota.competencia)}
                        >
                          {dre.aliquota.situacao === "estimada" ? "Lançar alíquota" : "Corrigir"}
                        </Botao>
                      </>
                    )}
                  </span>
                  {(explicar || (linha.chave === "impostos" && dre.aliquota.situacao === "estimada")) && (
                    <span className="pl-5 text-xs text-muted-fg">
                      {linha.chave === "impostos" && dre.aliquota.situacao === "estimada"
                        ? dre.aliquota.origem
                          ? `Sem alíquota confirmada para ${formatCompetencia(dre.aliquota.competencia)}: usando a de ${formatCompetencia(dre.aliquota.origem)}. `
                          : "Nenhuma alíquota lançada ainda: imposto zerado. "
                        : ""}
                      {explicar ? linha.ajuda : ""}
                    </span>
                  )}
                </div>
                <span className="flex shrink-0 items-start gap-6">
                  <span className="tabular hidden w-16 text-right text-xs text-muted-fg sm:inline">
                    {!linha.naoSeAplica && base > 0
                      ? `${linha.tipo !== "deducao" && linha.valor < 0 ? "−" : ""}${formatPercentual(Math.abs(linha.valor) / base)}`
                      : ""}
                  </span>
                  <span className="w-32 text-right">
                    <ValorDre linha={linha} />
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      </CardConteudo>
    </Card>
  );
}

interface LinhaComparativo {
  id: string;
  competencia: string;
  receita: number;
  margem: number;
  lucroOperacional: number;
  resultado: number;
  emAberto: boolean;
}

function CardComparativo({
  dres,
  modo,
  competencia,
  aoEscolher,
}: {
  dres: Dre[];
  modo: ModoRelatorio;
  competencia: string;
  aoEscolher: (competencia: string) => void;
}) {
  const linhas: LinhaComparativo[] = dres.map((d) => ({
    id: d.competencia,
    competencia: d.competencia,
    receita: d.receita,
    margem: d.margem,
    lucroOperacional: d.lucroOperacional,
    resultado: d.resultado,
    emAberto: d.emAberto,
  }));

  const colunas: Array<ColunaTabela<LinhaComparativo>> = [
    {
      chave: "mes",
      titulo: "Mês",
      render: (l) => (
        <span className={cn("flex items-center gap-2", l.competencia === competencia && "font-medium")}>
          {maiuscula(formatCompetencia(l.competencia))}
          {l.emAberto && <SeloTom tom="bronze" className="py-0 text-[11px]">Em aberto</SeloTom>}
        </span>
      ),
    },
    { chave: "receita", titulo: "Receita recebida", alinhamento: "direita", escondeEm: "sm", render: (l) => formatBRL(l.receita) },
    { chave: "margem", titulo: "Margem", alinhamento: "direita", escondeEm: "md", render: (l) => formatBRL(l.margem) },
    {
      chave: "lucro",
      titulo: "Lucro operacional",
      alinhamento: "direita",
      escondeEm: "md",
      render: (l) => <span style={{ color: corDoResultado(l.lucroOperacional) }}>{formatBRL(l.lucroOperacional)}</span>,
    },
    {
      chave: "resultado",
      titulo: "Resultado final",
      alinhamento: "direita",
      render: (l) => (
        <span className="inline-flex items-center gap-1.5 font-medium" style={{ color: corDoResultado(l.resultado) }}>
          <Icone nome={l.resultado >= 0 ? "subiu" : "desceu"} size={12} />
          {formatBRL(l.resultado)}
        </span>
      ),
    },
  ];

  return (
    <Card>
      <CardCabecalho>
        <div className="flex flex-col gap-1">
          <CardTitulo>Lucro ou prejuízo, mês a mês</CardTitulo>
          <CardDescricao>
            Resultado final dos últimos {dres.length} meses, na leitura de {modo === "caixa" ? "caixa" : "competência"}.
            Clique num mês para abrir a DRE dele.
          </CardDescricao>
        </div>
      </CardCabecalho>
      <CardConteudo className="flex flex-col gap-5">
        <Grafico
          pontos={linhas.map((l) => ({
            id: l.competencia,
            rotulo: formatCompetenciaCurta(l.competencia),
            tituloDica: `${maiuscula(formatCompetencia(l.competencia))}${l.emAberto ? " (em aberto)" : ""}`,
            valor: l.resultado,
            dica: (
              <>
                <div>{l.resultado >= 0 ? "Lucro" : "Prejuízo"}</div>
                <div>Lucro operacional {formatBRL(l.lucroOperacional)}</div>
              </>
            ),
          }))}
          formatarValor={formatBRL}
          formatarEixo={formatBRLCompacto}
          cor="var(--st-esmeralda-fg)"
          corNegativa="var(--st-carmim-fg)"
          altura={180}
          maxRotulos={12}
          rotuloAcessivel="Resultado final por mês, lucro acima de zero e prejuízo abaixo"
        />
        <Tabela dados={linhas} colunas={colunas} densidade="compacta" aoClicarLinha={(l) => aoEscolher(l.competencia)} />
      </CardConteudo>
    </Card>
  );
}

function CardPrevisao() {
  const { pedidos } = usePedidos();
  const previsao = useMemo(() => preverEntradas(pedidos), [pedidos]);
  const taxa = (valor: number | null) => (valor === null ? "—" : formatPercentual(valor));

  return (
    <Card>
      <CardCabecalho>
        <div className="flex flex-col gap-1">
          <CardTitulo>Entrada prevista nos próximos 30 dias</CardTitulo>
          <CardDescricao>
            Pedidos em trânsito e à espera do pagamento, multiplicados pela taxa histórica de recebimento de cada etapa.
          </CardDescricao>
        </div>
      </CardCabecalho>
      <CardConteudo className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <span className="tabular text-3xl font-medium tracking-tight">{formatBRL(previsao.total30Dias)}</span>
          <span className="text-[13px] text-muted-fg">
            Estimativa de entrada até {formatDiaCurto(previsao.faixas[previsao.faixas.length - 1].ate)}
            {previsao.depois > 0 ? `, mais ${formatBRL(previsao.depois)} depois disso` : ""}.
          </span>
        </div>

        <Grafico
          pontos={previsao.faixas.map((f) => ({
            id: f.id,
            rotulo: `${formatDiaCurto(f.de)}`,
            tituloDica: `${formatDiaCurto(f.de)} a ${formatDiaCurto(f.ate)}`,
            valor: f.valor,
            dica: `${formatNumero(f.pedidos)} pedidos`,
          }))}
          formatarValor={formatBRL}
          formatarEixo={formatBRLCompacto}
          altura={140}
          maxRotulos={5}
          rotuloAcessivel={`Entrada prevista por semana, total ${formatBRL(previsao.total30Dias)}`}
        />

        <ul className="flex flex-col rounded-[var(--radius-card-sm)] border border-border text-[13px]">
          {[
            {
              rotulo: "Em trânsito",
              detalhe: `${formatNumero(previsao.emTransito.pedidos)} pedidos · ${formatBRL(previsao.emTransito.valor)} × ${taxa(previsao.taxaEnviados)} recebido historicamente dos enviados · paga em ~${Math.round(previsao.diasAtePagamentoEnvio)} dias do envio`,
              valor: previsao.emTransito.esperado,
            },
            {
              rotulo: "Entregue, aguardando pagamento",
              detalhe: `${formatNumero(previsao.aguardando.pedidos)} pedidos · ${formatBRL(previsao.aguardando.valor)} × ${taxa(previsao.taxaEntregues)} recebido historicamente dos entregues · paga em ~${Math.max(1, Math.round(previsao.diasAtePagamentoEntrega))} dias da entrega`,
              valor: previsao.aguardando.esperado,
            },
          ].map((item, i) => (
            <li key={item.rotulo} className={cn("flex items-start justify-between gap-4 px-4 py-3", i > 0 && "border-t border-border")}>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="font-medium">{item.rotulo}</span>
                <span className="tabular text-xs text-muted-fg">{item.detalhe}</span>
              </div>
              <span className="tabular shrink-0 font-medium">{formatBRL(item.valor)}</span>
            </li>
          ))}
        </ul>
      </CardConteudo>
    </Card>
  );
}

export default function PaginaFinanceiroRelatorio() {
  const fontes = useFontesResultado();
  const competencias = useMemo(() => ultimasCompetencias(MESES_COMPARATIVO), []);
  const [secao, setSecao] = useState<Secao>("resultado");
  const [competencia, setCompetencia] = useState(competencias[0]);
  const [modo, setModo] = useState<ModoRelatorio>("caixa");
  const [aliquotaAberta, setAliquotaAberta] = useState<string | null>(null);

  const dres = useMemo(
    () => [...competencias].reverse().map((c) => calcularDre(c, modo, fontes)),
    [competencias, modo, fontes],
  );
  const dre = dres.find((d) => d.competencia === competencia) ?? dres[dres.length - 1];
  const margemPct = dre.receita > 0 ? formatPercentual(dre.margem / dre.receita) : "—";

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Relatório financeiro"
        descricao="Resultado do mês em caixa ou competência, despesas fixas, dívidas e a previsão de entrada."
        extras={
          secao === "resultado" ? (
            <div className="flex flex-wrap items-center gap-2">
              <Selecao value={competencia} onValueChange={setCompetencia}>
                <SelecaoGatilho className="w-auto min-w-44 rounded-full" aria-label="Mês">
                  <SelecaoValor />
                </SelecaoGatilho>
                <SelecaoConteudo>
                  {competencias.map((c, i) => (
                    <SelecaoItem key={c} value={c}>
                      {maiuscula(formatCompetencia(c))}
                      {i === 0 ? " (em aberto)" : ""}
                    </SelecaoItem>
                  ))}
                </SelecaoConteudo>
              </Selecao>
              <ControleSegmentado
                opcoes={[
                  { valor: "caixa", rotulo: "Caixa" },
                  { valor: "competencia", rotulo: "Competência" },
                ]}
                valor={modo}
                aoMudar={setModo}
              />
            </div>
          ) : undefined
        }
      />

      <ControleSegmentado
        opcoes={[
          { valor: "resultado", rotulo: "Resultado", icone: "relatorio" },
          { valor: "despesas", rotulo: "Despesas fixas", icone: "documento" },
          { valor: "dividas", rotulo: "Dívidas", icone: "financeiro" },
          { valor: "aliquotas", rotulo: "Alíquotas do Simples", icone: "percentual" },
        ]}
        valor={secao}
        aoMudar={setSecao}
      />

      {secao === "resultado" && (
        <>
          <LinhaIndicadores
            itens={[
              { icone: "dinheiro", valor: formatBRL(dre.receita), rotulo: "Receita recebida" },
              { icone: "percentual", valor: formatBRL(dre.margem), rotulo: `Margem de contribuição, ${margemPct}` },
              {
                icone: "tendencia",
                valor: formatBRL(dre.lucroOperacional),
                rotulo: "Lucro operacional",
                direcao: dre.lucroOperacional >= 0 ? "subiu" : "desceu",
                variacao: dre.lucroOperacional >= 0 ? "lucro" : "prejuízo",
              },
              {
                icone: "relatorio",
                valor: formatBRL(dre.resultado),
                rotulo: "Resultado final",
                direcao: dre.resultado >= 0 ? "subiu" : "desceu",
                variacao: dre.resultado >= 0 ? "lucro" : "prejuízo",
              },
            ]}
          />

          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <CardDre dre={dre} aoLancarAliquota={setAliquotaAberta} />
            <CardPrevisao />
          </div>
          <CardComparativo dres={dres} modo={modo} competencia={dre.competencia} aoEscolher={setCompetencia} />
        </>
      )}
      {secao === "despesas" && <SecaoDespesas />}
      {secao === "dividas" && <SecaoDividas />}
      {secao === "aliquotas" && <SecaoAliquotas />}

      <ModalAliquota competencia={aliquotaAberta} aoFechar={() => setAliquotaAberta(null)} />
    </div>
  );
}
