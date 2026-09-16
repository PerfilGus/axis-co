"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Conquista, Meta, Nivel } from "@/lib/types";
import { ROTULO_PERIODO_META } from "@/lib/types";
import { formatNumero } from "@/lib/format";
import { descreverRecompensa, formatarAlvo, medirMeta } from "@/lib/metas";
import { useEquipe } from "@/lib/providers/equipe";
import { usePedidos } from "@/lib/providers/pedidos";
import { Icone, type NomeIcone } from "@/components/icone";
import { Botao } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { ControleSegmentado } from "@/components/shared/controles";
import { EstadoVazio } from "@/components/shared/estado-vazio";
import { AvatarAnel } from "@/components/shared/avatar-anel";
import { SeloTom } from "@/components/shared/selo-status";
import {
  ModalConquista,
  ModalNivel,
  ROTULO_GATILHO,
  rotuloBonus,
} from "@/components/config/modais-premiacao";
import { ModalMeta } from "@/components/equipe/modal-meta";
import { BonusLiberados } from "@/components/equipe/bonus-liberados";

type Aba = "niveis" | "conquistas" | "metas";

type Edicao =
  | { tipo: "nivel"; nivel: Nivel | null }
  | { tipo: "conquista"; conquista: Conquista | null }
  | { tipo: "meta"; meta: Meta | null }
  | null;

