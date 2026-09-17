"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Colaborador, Meta } from "@/lib/types";
import { ROTULO_PERIODO_META, ROTULO_SETOR } from "@/lib/types";
import {
  formatBps,
  formatBRL,
  formatData,
  formatNumero,
  formatPercentual,
} from "@/lib/format";
import { calcularFechamento, comissionavel } from "@/lib/comissoes";
import { desempenhoNo } from "@/lib/desempenho";
import { descreverRecompensa, formatarAlvo, medirMeta } from "@/lib/metas";
import { competenciaAtual, janelaDaMeta } from "@/lib/periodos";
import { useEquipe } from "@/lib/providers/equipe";
import { progressoNivel } from "@/lib/dominio/equipe";
import { AcessoColaborador } from "./acesso-colaborador";
import { usePedidos } from "@/lib/providers/pedidos";
import { useSessao } from "@/lib/providers/sessao";
import { Icone } from "@/components/icone";
import { Botao } from "@/components/ui/button";
import {
  Gaveta,
  GavetaCabecalho,
  GavetaConteudo,
  GavetaCorpo,
} from "@/components/ui/drawer";
import {
  Selecao,
  SelecaoConteudo,
  SelecaoGatilho,
  SelecaoItem,
  SelecaoValor,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { AvatarAnel } from "@/components/shared/avatar-anel";
import { CardPremiacao } from "@/components/shared/card-premiacao";
import { LinhaIndicadores } from "@/components/shared/indicadores";
import { BonusLiberados } from "./bonus-liberados";
import { ModalMeta } from "./modal-meta";

function Bloco({ titulo, acao, children }: { titulo: string; acao?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[13px] font-medium text-muted-fg">{titulo}</h3>
        {acao}
      </div>
      {children}
    </section>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 text-[13px]">
      <span className="text-muted-fg">{rotulo}</span>
      <span className="tabular text-right font-medium">{valor}</span>
    </div>
  );
}

export function GavetaColaborador({
  colaborador,
  aberto,
  aoFechar,
  aoEditar,
}: {
  colaborador: Colaborador | null;
  aberto: boolean;
  aoFechar: () => void;
  aoEditar: () => void;
}) {
  return (
    <Gaveta open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <GavetaConteudo larguraMaxima="sm:max-w-2xl">
        {colaborador && <Conteudo colaborador={colaborador} aoEditar={aoEditar} />}
      </GavetaConteudo>
    </Gaveta>
  );
}

function Conteudo({ colaborador, aoEditar }: { colaborador: Colaborador; aoEditar: () => void }) {
  const equipe = useEquipe();
  const { niveis, metas, conquistas, desbloqueadas, nomeDe, registrarConquista } = equipe;
  const { pedidos } = usePedidos();
  const { ehAdmin } = useSessao();
  const [conquistaId, setConquistaId] = useState("");
  const [metaAberta, setMetaAberta] = useState<{ meta: Meta | null } | null>(null);
  const [premiado, setPremiado] = useState(false);

  const { atual, proximo, progresso } = progressoNivel(niveis, colaborador);
  const mes = janelaDaMeta("mensal");
  const desempenho = desempenhoNo(colaborador, pedidos, mes);
  const cobrador = colaborador.setor === "financeiro";
  const fechamento = comissionavel(colaborador)
    ? calcularFechamento(colaborador, competenciaAtual(), pedidos, equipe)
    : null;
  const linhaComissao = fechamento?.detalhamento.find((l) => l.grupo === "comissao");
  const suasMetas = metas.filter((m) => m.colaboradorId === colaborador.id);
  const recentes = desbloqueadas
    .filter((d) => d.colaboradorId === colaborador.id)
    .sort((a, b) => b.desbloqueadaEm.localeCompare(a.desbloqueadaEm))
    .slice(0, 5);

  async function registrar() {
    const conquista = conquistas.find((c) => c.id === conquistaId);
    if (!conquista) return;
    const liberados = await registrarConquista(colaborador.id, conquista.id);
    if (!liberados) return;
    setConquistaId("");
    if (liberados.length > 0) {
      setPremiado(true);
      toast.success(`${colaborador.apelido} subiu de nível`, {
        description: `Bônus de ${formatBRL(liberados.reduce((s, b) => s + b.valor, 0))} liberado, aguardando pagamento.`,
      });
    } else {
      toast.success(`+${conquista.pontos} pontos para ${colaborador.apelido}`, {
        description: conquista.nome,
      });
    }
  }

  return (
    <>
      <GavetaCabecalho
        titulo={
          <span className="flex items-center gap-3">
            <AvatarAnel nome={colaborador.nome} imagemUrl={colaborador.avatarUrl} progresso={progresso} tamanho={44} />
            <span className="truncate">{colaborador.nome}</span>
          </span>
        }
        descricao={`${ROTULO_SETOR[colaborador.setor]} · ${colaborador.email}${colaborador.ativo ? "" : " · inativo"}`}
        acoes={
          ehAdmin ? (
            <Botao variante="secundaria" tamanho="sm" onClick={aoEditar}>
              <Icone nome="editar" size={14} />
              Editar
            </Botao>
          ) : undefined
        }
      />
      <GavetaCorpo className="flex flex-col gap-7">
        <CardPremiacao
          key={colaborador.nivelId}
          animar={premiado}
          icone="medalha"
          titulo={`${atual?.nome ?? "Sem nível"} · ${formatNumero(colaborador.pontos)} pontos`}
          descricao={
            proximo
              ? `Faltam ${formatNumero(Math.max(proximo.pontosNecessarios - colaborador.pontos, 0))} pontos para ${proximo.nome}${proximo.bonus > 0 ? `, que libera ${formatBRL(proximo.bonus)}` : ""}.`
              : "Topo da trilha."
          }
          progresso={progresso}
        />

        <BonusLiberados colaboradorId={colaborador.id} />

        <Bloco titulo="Neste mês">
          <LinhaIndicadores
            itens={[
              {
                icone: cobrador ? "cobranca" : "pedidos",
                valor: formatNumero(desempenho.pedidos),
                rotulo: cobrador ? "Pedidos pagos" : "Agendados",
              },
              {
                icone: "dinheiro",
                valor: formatBRL(desempenho.faturamento),
                rotulo: cobrador ? "Recebido" : "Faturamento",
              },
              {
                icone: "alerta",
                valor: desempenho.frustracao === null ? "—" : formatPercentual(desempenho.frustracao),
                rotulo: cobrador ? "Frustração da carteira" : "Frustração real",
              },
            ]}
          />
          {fechamento && linhaComissao && (
            <div className="rounded-[var(--radius-card-sm)] border border-border bg-surface-2 px-4 py-3">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-[13px] font-medium">Comissão até agora</span>
                <span className="tabular text-lg font-medium">{formatBRL(fechamento.comissao)}</span>
              </div>
              <p className="tabular mt-1 text-xs text-muted-fg">
                {linhaComissao.rotulo}: {linhaComissao.conta}
              </p>
            </div>
          )}
        </Bloco>

        <Bloco
          titulo={`Metas · ${suasMetas.length}`}
          acao={
            ehAdmin ? (
              <Botao variante="destaqueSuave" tamanho="sm" onClick={() => setMetaAberta({ meta: null })}>
                <Icone nome="adicionar" size={14} />
                Nova meta
              </Botao>
            ) : undefined
          }
        >
          {suasMetas.length === 0 ? (
            <p className="text-[13px] text-muted-fg">
              Sem metas. {cobrador ? "Metas de cobrador contam pedidos pagos." : "Metas de vendedor contam pedidos agendados."}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {suasMetas.map((meta) => {
                const p = medirMeta(meta, colaborador, pedidos);
                return (
                  <li key={meta.id}>
                    <button
                      type="button"
                      disabled={!ehAdmin}
                      onClick={() => setMetaAberta({ meta })}
                      className={cn(
                        "flex w-full flex-col gap-2 rounded-[var(--radius-card-sm)] border border-border px-4 py-3 text-left transition-colors enabled:hover:border-border-strong",
                        !meta.ativa && "opacity-60",
                      )}
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-[13px] font-medium">
                          {meta.nome}
                          <span className="font-normal text-muted-fg"> · {ROTULO_PERIODO_META[meta.periodo].toLowerCase()}</span>
                        </span>
                        <span className="tabular text-[13px]">
                          {formatarAlvo(meta.tipo, p.atual)}
                          {p.proxima && <span className="text-muted-fg"> de {formatarAlvo(meta.tipo, p.proxima.alvo)}</span>}
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                        <div
                          className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-500"
                          style={{ width: `${p.progresso * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-fg">
                        {p.atingida
                          ? `Faixa batida: ${descreverRecompensa(p.atingida)}.`
                          : `Primeira faixa: ${descreverRecompensa(meta.faixas[0])}.`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Bloco>

        {ehAdmin && colaborador.perfil !== "admin" && (
          <Bloco titulo="Acesso">
            <AcessoColaborador colaborador={colaborador} />
          </Bloco>
        )}

        <Bloco titulo="Remuneração">
          <div className="rounded-[var(--radius-card-sm)] border border-border px-4 py-1.5">
            <Linha rotulo="Salário fixo" valor={formatBRL(colaborador.salarioFixo)} />
            <Linha rotulo="Dia de pagamento" valor={`Dia ${colaborador.diaPagamento}`} />
            <Linha rotulo="Chave Pix" valor={colaborador.chavePix ?? "—"} />
            <Linha
              rotulo={cobrador ? "Comissão sobre o recebido" : "Comissão"}
              valor={formatBps(colaborador.comissaoBps)}
            />
            {!cobrador && colaborador.frustradoBps !== null && (
              <Linha rotulo="Frustrado fixo" valor={formatBps(colaborador.frustradoBps)} />
            )}
            {cobrador && (
              <Linha
                rotulo="Vendedores atribuídos"
                valor={
                  colaborador.vendedoresAtribuidos.length > 0
                    ? colaborador.vendedoresAtribuidos.map(nomeDe).join(", ")
                    : "Nenhum"
                }
              />
            )}
          </div>
        </Bloco>

        <Bloco titulo="Conquistas recentes">
          {ehAdmin && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Selecao value={conquistaId} onValueChange={setConquistaId}>
                <SelecaoGatilho className="flex-1">
                  <SelecaoValor placeholder="Registrar uma conquista" />
                </SelecaoGatilho>
                <SelecaoConteudo>
                  {conquistas
                    .filter((c) => c.ativa)
                    .filter(
                      (c) =>
                        c.repetivel ||
                        !desbloqueadas.some((d) => d.conquistaId === c.id && d.colaboradorId === colaborador.id),
                    )
                    .map((c) => (
                      <SelecaoItem key={c.id} value={c.id}>
                        {c.nome} (+{c.pontos})
                      </SelecaoItem>
                    ))}
                </SelecaoConteudo>
              </Selecao>
              <Botao variante="secundaria" disabled={!conquistaId} onClick={registrar}>
                <Icone nome="adicionar" size={15} />
                Registrar
              </Botao>
            </div>
          )}
          {recentes.length === 0 ? (
            <p className="text-[13px] text-muted-fg">Nenhuma conquista ainda.</p>
          ) : (
            <ul className="flex flex-col">
              {recentes.map((d, i) => {
                const conquista = conquistas.find((c) => c.id === d.conquistaId);
                return (
                  <li
                    key={`${d.conquistaId}-${d.desbloqueadaEm}-${i}`}
                    className="flex items-center justify-between gap-3 border-b border-border py-2 text-[13px] last:border-b-0"
                  >
                    <span>{conquista?.nome ?? "Conquista"}</span>
                    <span className="tabular text-muted-fg">
                      +{conquista?.pontos ?? 0} · {formatData(d.desbloqueadaEm)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Bloco>
      </GavetaCorpo>

      <ModalMeta
        aberto={metaAberta !== null}
        meta={metaAberta?.meta ?? null}
        colaboradorId={colaborador.id}
        aoFechar={() => setMetaAberta(null)}
      />
    </>
  );
}
