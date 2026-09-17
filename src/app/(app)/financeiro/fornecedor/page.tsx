"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { FaturaFornecedor, PagamentoFornecedor, Pedido } from "@/lib/types";
import {
  formatBRL,
  formatBytes,
  formatData,
  formatDia,
  formatNumero,
  formatPercentual,
} from "@/lib/format";
import {
  baixarArquivo,
  conferir,
  csvReembolsados,
  custosPrevistos,
  potesDoPedido,
  reembolsadosNo,
  somarCustos,
  TOLERANCIA_CONFERENCIA,
  totalPago,
  type Conferencia,
  type CustoPrevisto,
} from "@/lib/fornecedor";
import { intervaloDeDias, periodoDoPreset, type PeriodoAnalise } from "@/lib/periodos";
import { SITUACAO_CUSTO_FORNECEDOR } from "@/lib/status";
import { useCadastros } from "@/lib/providers/cadastros";
import { useFinanceiro } from "@/lib/providers/financeiro";
import { usePedidos } from "@/lib/providers/pedidos";
import { Icone } from "@/components/icone";
import { Botao, BotaoAdicionar } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dica } from "@/components/ui/tooltip";
import { toast } from "@/components/ui/toast";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { ControleSegmentado } from "@/components/shared/controles";
import { EstadoVazio } from "@/components/shared/estado-vazio";
import { LinhaIndicadores } from "@/components/shared/indicadores";
import { ModalConfirmacao } from "@/components/shared/modal-confirmacao";
import { SeletorPeriodo } from "@/components/shared/seletor-periodo";
import { SeloStatusPedido, SeloTom } from "@/components/shared/selo-status";
import { Tabela, type ColunaTabela } from "@/components/shared/tabela";
import {
  ModalFaturaFornecedor,
  ModalPagamentoFornecedor,
  ModalParametrosFornecedor,
} from "@/components/financeiro/modais-fornecedor";

type Secao = "custos" | "pagamentos" | "reembolsados" | "conferencia";

