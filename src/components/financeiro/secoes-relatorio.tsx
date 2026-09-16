"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { DespesaFixa } from "@/lib/types";
import {
  formatBps,
  formatBRL,
  formatCompetencia,
  formatCompetenciaCurta,
  formatData,
} from "@/lib/format";
import { competenciaAtual, competenciaDe, ultimasCompetencias } from "@/lib/periodos";
import { HOJE } from "@/lib/mock/base";
import { aliquotaDa, calcularDre, despesaVigente, situacaoDivida } from "@/lib/resultado";
import { CATEGORIA_DESPESA, SITUACAO_ALIQUOTA, STATUS_DIVIDA } from "@/lib/status";
import { useFinanceiro } from "@/lib/providers/financeiro";
import { Icone } from "@/components/icone";
import { Botao } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { EstadoVazio } from "@/components/shared/estado-vazio";
import { LinhaIndicadores } from "@/components/shared/indicadores";
import { SeloTom } from "@/components/shared/selo-status";
import { Tabela, type ColunaTabela } from "@/components/shared/tabela";
import { useFontesResultado } from "./fontes";
import { ModalAliquota, ModalDespesa, ModalDivida } from "./modais-relatorio";

function maiuscula(texto: string) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/* ================================================================
   Despesas fixas
   ================================================================ */

