"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Conquista, Meta, Nivel, Recompensa } from "@/lib/types";
import { ROTULO_PERIODO_META } from "@/lib/types";
import { formatBRL, formatData, formatDiaCurto, formatNumero } from "@/lib/format";
import { corDaChave, ehChaveCor } from "@/lib/cores";
import { rotuloDaJanela } from "@/lib/periodos";
import { descreverCondicao } from "@/lib/metricas";
import { descreverMeta } from "@/lib/metas";
import { descreverRecompensa } from "@/lib/recompensas";
import { useEquipe } from "@/lib/providers/equipe";
import { useParametroUrl } from "@/lib/url";
import { Icone, type NomeIcone } from "@/components/icone";
import { Botao } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { ControleSegmentado } from "@/components/shared/controles";
import { EstadoVazio } from "@/components/shared/estado-vazio";
import { AvatarAnel } from "@/components/shared/avatar-anel";
import { SeloTom } from "@/components/shared/selo-status";
import { EditorPontuacao } from "@/components/config/editor-pontuacao";
import { ModalConquista, ModalNivel, rotuloBonus } from "@/components/config/modais-premiacao";
import { ModalRecompensa } from "@/components/config/modal-recompensa";
import { ModalMeta } from "@/components/equipe/modal-meta";
import { BonusLiberados } from "@/components/equipe/bonus-liberados";

type Secao = "pontuacao" | "niveis" | "metas" | "conquistas" | "recompensas";

const SECOES: Secao[] = ["pontuacao", "niveis", "metas", "conquistas", "recompensas"];

type Edicao =
  | { tipo: "nivel"; nivel: Nivel | null }
  | { tipo: "conquista"; conquista: Conquista | null }
  | { tipo: "meta"; meta: Meta | null }
  | { tipo: "recompensa"; recompensa: Recompensa | null }
  | null;

function icone(nome: string): NomeIcone {
  return (nome || "medalha") as NomeIcone;
}

