"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { Setor } from "@/lib/types";
import { formatNumero, formatPercentual } from "@/lib/format";
import { intervaloDoRanking, PERIODOS_RANKING, type PeriodoRanking } from "@/lib/periodos";
import {
  classificarEquipe,
  type CriterioRanking,
  type FiltroSetorRanking,
  type PosicaoRanking as Posicao,
} from "@/lib/ranking";
import { useEquipe } from "@/lib/providers/equipe";
import { usePedidos } from "@/lib/providers/pedidos";
import { useSessao } from "@/lib/providers/sessao";
import { Icone } from "@/components/icone";
import { Card } from "@/components/ui/card";
import {
  Selecao,
  SelecaoConteudo,
  SelecaoGatilho,
  SelecaoItem,
  SelecaoValor,
} from "@/components/ui/select";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { AvatarAnel } from "@/components/shared/avatar-anel";
import { ControleSegmentado } from "@/components/shared/controles";
import { EstadoVazio } from "@/components/shared/estado-vazio";

type FiltroSetor = FiltroSetorRanking;

/** `12 agendados` ou `8 pagos` — o que o setor persegue. */
function unidade(setor: Setor, n: number) {
  return setor === "financeiro" ? (n === 1 ? "pago" : "pagos") : n === 1 ? "agendado" : "agendados";
}

function Frustracao({ valor, className }: { valor: number | null; className?: string }) {
  return (
    <span className={cn("tabular inline-flex items-center gap-1 text-xs text-muted-fg", className)}>
      <Icone nome="alerta" size={11} />
      {valor === null ? "—" : formatPercentual(valor)} frustrado
    </span>
  );
}

const ALTURA_DEGRAU = ["h-28", "h-20", "h-14"];
const ORDEM_PODIO = [1, 0, 2];

