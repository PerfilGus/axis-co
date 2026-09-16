"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { Criativo, LinhaWhatsApp } from "@/lib/types";
import { ROTULO_FORMATO } from "@/lib/types";
import { formatTelefone } from "@/lib/format";
import { useCadastros } from "@/lib/providers/cadastros";
import { useEquipe } from "@/lib/providers/equipe";
import { usePedidos } from "@/lib/providers/pedidos";
import { codigoCompleto } from "@/lib/mock/marketing";
import { Icone } from "@/components/icone";
import { Botao } from "@/components/ui/button";
import { Card, CardConteudo, CardDescricao, CardTitulo } from "@/components/ui/card";
import { Interruptor } from "@/components/ui/switch";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { Tabela, type ColunaTabela, type FiltroTabela } from "@/components/shared/tabela";
import { SeloTom } from "@/components/shared/selo-status";
import { ModalCriativo, ModalLinha } from "@/components/config/modais-marketing";

type Edicao =
  | { tipo: "criativo"; criativo: Criativo | null }
  | { tipo: "linha"; linha: LinhaWhatsApp | null }
  | null;

export default function PaginaConfiguracoesCriativosLinhas() {
  const { criativos, linhas, alternarAtivo } = useCadastros();
  const { nomeDe } = useEquipe();
  const { pedidos } = usePedidos();
  const [edicao, setEdicao] = useState<Edicao>(null);

  const pedidosPorCriativo = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const p of pedidos) {
      const chave = p.criativoId ?? "nao_identificado";
      mapa.set(chave, (mapa.get(chave) ?? 0) + 1);
    }
    return mapa;
  }, [pedidos]);
  const semCriativo = pedidos.filter(
    (p) => !p.criativoId || !criativos.some((c) => c.id === p.criativoId),
  ).length;

  const colunas: Array<ColunaTabela<Criativo>> = useMemo(
    () => [
      {
        chave: "codigo",
        titulo: "Código",
        ordenarPor: (c) => codigoCompleto(c),
        render: (c) => (
          <span className="tabular font-medium whitespace-nowrap">{codigoCompleto(c)}</span>
        ),
      },
      {
        chave: "nome",
        titulo: "Criativo",
        ordenarPor: (c) => c.nome,
        render: (c) => (
          <div className="flex flex-col">
            <span className="truncate">{c.nome}</span>
            <span className="text-[11px] text-muted-fg">{ROTULO_FORMATO[c.formato]}</span>
          </div>
        ),
      },
      {
        chave: "linha",
        titulo: "Linha",
        ordenarPor: (c) => linhas.find((l) => l.id === c.linhaWhatsappId)?.nome ?? "",
        render: (c) => (
          <span className="tabular text-muted-fg">
            {linhas.find((l) => l.id === c.linhaWhatsappId)?.nome ?? "—"}
          </span>
        ),
      },
      {
        chave: "anuncio",
        titulo: "Anúncio no Meta",
        escondeEm: "md",
        render: (c) =>
          c.anuncioMeta ? (
            <span className="tabular text-[13px] text-muted-fg">{c.anuncioMeta}</span>
          ) : (
            <span className="text-[13px] text-muted-fg/60">Sem vínculo</span>
          ),
      },
      {
        chave: "pedidos",
        titulo: "Pedidos",
        alinhamento: "direita",
        escondeEm: "sm",
        ordenarPor: (c) => pedidosPorCriativo.get(c.id) ?? 0,
        render: (c) => <span className="tabular">{pedidosPorCriativo.get(c.id) ?? 0}</span>,
      },
      {
        chave: "ativo",
        titulo: "Ativo",
        alinhamento: "direita",
        ordenarPor: (c) => (c.ativo ? 1 : 0),
        render: (c) => (
          <span onClick={(e) => e.stopPropagation()} className="inline-flex">
            <Interruptor
              checked={c.ativo}
              onCheckedChange={() => alternarAtivo("criativo", c.id)}
              aria-label={c.ativo ? `Desativar ${codigoCompleto(c)}` : `Ativar ${codigoCompleto(c)}`}
            />
          </span>
        ),
      },
    ],
    [linhas, pedidosPorCriativo, alternarAtivo],
  );

  const filtros: Array<FiltroTabela<Criativo>> = useMemo(
    () => [
      {
        chave: "linha",
        rotulo: "Linha",
        opcoes: linhas.map((l) => ({ valor: l.id, rotulo: l.nome })),
        aplicar: (c, v) => c.linhaWhatsappId === v,
      },
      {
        chave: "situacao",
        rotulo: "Situação",
        opcoes: [
          { valor: "ativo", rotulo: "Ativos" },
          { valor: "inativo", rotulo: "Inativos" },
        ],
        aplicar: (c, v) => (v === "ativo" ? c.ativo : !c.ativo),
      },
    ],
    [linhas],
  );

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Criativos e linhas de WhatsApp"
        descricao="Cada criativo aponta para a linha que recebe os leads dele."
        extras={
          <Botao variante="secundaria" onClick={() => setEdicao({ tipo: "linha", linha: null })}>
            <Icone nome="whatsapp" size={15} />
            Nova linha
          </Botao>
        }
        acao={
          <Botao variante="principal" onClick={() => setEdicao({ tipo: "criativo", criativo: null })}>
            <Icone nome="adicionar" size={16} />
            Novo criativo
          </Botao>
        }
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-[13px] font-medium text-muted-fg">Linhas de WhatsApp</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {linhas.map((linha) => {
            const quantos = criativos.filter((c) => c.linhaWhatsappId === linha.id && c.ativo).length;
            return (
              <Card key={linha.id} className={cn(!linha.ativa && "opacity-70")}>
                <CardConteudo className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex size-10 items-center justify-center rounded-full bg-surface-3 text-[var(--st-verde-fg)]">
                        <Icone nome="whatsapp" size={20} />
                      </span>
                      <div className="flex flex-col">
                        <CardTitulo className="tabular">{linha.nome}</CardTitulo>
                        <CardDescricao className="tabular">{formatTelefone(linha.numero)}</CardDescricao>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Interruptor
                        checked={linha.ativa}
                        onCheckedChange={() => alternarAtivo("linha", linha.id)}
                        aria-label={linha.ativa ? `Desativar ${linha.nome}` : `Ativar ${linha.nome}`}
                      />
                      <Botao
                        variante="fantasma"
                        tamanho="iconeSm"
                        aria-label={`Editar ${linha.nome}`}
                        onClick={() => setEdicao({ tipo: "linha", linha })}
                      >
                        <Icone nome="editar" size={14} />
                      </Botao>
                    </div>
                  </div>
                  <p className="text-[13px] text-muted-fg">
                    {quantos} {quantos === 1 ? "criativo ativo" : "criativos ativos"} ·{" "}
                    {linha.vendedoresIds.length > 0
                      ? linha.vendedoresIds.map(nomeDe).join(", ")
                      : "sem vendedor"}
                  </p>
                </CardConteudo>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[13px] font-medium text-muted-fg">Criativos</h2>
        <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-dashed border-border px-5 py-4">
          <span className="flex size-9 items-center justify-center rounded-full bg-surface-2 text-muted-fg">
            <Icone nome="info" size={16} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
              Criativo não identificado
              <SeloTom tom="ardosia" ponto={false}>
                Registro fixo
              </SeloTom>
            </span>
            <span className="text-[13px] text-muted-fg">
              Para o lead que chega sem código. Sempre disponível no pedido, não pode ser editado
              nem desativado.
            </span>
          </div>
          <span className="tabular text-[13px] text-muted-fg">{semCriativo} pedidos</span>
        </div>

        <Tabela
          dados={criativos}
          colunas={colunas}
          filtros={filtros}
          buscarEm={(c) => [c.nome, codigoCompleto(c), c.codigo, c.anuncioMeta]}
          placeholderBusca="Buscar por código, nome ou anúncio"
          aoClicarLinha={(c) => setEdicao({ tipo: "criativo", criativo: c })}
        />
      </section>

      <ModalCriativo
        aberto={edicao?.tipo === "criativo"}
        criativo={edicao?.tipo === "criativo" ? edicao.criativo : null}
        aoFechar={() => setEdicao(null)}
      />
      <ModalLinha
        aberto={edicao?.tipo === "linha"}
        linha={edicao?.tipo === "linha" ? edicao.linha : null}
        aoFechar={() => setEdicao(null)}
      />
    </div>
  );
}