export default function PaginaPontosEMetas() {
  const {
    niveis,
    conquistas,
    metas,
    recompensas,
    recompensasLiberadas,
    colaboradores,
    bonusNivel,
    nomeDe,
    avaliarJanelas,
  } = useEquipe();
  const [parametro, definirParametro] = useParametroUrl("secao");
  const secao = (SECOES.includes(parametro as Secao) ? parametro : "pontuacao") as Secao;
  const [edicao, setEdicao] = useState<Edicao>(null);
  const [avaliando, setAvaliando] = useState(false);

  const trilha = [...niveis].sort((a, b) => a.ordem - b.ordem);

  const acao =
    secao === "niveis" ? (
      <Botao variante="principal" onClick={() => setEdicao({ tipo: "nivel", nivel: null })}>
        <Icone nome="adicionar" size={16} />
        Novo nível
      </Botao>
    ) : secao === "conquistas" ? (
      <Botao variante="principal" onClick={() => setEdicao({ tipo: "conquista", conquista: null })}>
        <Icone nome="adicionar" size={16} />
        Nova conquista
      </Botao>
    ) : secao === "metas" ? (
      <Botao variante="principal" onClick={() => setEdicao({ tipo: "meta", meta: null })}>
        <Icone nome="adicionar" size={16} />
        Nova meta
      </Botao>
    ) : secao === "recompensas" ? (
      <Botao variante="principal" onClick={() => setEdicao({ tipo: "recompensa", recompensa: null })}>
        <Icone nome="adicionar" size={16} />
        Nova recompensa
      </Botao>
    ) : undefined;

  async function fecharJanelas() {
    setAvaliando(true);
    const resultado = await avaliarJanelas();
    setAvaliando(false);
    if (!resultado) return;
    toast.success("Janelas conferidas", {
      description:
        resultado.conquistas + resultado.recompensas === 0
          ? `${resultado.janelas} janelas conferidas, nada novo a liberar.`
          : `${resultado.conquistas} conquistas e ${resultado.recompensas} recompensas liberadas.`,
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Pontos e metas"
        descricao="Pedido pontua, ponto sobe de nível, meta batida libera recompensa. Tudo configurado aqui."
        acao={acao}
      />

      <BonusLiberados />

      <ControleSegmentado
        valor={secao}
        aoMudar={(v) => definirParametro(v === "pontuacao" ? null : v)}
        opcoes={[
          { valor: "pontuacao", rotulo: "Pontuação", icone: "metas" },
          { valor: "niveis", rotulo: "Níveis", icone: "medalha", contador: niveis.length },
          { valor: "metas", rotulo: "Metas", icone: "tendencia", contador: metas.length },
          { valor: "conquistas", rotulo: "Conquistas", icone: "ranking", contador: conquistas.length },
          { valor: "recompensas", rotulo: "Recompensas", icone: "dinheiro", contador: recompensas.length },
        ]}
      />

      {secao === "pontuacao" && <EditorPontuacao />}

      {secao === "niveis" &&
        (trilha.length === 0 ? (
          <EstadoVazio
            icone="medalha"
            titulo="Nenhum nível cadastrado"
            descricao="Sem trilha, os pontos somam mas ninguém sobe de nível."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {trilha.map((nivel, i) => {
              const proximo = trilha[i + 1];
              const nele = colaboradores.filter(
                (c) => c.nivelId === nivel.id && c.setor !== "administracao",
              );
              const pendentes = bonusNivel.filter(
                (b) => b.nivelId === nivel.id && b.status === "liberado",
              ).length;
              const cor = nivel.cor && ehChaveCor(nivel.cor) ? corDaChave(nivel.cor) : null;
              return (
                <Card key={nivel.id} className="flex flex-col gap-4 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className="flex size-10 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]"
                      style={cor ? { backgroundColor: `${cor}22`, color: cor } : undefined}
                    >
                      <Icone nome={icone(nivel.icone)} size={18} />
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
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-fg">Bônus</span>
                      <span className="tabular font-medium">{rotuloBonus(nivel.bonus)}</span>
                    </div>
                    {nivel.beneficio && (
                      <div className="flex justify-between gap-3">
                        <span className="shrink-0 text-muted-fg">Benefício</span>
                        <span className="text-right font-medium">{nivel.beneficio}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-muted-fg">Na equipe</span>
                      <span className="flex -space-x-2">
                        {nele.length === 0 ? (
                          <span className="text-muted-fg">ninguém</span>
                        ) : (
                          nele.map((c) => (
                            <AvatarAnel
                              key={c.id}
                              nome={c.nome}
                              imagemUrl={c.avatarUrl}
                              mostrarAnel={false}
                              tamanho={24}
                              className="rounded-full ring-2 ring-surface-1"
                            />
                          ))
                        )}
                      </span>
                    </div>
                    {pendentes > 0 && (
                      <SeloTom tom="bronze" className="self-start">
                        {pendentes} bônus para pagar
                      </SeloTom>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        ))}

      {secao === "metas" &&
        (metas.length === 0 ? (
          <EstadoVazio
            icone="tendencia"
            titulo="Nenhuma meta criada"
            descricao="A meta escolhe a métrica, o alvo e a janela — de um setor inteiro ou de uma pessoa."
          />
        ) : (
          <Card>
            <ul className="flex flex-col">
              {metas.map((meta, i) => (
                <li
                  key={meta.id}
                  className={cn(
                    "flex flex-wrap items-center gap-4 px-5 py-4",
                    i > 0 && "border-t border-border",
                    !meta.ativa && "opacity-60",
                  )}
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[var(--accent)]">
                    <Icone nome="tendencia" size={18} />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="flex flex-wrap items-center gap-2 font-medium">
                      {meta.nome}
                      {!meta.ativa && (
                        <SeloTom tom="cinza" ponto={false}>
                          Inativa
                        </SeloTom>
                      )}
                    </span>
                    <span className="text-[13px] text-muted-fg">
                      {descreverMeta(meta)} ·{" "}
                      {meta.colaboradorId
                        ? nomeDe(meta.colaboradorId)
                        : meta.setor === "vendas"
                          ? "todos os vendedores"
                          : "todo o financeiro"}
                    </span>
                  </div>
                  <span className="text-xs text-muted-fg">
                    {ROTULO_PERIODO_META[meta.periodo]} · desde {formatDiaCurto(meta.vigenteDesde)}
                    {meta.vigenteAte ? ` até ${formatDiaCurto(meta.vigenteAte)}` : ""}
                  </span>
                  <Botao
                    variante="fantasma"
                    tamanho="iconeSm"
                    aria-label={`Editar ${meta.nome}`}
                    onClick={() => setEdicao({ tipo: "meta", meta })}
                  >
                    <Icone nome="editar" size={14} />
                  </Botao>
                </li>
              ))}
            </ul>
          </Card>
        ))}

      {secao === "conquistas" &&
        (conquistas.length === 0 ? (
          <EstadoVazio
            icone="ranking"
            titulo="Nenhuma conquista criada"
            descricao="Conquistas dão pontos quando a janela fecha e a condição foi cumprida."
          />
        ) : (
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
                    <Icone nome={icone(conquista.icone)} size={18} />
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
                      {descreverCondicao(conquista.metrica, conquista.operador, conquista.valor)} ·{" "}
                      {ROTULO_PERIODO_META[conquista.periodo].toLowerCase()}
                      {conquista.setor
                        ? ` · ${conquista.setor === "vendas" ? "vendedores" : "financeiro"}`
                        : " · todos"}
                    </span>
                  </div>
                  <span className="text-xs text-muted-fg">
                    {conquista.repetivel ? "Pontua a cada janela" : "Uma vez só"}
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
        ))}

      {secao === "recompensas" && (
        <div className="flex flex-col gap-4">
          {recompensas.length === 0 ? (
            <EstadoVazio
              icone="dinheiro"
              titulo="Nenhuma recompensa criada"
              descricao="A recompensa é um bônus em dinheiro liberado quando a janela fecha com a condição cumprida."
            />
          ) : (
            <Card>
              <ul className="flex flex-col">
                {recompensas.map((recompensa, i) => (
                  <li
                    key={recompensa.id}
                    className={cn(
                      "flex flex-wrap items-center gap-4 px-5 py-4",
                      i > 0 && "border-t border-border",
                      !recompensa.ativa && "opacity-60",
                    )}
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[var(--accent)]">
                      <Icone nome="dinheiro" size={18} />
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="flex flex-wrap items-center gap-2 font-medium">
                        {recompensa.nome}
                        {!recompensa.ativa && (
                          <SeloTom tom="cinza" ponto={false}>
                            Inativa
                          </SeloTom>
                        )}
                      </span>
                      <span className="text-[13px] text-muted-fg">
                        {descreverRecompensa(recompensa, metas)} ·{" "}
                        {ROTULO_PERIODO_META[recompensa.periodo].toLowerCase()} ·{" "}
                        {recompensa.colaboradorId
                          ? nomeDe(recompensa.colaboradorId)
                          : recompensa.setor === "vendas"
                            ? "vendedores"
                            : recompensa.setor === "financeiro"
                              ? "financeiro"
                              : "todos"}
                      </span>
                    </div>
                    <span className="tabular w-28 text-right font-medium">
                      {formatBRL(recompensa.valor)}
                    </span>
                    <Botao
                      variante="fantasma"
                      tamanho="iconeSm"
                      aria-label={`Editar ${recompensa.nome}`}
                      onClick={() => setEdicao({ tipo: "recompensa", recompensa })}
                    >
                      <Icone nome="editar" size={14} />
                    </Botao>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card className="flex flex-col gap-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <h2 className="text-base font-medium tracking-tight">Liberadas</h2>
                <p className="text-[13px] text-muted-fg">
                  As janelas fecham sozinhas de madrugada. O pagamento sai no fechamento do mês, em
                  Comissões.
                </p>
              </div>
              <Botao variante="secundaria" onClick={fecharJanelas} disabled={avaliando}>
                <Icone nome="atualizar" size={15} />
                {avaliando ? "Conferindo…" : "Conferir agora"}
              </Botao>
            </div>
            {recompensasLiberadas.length === 0 ? (
              <p className="text-[13px] text-muted-fg">Nada liberado ainda.</p>
            ) : (
              <ul className="flex flex-col">
                {[...recompensasLiberadas]
                  .sort((a, b) => b.liberadaEm.localeCompare(a.liberadaEm))
                  .slice(0, 20)
                  .map((liberada) => (
                    <li
                      key={liberada.id}
                      className="flex flex-wrap items-center gap-3 border-t border-border py-2.5 text-[13px] first:border-t-0"
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {nomeDe(liberada.colaboradorId)} · {liberada.nome}
                      </span>
                      <span className="text-xs text-muted-fg">
                        {rotuloDaJanela(liberada.janela)} · {formatData(liberada.liberadaEm)}
                      </span>
                      <SeloTom tom={liberada.status === "pago" ? "esmeralda" : "bronze"}>
                        {liberada.status === "pago" ? "Pago" : "No próximo fechamento"}
                      </SeloTom>
                      <span className="tabular w-24 text-right font-medium">
                        {formatBRL(liberada.valor)}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </Card>
        </div>
      )}

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
      <ModalRecompensa
        aberto={edicao?.tipo === "recompensa"}
        recompensa={edicao?.tipo === "recompensa" ? edicao.recompensa : null}
        aoFechar={() => setEdicao(null)}
      />
    </div>
  );
}