export function SecaoDespesas() {
  const { despesas } = useFinanceiro();
  const [editando, setEditando] = useState<{ despesa: DespesaFixa | null } | null>(null);
  const atual = competenciaAtual();
  const vigentes = despesas.filter((d) => despesaVigente(d, atual));
  const porCategoria = Object.entries(
    vigentes.reduce<Record<string, number>>((acc, d) => {
      acc[d.categoria] = (acc[d.categoria] ?? 0) + d.valor;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);

  const colunas: Array<ColunaTabela<DespesaFixa>> = [
    { chave: "descricao", titulo: "Despesa", ordenarPor: (d) => d.descricao, render: (d) => <span className="font-medium">{d.descricao}</span> },
    { chave: "categoria", titulo: "Categoria", ordenarPor: (d) => CATEGORIA_DESPESA[d.categoria], render: (d) => <span className="text-muted-fg">{CATEGORIA_DESPESA[d.categoria]}</span> },
    { chave: "vencimento", titulo: "Vence", escondeEm: "sm", alinhamento: "direita", ordenarPor: (d) => d.diaVencimento, render: (d) => `dia ${d.diaVencimento}` },
    {
      chave: "vigencia",
      titulo: "Vigência",
      escondeEm: "md",
      ordenarPor: (d) => d.desde,
      render: (d) => (
        <span className="tabular text-muted-fg">
          {formatCompetenciaCurta(d.desde)} → {d.ate ? formatCompetenciaCurta(d.ate) : "em vigor"}
        </span>
      ),
    },
    {
      chave: "situacao",
      titulo: "Situação",
      escondeEm: "sm",
      ordenarPor: (d) => (despesaVigente(d, atual) ? 0 : 1),
      render: (d) =>
        despesaVigente(d, atual) ? (
          <SeloTom tom="verde">Em vigor</SeloTom>
        ) : (
          <SeloTom tom="cinza">{d.desde > atual ? "Futura" : "Encerrada"}</SeloTom>
        ),
    },
    { chave: "valor", titulo: "Valor mensal", alinhamento: "direita", ordenarPor: (d) => d.valor, render: (d) => <span className="font-medium">{formatBRL(d.valor)}</span> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {porCategoria.map(([categoria, valor]) => (
            <span key={categoria} className="inline-flex items-center gap-2 rounded-full bg-surface-2 px-3 py-1.5 text-xs">
              <span className="text-muted-fg">{CATEGORIA_DESPESA[categoria as DespesaFixa["categoria"]]}</span>
              <span className="tabular font-medium">{formatBRL(valor)}</span>
            </span>
          ))}
        </div>
        <Botao variante="principal" onClick={() => setEditando({ despesa: null })}>
          <Icone nome="adicionar" size={16} />
          Nova despesa
        </Botao>
      </div>
      <Tabela
        dados={despesas}
        colunas={colunas}
        densidade="compacta"
        buscarEm={(d) => [d.descricao, CATEGORIA_DESPESA[d.categoria]]}
        placeholderBusca="Buscar despesa"
        filtros={[
          {
            chave: "categoria",
            rotulo: "Categoria",
            opcoes: Object.entries(CATEGORIA_DESPESA).map(([valor, rotulo]) => ({ valor, rotulo })),
            aplicar: (d, v) => d.categoria === v,
          },
        ]}
        aoClicarLinha={(d) => setEditando({ despesa: d })}
        rodape={(visiveis) => ({
          descricao: "Em vigor neste mês",
          valor: formatBRL(visiveis.filter((d) => despesaVigente(d, atual)).reduce((s, d) => s + d.valor, 0)),
        })}
      />
      <ModalDespesa aberto={editando !== null} despesa={editando?.despesa ?? null} aoFechar={() => setEditando(null)} />
    </div>
  );
}

/* ================================================================
   Dívidas
   ================================================================ */

export function SecaoDividas() {
  const { dividas, alternarParcela } = useFinanceiro();
  const [criando, setCriando] = useState(false);
  const [expandida, setExpandida] = useState<string | null>(null);

  const saldo = dividas.reduce(
    (s, d) => s + d.parcelas.filter((p) => !p.pagaEm).reduce((t, p) => t + p.valor, 0),
    0,
  );
  const atrasadas = dividas.flatMap((d) => d.parcelas).filter((p) => !p.pagaEm && new Date(p.venceEm) < HOJE);
  const mesAtual = competenciaAtual();
  const doMes = dividas
    .flatMap((d) => d.parcelas)
    .filter((p) => competenciaDe(p.venceEm) === mesAtual)
    .reduce((s, p) => s + p.valor, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <LinhaIndicadores
          className="min-w-0 flex-1"
          itens={[
            { icone: "financeiro", valor: formatBRL(saldo), rotulo: "Saldo devedor" },
            { icone: "calendario", valor: formatBRL(doMes), rotulo: "Parcelas deste mês" },
            { icone: "alerta", valor: String(atrasadas.length), rotulo: "Parcelas vencidas" },
          ]}
        />
        <Botao variante="principal" onClick={() => setCriando(true)}>
          <Icone nome="adicionar" size={16} />
          Nova dívida
        </Botao>
      </div>

      {dividas.length === 0 ? (
        <EstadoVazio icone="financeiro" titulo="Nenhuma dívida cadastrada" descricao="Empréstimos e parcelamentos entram no resultado final pelas parcelas." />
      ) : (
        dividas.map((divida) => {
          const situacao = situacaoDivida(divida);
          const pagas = divida.parcelas.filter((p) => p.pagaEm).length;
          const restante = divida.parcelas.filter((p) => !p.pagaEm).reduce((s, p) => s + p.valor, 0);
          const aberta = expandida === divida.id;
          return (
            <Card key={divida.id} className="flex flex-col">
              <button
                onClick={() => setExpandida(aberta ? null : divida.id)}
                className="flex flex-wrap items-center gap-x-6 gap-y-2 p-5 text-left"
                aria-expanded={aberta}
              >
                <div className="flex min-w-48 flex-1 flex-col gap-0.5">
                  <span className="font-medium">{divida.credor}</span>
                  <span className="text-xs text-muted-fg">
                    {divida.descricao || "Sem descrição"} · {formatBRL(divida.valorOriginal)} a {formatBps(divida.jurosBps)} ao mês
                  </span>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <span className="tabular text-sm font-medium">
                    {pagas} de {divida.parcelas.length} pagas
                  </span>
                  <span className="tabular text-xs text-muted-fg">Restam {formatBRL(restante)}</span>
                </div>
                <SeloTom tom={STATUS_DIVIDA[situacao].tom}>{STATUS_DIVIDA[situacao].rotulo}</SeloTom>
                <Icone nome={aberta ? "recolher" : "abrir"} size={16} className="text-muted-fg" />
              </button>
              <div className="mx-5 mb-4 h-1.5 overflow-hidden rounded-full bg-surface-3">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(pagas / divida.parcelas.length) * 100}%`, backgroundColor: "var(--st-esmeralda-fg)" }}
                />
              </div>
              {aberta && (
                <ul className="flex flex-col border-t border-border">
                  {divida.parcelas.map((p) => {
                    const vencida = !p.pagaEm && new Date(p.venceEm) < HOJE;
                    return (
                      <li key={p.numero} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border px-5 py-2.5 last:border-0">
                        <span className="tabular w-10 text-[13px] text-muted-fg">{p.numero}ª</span>
                        <span className="tabular min-w-28 flex-1 text-[13px]">Vence {formatData(p.venceEm)}</span>
                        <span className="tabular text-[13px] font-medium">{formatBRL(p.valor)}</span>
                        {p.pagaEm ? (
                          <SeloTom tom="esmeralda">Paga em {formatData(p.pagaEm)}</SeloTom>
                        ) : (
                          <SeloTom tom={vencida ? "carmim" : "ardosia"}>{vencida ? "Vencida" : "A vencer"}</SeloTom>
                        )}
                        <Botao
                          variante={p.pagaEm ? "fantasma" : "destaqueSuave"}
                          tamanho="sm"
                          onClick={() => {
                            const pagaEm = p.pagaEm ? null : new Date().toISOString();
                            alternarParcela(divida.id, p.numero, pagaEm);
                            toast.success(pagaEm ? "Parcela marcada como paga" : "Pagamento da parcela desfeito", {
                              description: `${divida.credor}, ${p.numero}ª parcela de ${formatBRL(p.valor)}.`,
                            });
                          }}
                        >
                          {p.pagaEm ? "Desfazer" : "Marcar paga"}
                        </Botao>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          );
        })
      )}
      <ModalDivida aberto={criando} aoFechar={() => setCriando(false)} />
    </div>
  );
}

/* ================================================================
   Alíquotas
   ================================================================ */

interface LinhaAliquota {
  id: string;
  competencia: string;
  aliquotaBps: number;
  situacao: "estimada" | "confirmada";
  origem: string | null;
  base: number;
  imposto: number;
}

export function SecaoAliquotas() {
  const fontes = useFontesResultado();
  const [editando, setEditando] = useState<string | null>(null);

  const linhas = useMemo<LinhaAliquota[]>(
    () =>
      ultimasCompetencias(6).map((competencia) => {
        const a = aliquotaDa(competencia, fontes.aliquotas);
        const dre = calcularDre(competencia, "competencia", fontes);
        return {
          id: competencia,
          competencia,
          ...a,
          base: dre.receita,
          imposto: Math.round((dre.receita * a.aliquotaBps) / 10_000),
        };
      }),
    [fontes],
  );

  const colunas: Array<ColunaTabela<LinhaAliquota>> = [
    { chave: "competencia", titulo: "Competência", render: (l) => <span className="font-medium">{maiuscula(formatCompetencia(l.competencia))}</span> },
    { chave: "aliquota", titulo: "Alíquota", alinhamento: "direita", render: (l) => formatBps(l.aliquotaBps) },
    {
      chave: "situacao",
      titulo: "Situação",
      render: (l) => (
        <div className="flex flex-wrap items-center gap-2">
          <SeloTom tom={SITUACAO_ALIQUOTA[l.situacao].tom}>{SITUACAO_ALIQUOTA[l.situacao].rotulo}</SeloTom>
          {l.situacao === "estimada" && (
            <span className="text-xs text-muted-fg">
              {l.origem ? `usa a de ${formatCompetenciaCurta(l.origem)}` : "sem alíquota anterior"}
            </span>
          )}
        </div>
      ),
    },
    { chave: "base", titulo: "Receita recebida", alinhamento: "direita", escondeEm: "md", render: (l) => formatBRL(l.base) },
    { chave: "imposto", titulo: "Imposto", alinhamento: "direita", escondeEm: "sm", render: (l) => formatBRL(l.imposto) },
    {
      chave: "acao",
      titulo: "",
      alinhamento: "direita",
      render: (l) => (
        <Botao
          variante={l.situacao === "estimada" ? "destaqueSuave" : "fantasma"}
          tamanho="sm"
          onClick={(e) => {
            e.stopPropagation();
            setEditando(l.competencia);
          }}
        >
          {l.situacao === "estimada" ? "Confirmar" : "Corrigir"}
        </Botao>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <p className={cn("flex items-start gap-2 text-[13px] text-muted-fg")}>
        <Icone nome="info" size={15} className="mt-0.5 shrink-0" />
        Sem alíquota confirmada, o mês usa a do mês anterior e fica marcado como estimado. Base de competência: o
        que as vendas do mês já pagaram.
      </p>
      <Tabela dados={linhas} colunas={colunas} aoClicarLinha={(l) => setEditando(l.competencia)} />
      <ModalAliquota competencia={editando} aoFechar={() => setEditando(null)} />
    </div>
  );
}