export default function PaginaFinanceiroFornecedor() {
  const { pedidos } = usePedidos();
  const { kits } = useCadastros();
  const { parametros, pagamentosFornecedor, faturas, excluirPagamentoFornecedor } = useFinanceiro();

  const [secao, setSecao] = useState<Secao>("custos");
  const [periodo, setPeriodo] = useState<PeriodoAnalise>(() => periodoDoPreset("mes"));
  const [editandoParametros, setEditandoParametros] = useState(false);
  const [lancandoPagamento, setLancandoPagamento] = useState(false);
  const [fatura, setFatura] = useState<{ fatura: FaturaFornecedor | null } | null>(null);
  const [removendo, setRemovendo] = useState<PagamentoFornecedor | null>(null);

  const intervalo = useMemo(() => intervaloDeDias(periodo.de, periodo.ate), [periodo]);
  const todosCustos = useMemo(() => custosPrevistos(pedidos, parametros, kits), [pedidos, parametros, kits]);
  const previstoTotal = somarCustos(todosCustos).total;
  const pagoTotal = totalPago(pagamentosFornecedor);
  const saldo = previstoTotal - pagoTotal;

  const custosDoPeriodo = useMemo(
    () => custosPrevistos(pedidos, parametros, kits, intervalo),
    [pedidos, parametros, kits, intervalo],
  );
  const reembolsados = useMemo(() => reembolsadosNo(pedidos, intervalo), [pedidos, intervalo]);
  const conferencias = useMemo(
    () =>
      faturas
        .map((f) => conferir(f, pedidos, parametros, kits))
        .sort((a, b) => b.fatura.de.localeCompare(a.fatura.de)),
    [faturas, pedidos, parametros, kits],
  );
  const pagamentosOrdenados = useMemo(
    () => [...pagamentosFornecedor].sort((a, b) => b.pagoEm.localeCompare(a.pagoEm)),
    [pagamentosFornecedor],
  );

  const colunasCustos: Array<ColunaTabela<CustoPrevisto>> = useMemo(
    () => [
      {
        chave: "pedido",
        titulo: "Pedido",
        ordenarPor: (c) => c.pedido.codigo,
        render: (c) => (
          <div className="flex min-w-0 flex-col">
            <span className="tabular font-medium">{c.pedido.codigo}</span>
            <span className="truncate text-[11px] text-muted-fg">{c.pedido.cliente.nome}</span>
          </div>
        ),
      },
      {
        chave: "enviado",
        titulo: "Enviado em",
        escondeEm: "sm",
        ordenarPor: (c) => c.enviadoEm,
        render: (c) => <span className="tabular text-muted-fg">{formatData(c.enviadoEm)}</span>,
      },
      {
        chave: "status",
        titulo: "Status",
        escondeEm: "md",
        ordenarPor: (c) => c.pedido.status,
        render: (c) => <SeloStatusPedido status={c.pedido.status} />,
      },
      {
        chave: "composicao",
        titulo: "Composição",
        escondeEm: "lg",
        ordenarPor: (c) => c.situacao,
        render: (c) => (
          <SeloTom tom={SITUACAO_CUSTO_FORNECEDOR[c.situacao].tom} ponto={false}>
            {SITUACAO_CUSTO_FORNECEDOR[c.situacao].rotulo}
          </SeloTom>
        ),
      },
      { chave: "potes", titulo: "Potes", alinhamento: "direita", ordenarPor: (c) => c.potes, render: (c) => formatNumero(c.potes) },
      { chave: "frete", titulo: "Frete", alinhamento: "direita", escondeEm: "sm", ordenarPor: (c) => c.frete, render: (c) => formatBRL(c.frete) },
      {
        chave: "valorPotes",
        titulo: "Potes (R$)",
        alinhamento: "direita",
        escondeEm: "sm",
        ordenarPor: (c) => c.valorPotes,
        render: (c) => <span className={cn(c.valorPotes === 0 && "text-muted-fg/60")}>{formatBRL(c.valorPotes)}</span>,
      },
      {
        chave: "total",
        titulo: "Previsto",
        alinhamento: "direita",
        ordenarPor: (c) => c.total,
        render: (c) => <span className="font-medium">{formatBRL(c.total)}</span>,
      },
    ],
    [],
  );

  const colunasPagamentos: Array<ColunaTabela<PagamentoFornecedor>> = useMemo(
    () => [
      { chave: "data", titulo: "Data", ordenarPor: (p) => p.pagoEm, render: (p) => <span className="tabular">{formatData(p.pagoEm)}</span> },
      {
        chave: "observacoes",
        titulo: "Descrição",
        render: (p) => <span className="text-muted-fg">{p.observacoes ?? "—"}</span>,
      },
      {
        chave: "comprovante",
        titulo: "Comprovante",
        escondeEm: "md",
        render: (p) =>
          p.comprovante ? (
            <span className="inline-flex max-w-60 items-center gap-1.5 text-[13px]">
              <Icone nome="anexo" size={14} className="shrink-0 text-muted-fg" />
              <span className="truncate">{p.comprovante.nome}</span>
              <span className="tabular shrink-0 text-xs text-muted-fg">{formatBytes(p.comprovante.tamanhoBytes)}</span>
            </span>
          ) : (
            <SeloTom tom="bronze">Sem comprovante</SeloTom>
          ),
      },
      {
        chave: "valor",
        titulo: "Valor",
        alinhamento: "direita",
        ordenarPor: (p) => p.valor,
        render: (p) => <span className="font-medium">{formatBRL(p.valor)}</span>,
      },
      {
        chave: "acoes",
        titulo: "",
        alinhamento: "direita",
        render: (p) => (
          <Botao
            variante="fantasma"
            tamanho="iconeSm"
            aria-label="Remover pagamento"
            onClick={(e) => {
              e.stopPropagation();
              setRemovendo(p);
            }}
          >
            <Icone nome="excluir" size={14} />
          </Botao>
        ),
      },
    ],
    [],
  );

  const colunasReembolsados: Array<ColunaTabela<Pedido>> = useMemo(
    () => [
      {
        chave: "pedido",
        titulo: "Pedido",
        ordenarPor: (p) => p.codigo,
        render: (p) => (
          <div className="flex min-w-0 flex-col">
            <span className="tabular font-medium">{p.codigo}</span>
            <span className="truncate text-[11px] text-muted-fg">{p.cliente.nome}</span>
          </div>
        ),
      },
      { chave: "rastreio", titulo: "Rastreio", escondeEm: "md", render: (p) => <span className="tabular text-muted-fg">{p.rastreio?.codigo ?? "—"}</span> },
      { chave: "enviado", titulo: "Enviado em", ordenarPor: (p) => p.autorizadoEm ?? "", render: (p) => <span className="tabular">{formatData(p.autorizadoEm)}</span> },
      {
        chave: "motivo",
        titulo: "Motivo",
        escondeEm: "lg",
        render: (p) => <span className="text-muted-fg">{p.rastreio?.motivoFalha ?? p.observacoes ?? "—"}</span>,
      },
      { chave: "kit", titulo: "Kit", escondeEm: "sm", render: (p) => p.itens.map((i) => i.kitNome).join(", ") },
      {
        chave: "potes",
        titulo: "Potes a abater",
        alinhamento: "direita",
        ordenarPor: (p) => potesDoPedido(p, kits),
        render: (p) => <span className="font-medium">{formatNumero(potesDoPedido(p, kits))}</span>,
      },
    ],
    [kits],
  );

  const colunasConferencia: Array<ColunaTabela<Conferencia>> = useMemo(
    () => [
      {
        chave: "periodo",
        titulo: "Envios",
        ordenarPor: (c) => c.fatura.de,
        render: (c) => (
          <div className="flex flex-col">
            <span className="tabular font-medium">
              {formatDia(c.fatura.de)} a {formatDia(c.fatura.ate)}
            </span>
            <span className="text-[11px] text-muted-fg">
              {c.fatura.numero ?? "Sem número"} · {formatNumero(c.envios)} envios
            </span>
          </div>
        ),
      },
      { chave: "previsto", titulo: "Previsto", alinhamento: "direita", ordenarPor: (c) => c.previsto, render: (c) => formatBRL(c.previsto) },
      { chave: "cobrado", titulo: "Cobrado", alinhamento: "direita", ordenarPor: (c) => c.fatura.valorCobrado, render: (c) => formatBRL(c.fatura.valorCobrado) },
      {
        chave: "diferenca",
        titulo: "Diferença",
        alinhamento: "direita",
        ordenarPor: (c) => c.diferenca,
        render: (c) => <Diferenca conferencia={c} />,
      },
    ],
    [],
  );

  const totaisPeriodo = somarCustos(custosDoPeriodo);
  const potesAbater = reembolsados.reduce((s, p) => s + potesDoPedido(p, kits), 0);

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Fornecedor"
        descricao={`Custo previsto dos envios, pagamentos e conferência de fatura com ${parametros.fornecedor}.`}
      />

      <div className="flex flex-col gap-3">
        <LinhaIndicadores
          itens={[
            { icone: "fornecedor", valor: formatBRL(previstoTotal), rotulo: "Previsto (estimativa)" },
            { icone: "checkCircle", valor: formatBRL(pagoTotal), rotulo: "Pago" },
            {
              icone: saldo > 0 ? "relogio" : "check",
              valor: formatBRL(Math.abs(saldo)),
              rotulo: saldo >= 0 ? "Saldo a pagar" : "Pago a mais",
            },
          ]}
        />
        <p className="flex items-start gap-2 text-[13px] text-muted-fg">
          <Icone nome="info" size={15} className="mt-0.5 shrink-0" />
          O previsto é uma estimativa: soma frete e potes de cada envio pelos parâmetros abaixo, não o que o
          fornecedor faturou. A conferência de fatura mostra a diferença.
        </p>
      </div>

      <Card className="flex flex-wrap items-center gap-x-8 gap-y-3 p-5">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-fg">Custo por pote</span>
          <span className="tabular text-lg font-medium">{formatBRL(parametros.custoPote)}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-fg">Frete por envio</span>
          <span className="tabular text-lg font-medium">{formatBRL(parametros.freteEnvio)}</span>
        </div>
        <div className="flex min-w-48 flex-1 flex-col gap-0.5 text-xs text-muted-fg">
          <span>Entregue, pago ou inadimplente: frete e potes. Em trânsito também, porque já saiu.</span>
          <span>Reembolsado: só frete. Cancelado: zero, e fica fora desta tela.</span>
        </div>
        <Botao variante="secundaria" tamanho="sm" onClick={() => setEditandoParametros(true)}>
          <Icone nome="editar" size={14} />
          Editar parâmetros
        </Botao>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ControleSegmentado
          opcoes={[
            { valor: "custos", rotulo: "Custo por pedido", icone: "pedidos" },
            { valor: "pagamentos", rotulo: "Pagamentos", icone: "dinheiro", contador: pagamentosFornecedor.length },
            { valor: "reembolsados", rotulo: "Reembolsados", icone: "devolver" },
            { valor: "conferencia", rotulo: "Conferência de fatura", icone: "documento" },
          ]}
          valor={secao}
          aoMudar={setSecao}
        />
        {(secao === "custos" || secao === "reembolsados") && (
          <SeletorPeriodo valor={periodo} aoMudar={setPeriodo} />
        )}
        {secao === "pagamentos" && (
          <Dica conteudo="Lançar pagamento">
            <BotaoAdicionar aria-label="Lançar pagamento" onClick={() => setLancandoPagamento(true)}>
              <Icone nome="adicionar" />
            </BotaoAdicionar>
          </Dica>
        )}
        {secao === "conferencia" && (
          <Botao variante="principal" onClick={() => setFatura({ fatura: null })}>
            <Icone nome="adicionar" size={16} />
            Conferir fatura
          </Botao>
        )}
      </div>

      {secao === "custos" && (
        <Tabela
          dados={custosDoPeriodo}
          colunas={colunasCustos}
          densidade="compacta"
          buscarEm={(c) => [c.pedido.codigo, c.pedido.cliente.nome]}
          placeholderBusca="Buscar por pedido ou cliente"
          filtros={[
            {
              chave: "situacao",
              rotulo: "Composição",
              opcoes: Object.entries(SITUACAO_CUSTO_FORNECEDOR).map(([valor, d]) => ({ valor, rotulo: d.rotulo })),
              aplicar: (c, v) => c.situacao === v,
            },
          ]}
          rodape={(visiveis) => {
            const t = somarCustos(visiveis);
            return {
              pedido: `${formatNumero(visiveis.length)} envios`,
              potes: formatNumero(t.potes),
              frete: formatBRL(t.frete),
              valorPotes: formatBRL(t.valorPotes),
              total: formatBRL(t.total),
            };
          }}
          vazio={
            <EstadoVazio
              icone="fornecedor"
              compacto
              titulo="Nenhum envio no período"
              descricao="O custo previsto nasce quando o envio é autorizado. Escolha outro período."
            />
          }
        />
      )}
      {secao === "custos" && custosDoPeriodo.length > 0 && (
        <p className="-mt-3 text-xs text-muted-fg">
          {formatNumero(custosDoPeriodo.length)} envios de {formatDia(periodo.de)} a {formatDia(periodo.ate)}, previsto de{" "}
          <span className="tabular text-fg">{formatBRL(totaisPeriodo.total)}</span>.
        </p>
      )}

      {secao === "pagamentos" && (
        <Tabela
          dados={pagamentosOrdenados}
          colunas={colunasPagamentos}
          densidade="compacta"
          rodape={(visiveis) => ({
            data: "Total pago",
            valor: formatBRL(visiveis.reduce((s, p) => s + p.valor, 0)),
          })}
          vazio={
            <EstadoVazio
              icone="dinheiro"
              titulo="Nenhum pagamento lançado"
              descricao="Lance cada Pix ou transferência feita ao fornecedor, com o comprovante."
              acao={
                <Botao variante="principal" onClick={() => setLancandoPagamento(true)}>
                  Lançar pagamento
                </Botao>
              }
            />
          }
        />
      )}

      {secao === "reembolsados" && (
        <>
          <Card className="flex flex-wrap items-center gap-x-8 gap-y-3 p-5">
            <div className="flex flex-col gap-0.5">
              <span className="tabular text-2xl font-medium">{formatNumero(potesAbater)}</span>
              <span className="text-xs text-muted-fg">Potes para abater</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="tabular text-2xl font-medium">{formatBRL(potesAbater * parametros.custoPote)}</span>
              <span className="text-xs text-muted-fg">Valor dos potes, pelo custo cadastrado</span>
            </div>
            <p className="min-w-48 flex-1 text-xs text-muted-fg">
              Reembolsados enviados de {formatDia(periodo.de)} a {formatDia(periodo.ate)}. O fornecedor cobrou o pote na
              saída e ele voltou: envie esta lista para abater na próxima fatura.
            </p>
            <Botao
              variante="secundaria"
              disabled={reembolsados.length === 0}
              onClick={() => {
                baixarArquivo(
                  csvReembolsados(reembolsados, kits),
                  `axis-reembolsados_${periodo.de}_${periodo.ate}.csv`,
                );
                toast.success("Relatório exportado", {
                  description: `${reembolsados.length} pedidos e ${potesAbater} potes, em CSV.`,
                });
              }}
            >
              <Icone nome="exportar" size={15} />
              Exportar CSV
            </Botao>
          </Card>
          <Tabela
            dados={reembolsados}
            colunas={colunasReembolsados}
            densidade="compacta"
            buscarEm={(p) => [p.codigo, p.cliente.nome, p.rastreio?.codigo]}
            placeholderBusca="Buscar por pedido, cliente ou rastreio"
            vazio={
              <EstadoVazio
                icone="devolver"
                compacto
                titulo="Nenhum reembolsado no período"
                descricao="Nada a abater nestas datas. Amplie o período para ver meses anteriores."
              />
            }
          />
        </>
      )}

      {secao === "conferencia" && (
        <>
          <Tabela
            dados={conferencias}
            colunas={colunasConferencia}
            aoClicarLinha={(c) => setFatura({ fatura: c.fatura })}
            vazio={
              <EstadoVazio
                icone="documento"
                titulo="Nenhuma fatura conferida"
                descricao="Lance o valor cobrado pelo fornecedor num período para comparar com o previsto."
                acao={
                  <Botao variante="principal" onClick={() => setFatura({ fatura: null })}>
                    Conferir fatura
                  </Botao>
                }
              />
            }
          />
          <p className="-mt-3 text-xs text-muted-fg">
            O previsto é recalculado com os parâmetros e os status de hoje. Diferença acima de{" "}
            {formatPercentual(TOLERANCIA_CONFERENCIA, 0)} fica destacada.
          </p>
        </>
      )}

      <ModalParametrosFornecedor aberto={editandoParametros} aoFechar={() => setEditandoParametros(false)} />
      <ModalPagamentoFornecedor aberto={lancandoPagamento} aoFechar={() => setLancandoPagamento(false)} />
      <ModalFaturaFornecedor aberto={fatura !== null} fatura={fatura?.fatura ?? null} aoFechar={() => setFatura(null)} />
      <ModalConfirmacao
        aberto={removendo !== null}
        titulo="Remover pagamento?"
        mensagem="O valor volta a compor o saldo a pagar."
        itens={removendo ? [`${formatData(removendo.pagoEm)} · ${formatBRL(removendo.valor)}`, removendo.observacoes ?? ""].filter(Boolean) : []}
        perigo
        icone="excluir"
        rotuloConfirmar="Remover pagamento"
        aoCancelar={() => setRemovendo(null)}
        aoConfirmar={async () => {
          if (!removendo) return;
          if (!(await excluirPagamentoFornecedor(removendo.id))) return;
          toast.success("Pagamento removido", { description: formatBRL(removendo.valor) });
          setRemovendo(null);
        }}
      />
    </div>
  );
}

/** Diferença da conferência: destaca em vermelho a cobrança acima do previsto, em verde a abaixo. */
function Diferenca({ conferencia }: { conferencia: Conferencia }) {
  const { diferenca, percentual } = conferencia;
  const relevante = percentual === null ? diferenca !== 0 : Math.abs(percentual) >= TOLERANCIA_CONFERENCIA;
  if (diferenca === 0) return <SeloTom tom="esmeralda">Bate</SeloTom>;
  const acima = diferenca > 0;
  const texto = `${acima ? "+" : "−"}${formatBRL(Math.abs(diferenca))}${percentual !== null ? ` (${acima ? "+" : "−"}${formatPercentual(Math.abs(percentual))})` : ""}`;
  if (!relevante) return <span className="text-muted-fg">{texto}</span>;
  return (
    <SeloTom tom={acima ? "vermelho" : "verde"} ponto={false}>
      <Icone nome={acima ? "subiu" : "desceu"} size={12} />
      {texto}
    </SeloTom>
  );
}