function Podio({
  posicoes,
  usuarioId,
  criterio,
}: {
  posicoes: Posicao[];
  usuarioId: string;
  criterio: CriterioRanking;
}) {
  return (
    <div className="grid grid-cols-3 items-end gap-2 sm:gap-4">
      {ORDEM_PODIO.map((indice) => {
        const p = posicoes[indice];
        if (!p) return <div key={indice} />;
        const primeiro = indice === 0;
        const voce = p.colaborador.id === usuarioId;
        return (
          <div key={p.colaborador.id} className="flex min-w-0 flex-col items-center gap-3">
            <div className="flex min-w-0 flex-col items-center gap-2 text-center">
              <div className="relative">
                <AvatarAnel
                  nome={p.colaborador.nome}
                  imagemUrl={p.colaborador.avatarUrl}
                  progresso={p.progresso}
                  tamanho={primeiro ? 76 : 60}
                />
                {primeiro && (
                  <span className="absolute -top-2 left-1/2 flex size-7 -translate-x-1/2 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-fg)]">
                    <Icone nome="ranking" size={14} />
                  </span>
                )}
              </div>
              <div className="flex min-w-0 max-w-full flex-col">
                <span className="truncate text-sm font-medium">
                  {p.colaborador.apelido}
                  {voce && <span className="text-muted-fg"> (você)</span>}
                </span>
                <span className="truncate text-[11px] text-muted-fg">{p.nivel}</span>
              </div>
            </div>
            <div
              className={cn(
                "flex w-full flex-col items-center justify-start gap-0.5 rounded-t-[var(--radius-card-sm)] pt-3",
                ALTURA_DEGRAU[indice],
                primeiro ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "bg-surface-2",
              )}
            >
              <span className="tabular text-xl leading-none font-medium">
                {formatNumero(criterio === "pontos" ? p.pontos : p.desempenho.pedidos)}
              </span>
              <span className={cn("text-[11px]", primeiro ? "opacity-75" : "text-muted-fg")}>
                {criterio === "pontos"
                  ? p.pontos === 1
                    ? "ponto"
                    : "pontos"
                  : unidade(p.colaborador.setor, p.desempenho.pedidos)}
              </span>
              <Frustracao
                valor={p.desempenho.frustracao}
                className={cn("mt-1 text-[10px] sm:text-xs", primeiro && "text-[var(--accent-fg)] opacity-75")}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function PaginaEquipeRanking() {
  const { colaboradores, niveis, lancamentos } = useEquipe();
  const { pedidos } = usePedidos();
  const { usuario, ehAdmin } = useSessao();
  const [periodo, setPeriodo] = useState<PeriodoRanking>("mes");
  const [criterio, setCriterio] = useState<CriterioRanking>("pedidos");
  const [setor, setSetor] = useState<FiltroSetor>(
    usuario.setor === "financeiro" ? "financeiro" : "vendas",
  );

  const posicoes = useMemo<Posicao[]>(
    () =>
      classificarEquipe(
        colaboradores,
        niveis,
        pedidos,
        intervaloDoRanking(periodo),
        setor,
        lancamentos,
        criterio,
      ),
    [colaboradores, niveis, pedidos, periodo, setor, lancamentos, criterio],
  );

  const semMovimento = posicoes.every((p) =>
    criterio === "pontos" ? p.pontos === 0 : p.desempenho.pedidos === 0,
  );
  const demais = posicoes.slice(3);

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Ranking"
        descricao={
          setor === "financeiro"
            ? "Cobradores por pedidos pagos dos vendedores atribuídos."
            : setor === "vendas"
              ? "Vendedores por pedidos agendados, menos os cancelados."
              : "Vendedores contam agendados; cobradores, pagos."
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <ControleSegmentado
          valor={setor}
          aoMudar={setSetor}
          opcoes={[
            ...(ehAdmin ? [{ valor: "todos" as const, rotulo: "Todos" }] : []),
            { valor: "vendas", rotulo: "Vendas", icone: "pedidos" },
            { valor: "financeiro", rotulo: "Financeiro", icone: "cobranca" },
          ]}
        />
        <ControleSegmentado
          valor={criterio}
          aoMudar={setCriterio}
          opcoes={[
            { valor: "pedidos", rotulo: "Por pedidos" },
            { valor: "pontos", rotulo: "Por pontos", icone: "medalha" },
          ]}
        />
        <Selecao value={periodo} onValueChange={(v) => setPeriodo(v as PeriodoRanking)}>
          <SelecaoGatilho className="w-auto min-w-44 rounded-full">
            <SelecaoValor />
          </SelecaoGatilho>
          <SelecaoConteudo>
            {PERIODOS_RANKING.map((p) => (
              <SelecaoItem key={p.valor} value={p.valor}>
                {p.rotulo}
              </SelecaoItem>
            ))}
          </SelecaoConteudo>
        </Selecao>
      </div>

      {posicoes.length === 0 ? (
        <EstadoVazio
          icone="ranking"
          titulo="Ninguém neste setor"
          descricao="Cadastre colaboradores em Equipe para o ranking ter quem comparar."
        />
      ) : (
        <>
          <Card className="px-4 pt-8 pb-0 sm:px-10">
            {semMovimento && (
              <p className="-mt-3 mb-6 text-center text-[13px] text-muted-fg">
                Nenhum pedido no período ainda. A ordem sai da frustração e do nome.
              </p>
            )}
            <Podio posicoes={posicoes} usuarioId={usuario.id} criterio={criterio} />
          </Card>

          {demais.length > 0 && (
            <Card>
              <ol className="flex flex-col">
                {demais.map((p, i) => {
                  const voce = p.colaborador.id === usuario.id;
                  return (
                    <li
                      key={p.colaborador.id}
                      className={cn(
                        "flex items-center gap-3 px-5 py-3",
                        i > 0 && "border-t border-border",
                        voce && "bg-[var(--accent-soft)]",
                      )}
                    >
                      <span className="tabular w-6 text-center text-sm text-muted-fg">{i + 4}º</span>
                      <AvatarAnel
                        nome={p.colaborador.nome}
                        imagemUrl={p.colaborador.avatarUrl}
                        progresso={p.progresso}
                        tamanho={40}
                      />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium">
                          {p.colaborador.nome}
                          {voce && <span className="text-muted-fg"> (você)</span>}
                        </span>
                        <span className="text-xs text-muted-fg">{p.nivel}</span>
                      </div>
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="tabular text-sm font-medium">
                          {formatNumero(criterio === "pontos" ? p.pontos : p.desempenho.pedidos)}{" "}
                          <span className="font-normal text-muted-fg">
                            {criterio === "pontos"
                              ? p.pontos === 1
                                ? "ponto"
                                : "pontos"
                              : unidade(p.colaborador.setor, p.desempenho.pedidos)}
                          </span>
                        </span>
                        <Frustracao valor={p.desempenho.frustracao} />
                      </div>
                    </li>
                  );
                })}
              </ol>
            </Card>
          )}

          <p className="text-xs text-muted-fg">
            {criterio === "pontos"
              ? "Pontos ganhos no período, já com estornos e penalidades. "
              : ""}
            Empate desempata pela menor frustração. A frustração é o que saiu do trilho
            (cancelado, reembolsado ou inadimplente) entre os pedidos criados no período.
          </p>
        </>
      )}
    </div>
  );
}