export default function PaginaConfiguracoesMetas() {
  const { niveis, conquistas, metas, colaboradores, bonusNivel } = useEquipe();
  const { pedidos } = usePedidos();
  const [aba, setAba] = useState<Aba>("niveis");
  const [edicao, setEdicao] = useState<Edicao>(null);

  const trilha = [...niveis].sort((a, b) => a.ordem - b.ordem);

  const acao =
    aba === "niveis" ? (
      <Botao variante="principal" onClick={() => setEdicao({ tipo: "nivel", nivel: null })}>
        <Icone nome="adicionar" size={16} />
        Novo nível
      </Botao>
    ) : aba === "conquistas" ? (
      <Botao variante="principal" onClick={() => setEdicao({ tipo: "conquista", conquista: null })}>
        <Icone nome="adicionar" size={16} />
        Nova conquista
      </Botao>
    ) : (
      <Botao variante="principal" onClick={() => setEdicao({ tipo: "meta", meta: null })}>
        <Icone nome="adicionar" size={16} />
        Nova meta
      </Botao>
    );

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Metas, níveis e conquistas"
        descricao="Conquistas dão pontos, pontos sobem de nível, e cada nível libera um bônus."
        acao={acao}
      />

      <BonusLiberados />

      <ControleSegmentado
        valor={aba}
        aoMudar={setAba}
        opcoes={[
          { valor: "niveis", rotulo: "Níveis", icone: "medalha", contador: niveis.length },
          { valor: "conquistas", rotulo: "Conquistas", icone: "ranking", contador: conquistas.length },
          { valor: "metas", rotulo: "Metas", icone: "metas", contador: metas.length },
        ]}
      />

      {aba === "niveis" && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {trilha.map((nivel, i) => {
            const proximo = trilha[i + 1];
            const nele = colaboradores.filter((c) => c.nivelId === nivel.id && c.setor !== "administracao");
            const pendentes = bonusNivel.filter((b) => b.nivelId === nivel.id && b.status === "liberado").length;
            return (
              <Card key={nivel.id} className="flex flex-col gap-4 p-5">
                <div className="flex items-start justify-between gap-2">
                  <span className="flex size-10 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
                    <Icone nome={(nivel.icone as NomeIcone) ?? "medalha"} size={18} />
                  </span>
                  <Botao
                    variante="fantasma"
                    tamanho="iconeSm"
                    aria-label={`Editar ${nivel.nome}`}
                    onClick={() => setEdicao({ tipo: "nivel", nivel })}
                  >
                    <Icone nome="editar" size={14} />
                  </Botao>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-fg">Nível {nivel.ordem}</span>
                  <span className="text-lg font-medium tracking-tight">{nivel.nome}</span>
                  <span className="tabular text-[13px] text-muted-fg">
                    {proximo
                      ? `${formatNumero(nivel.pontosNecessarios)} a ${formatNumero(proximo.pontosNecessarios - 1)} pontos`
                      : `A partir de ${formatNumero(nivel.pontosNecessarios)} pontos`}
                  </span>
                </div>
                <div className="mt-auto flex flex-col gap-2 border-t border-border pt-3 text-[13px]">
                  <div className="flex justify-between">
                    <span className="text-muted-fg">Bônus</span>
                    <span className="tabular font-medium">{rotuloBonus(nivel.bonus)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-fg">Na equipe</span>
                    <span className="flex -space-x-2">
                      {nele.length === 0 ? (
                        <span className="text-muted-fg">ninguém</span>
                      ) : (
                        nele.map((c) => (
                          <AvatarAnel key={c.id} nome={c.nome} imagemUrl={c.avatarUrl} mostrarAnel={false} tamanho={24} className="ring-2 ring-surface-1 rounded-full" />
                        ))
                      )}
                    </span>
                  </div>
                  {pendentes > 0 && (
                    <SeloTom tom="bronze" className="self-start">
                      {pendentes} {pendentes === 1 ? "bônus" : "bônus"} para pagar
                    </SeloTom>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {aba === "conquistas" && (
        <Card>
          <ul className="flex flex-col">
            {conquistas.map((conquista, i) => (
              <li
                key={conquista.id}
                className={cn(
                  "flex flex-wrap items-center gap-4 px-5 py-4",
                  i > 0 && "border-t border-border",
                  !conquista.ativa && "opacity-60",
                )}
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[var(--accent)]">
                  <Icone nome={ROTULO_GATILHO[conquista.gatilho].icone} size={18} />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="flex flex-wrap items-center gap-2 font-medium">
                    {conquista.nome}
                    {!conquista.ativa && (
                      <SeloTom tom="cinza" ponto={false}>
                        Inativa
                      </SeloTom>
                    )}
                  </span>
                  <span className="text-[13px] text-muted-fg">
                    {ROTULO_GATILHO[conquista.gatilho].rotulo} · {conquista.criterio}
                  </span>
                </div>
                <span className="text-xs text-muted-fg">
                  {conquista.repetivel ? "Pontua a cada vez" : "Uma vez só"}
                </span>
                <span className="tabular w-20 text-right text-lg font-medium">
                  +{formatNumero(conquista.pontos)}
                  <span className="ml-1 text-xs font-normal text-muted-fg">pts</span>
                </span>
                <Botao
                  variante="fantasma"
                  tamanho="iconeSm"
                  aria-label={`Editar ${conquista.nome}`}
                  onClick={() => setEdicao({ tipo: "conquista", conquista })}
                >
                  <Icone nome="editar" size={14} />
                </Botao>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {aba === "metas" &&
        (metas.length === 0 ? (
          <EstadoVazio
            icone="metas"
            titulo="Nenhuma meta criada"
            descricao="Metas são por colaborador: quantidade ou faturamento, com faixas de recompensa."
          />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {metas.map((meta) => {
              const colaborador = colaboradores.find((c) => c.id === meta.colaboradorId);
              if (!colaborador) return null;
              const progresso = medirMeta(meta, colaborador, pedidos);
              return (
                <Card
                  key={meta.id}
                  className={cn("flex flex-col gap-3 p-5", !meta.ativa && "opacity-60")}
                >
                  <div className="flex items-start gap-3">
                    <AvatarAnel nome={colaborador.nome} imagemUrl={colaborador.avatarUrl} progresso={progresso.progresso} tamanho={40} />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium">{meta.nome}</span>
                      <span className="text-[13px] text-muted-fg">
                        {colaborador.nome} · {ROTULO_PERIODO_META[meta.periodo]}
                        {!meta.ativa && " · inativa"}
                      </span>
                    </div>
                    <Botao
                      variante="fantasma"
                      tamanho="iconeSm"
                      aria-label={`Editar ${meta.nome}`}
                      onClick={() => setEdicao({ tipo: "meta", meta })}
                    >
                      <Icone nome="editar" size={14} />
                    </Botao>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-[13px]">
                      <span className="text-muted-fg">Agora</span>
                      <span className="tabular font-medium">
                        {formatarAlvo(meta.tipo, progresso.atual)}
                        {progresso.proxima && (
                          <span className="font-normal text-muted-fg">
                            {" "}
                            de {formatarAlvo(meta.tipo, progresso.proxima.alvo)}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                      <div
                        className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-500"
                        style={{ width: `${progresso.progresso * 100}%` }}
                      />
                    </div>
                  </div>
                  <ul className="flex flex-wrap gap-2">
                    {meta.faixas.map((faixa) => {
                      const batida = progresso.atual >= faixa.alvo;
                      return (
                        <li
                          key={faixa.id}
                          className={cn(
                            "tabular inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
                            batida
                              ? "border-[var(--accent)] text-fg"
                              : "border-border text-muted-fg",
                          )}
                        >
                          {batida && <Icone nome="check" size={11} className="text-[var(--accent)]" />}
                          {formatarAlvo(meta.tipo, faixa.alvo)} → {descreverRecompensa(faixa)}
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              );
            })}
          </div>
        ))}

      <ModalNivel
        aberto={edicao?.tipo === "nivel"}
        nivel={edicao?.tipo === "nivel" ? edicao.nivel : null}
        aoFechar={() => setEdicao(null)}
      />
      <ModalConquista
        aberto={edicao?.tipo === "conquista"}
        conquista={edicao?.tipo === "conquista" ? edicao.conquista : null}
        aoFechar={() => setEdicao(null)}
      />
      <ModalMeta
        aberto={edicao?.tipo === "meta"}
        meta={edicao?.tipo === "meta" ? edicao.meta : null}
        colaboradorId={null}
        aoFechar={() => setEdicao(null)}
      />
    </div>
  );
}
