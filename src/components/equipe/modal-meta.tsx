"use client";

import { useState } from "react";
import type { FaixaMeta, Meta, PeriodoMeta, TipoMeta, TipoRecompensa } from "@/lib/types";
import { ROTULO_PERIODO_META } from "@/lib/types";
import {
  bpsParaCampo,
  centavosParaCampo,
  parseBRL,
  parsePercentual,
} from "@/lib/format";
import { baseDaMeta, descreverRecompensa, formatarAlvo } from "@/lib/metas";
import { useEquipe } from "@/lib/providers/equipe";
import { Icone } from "@/components/icone";
import { Botao } from "@/components/ui/button";
import { Modal, ModalCabecalho, ModalConteudo, ModalRodape } from "@/components/ui/dialog";
import { Campo, Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Selecao,
  SelecaoConteudo,
  SelecaoGatilho,
  SelecaoItem,
  SelecaoValor,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { ControleSegmentado } from "@/components/shared/controles";
import { CampoAtivo } from "@/components/config/modais-catalogo";

interface FaixaEditavel {
  id: string;
  alvo: string;
  recompensa: TipoRecompensa;
  valor: string;
}

let sequenciaFaixa = 0;
function novaFaixa(): FaixaEditavel {
  sequenciaFaixa += 1;
  return { id: `fx_nova_${sequenciaFaixa}`, alvo: "", recompensa: "bonus", valor: "" };
}

function paraEditavel(faixa: FaixaMeta, tipo: TipoMeta): FaixaEditavel {
  return {
    id: faixa.id,
    alvo: tipo === "faturamento" ? centavosParaCampo(faixa.alvo) : String(faixa.alvo),
    recompensa: faixa.recompensa,
    valor: faixa.recompensa === "bonus" ? centavosParaCampo(faixa.valor) : bpsParaCampo(faixa.valor),
  };
}

/**
 * Meta de um colaborador. O que conta é fixo pelo setor; aqui se escolhe se
 * mede quantidade ou valor, o período e as faixas de recompensa.
 */
export function ModalMeta({
  meta,
  colaboradorId,
  aberto,
  aoFechar,
}: {
  meta: Meta | null;
  /** Obrigatório para meta nova; sem ele, o formulário pede o colaborador. */
  colaboradorId: string | null;
  aberto: boolean;
  aoFechar: () => void;
}) {
  if (!aberto) return null;
  return (
    <FormularioMeta
      key={meta?.id ?? `nova-${colaboradorId}`}
      meta={meta}
      colaboradorFixo={meta?.colaboradorId ?? colaboradorId}
      aoFechar={aoFechar}
    />
  );
}

function FormularioMeta({
  meta,
  colaboradorFixo,
  aoFechar,
}: {
  meta: Meta | null;
  colaboradorFixo: string | null;
  aoFechar: () => void;
}) {
  const { colaboradores, salvarMeta, excluirMeta } = useEquipe();
  const elegiveis = colaboradores.filter((c) => c.setor !== "administracao" && c.ativo);
  const [colaboradorId, setColaboradorId] = useState(colaboradorFixo ?? "");
  const [nome, setNome] = useState(meta?.nome ?? "");
  const [tipo, setTipo] = useState<TipoMeta>(meta?.tipo ?? "pedidos");
  const [periodo, setPeriodo] = useState<PeriodoMeta>(meta?.periodo ?? "mensal");
  const [faixas, setFaixas] = useState<FaixaEditavel[]>(
    meta ? meta.faixas.map((f) => paraEditavel(f, meta.tipo)) : [novaFaixa()],
  );
  const [ativa, setAtiva] = useState(meta?.ativa ?? true);
  const [erros, setErros] = useState<Record<string, string>>({});

  const colaborador = colaboradores.find((c) => c.id === colaboradorId) ?? null;

  function mudarFaixa(id: string, parcial: Partial<FaixaEditavel>) {
    setFaixas((atual) => atual.map((f) => (f.id === id ? { ...f, ...parcial } : f)));
  }

  function converter(): FaixaMeta[] | null {
    const convertidas: FaixaMeta[] = [];
    for (const f of faixas) {
      const alvo = tipo === "faturamento" ? parseBRL(f.alvo) : Number(f.alvo);
      const valor = f.recompensa === "bonus" ? parseBRL(f.valor) : parsePercentual(f.valor);
      if (!alvo || alvo <= 0 || !valor || valor <= 0) return null;
      convertidas.push({ id: f.id, alvo, recompensa: f.recompensa, valor });
    }
    return convertidas.sort((a, b) => a.alvo - b.alvo);
  }

  function salvar() {
    const e: Record<string, string> = {};
    if (!colaboradorId) e.colaborador = "Escolha de quem é a meta.";
    if (!nome.trim()) e.nome = "Dê um nome, como “Agendados da semana”.";
    const convertidas = converter();
    if (faixas.length === 0) e.faixas = "Crie pelo menos uma faixa.";
    else if (!convertidas) e.faixas = "Preencha o alvo e a recompensa de todas as faixas.";
    else if (new Set(convertidas.map((f) => f.alvo)).size !== convertidas.length) {
      e.faixas = "Duas faixas não podem ter o mesmo alvo.";
    }
    setErros(e);
    if (Object.keys(e).length > 0 || !convertidas) return;

    const salva = salvarMeta({
      id: meta?.id,
      colaboradorId,
      nome: nome.trim(),
      tipo,
      periodo,
      faixas: convertidas,
      ativa,
    });
    toast.success(meta ? "Meta atualizada" : "Meta criada", {
      description: `${salva.faixas.length} ${salva.faixas.length === 1 ? "faixa" : "faixas"}, a primeira em ${formatarAlvo(salva.tipo, salva.faixas[0].alvo)}.`,
    });
    aoFechar();
  }

  return (
    <Modal open onOpenChange={(v) => !v && aoFechar()}>
      <ModalConteudo larguraMaxima="max-w-xl">
        <ModalCabecalho
          titulo={meta ? "Editar meta" : "Nova meta"}
          descricao="Vale a faixa mais alta alcançada no período, nunca a soma das faixas."
        />
        <div className="flex flex-col gap-4">
          {!colaboradorFixo && (
            <Campo rotulo="Colaborador" obrigatorio erro={erros.colaborador}>
              <Selecao value={colaboradorId} onValueChange={setColaboradorId}>
                <SelecaoGatilho>
                  <SelecaoValor placeholder="Escolha o colaborador" />
                </SelecaoGatilho>
                <SelecaoConteudo>
                  {elegiveis.map((c) => (
                    <SelecaoItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelecaoItem>
                  ))}
                </SelecaoConteudo>
              </Selecao>
            </Campo>
          )}

          <Campo rotulo="Nome" obrigatorio erro={erros.nome}>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Agendados da semana" />
          </Campo>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Mede</Label>
              <ControleSegmentado
                tamanho="sm"
                valor={tipo}
                aoMudar={(v) => {
                  setTipo(v);
                  setFaixas((atual) => atual.map((f) => ({ ...f, alvo: "" })));
                }}
                opcoes={[
                  { valor: "pedidos", rotulo: "Pedidos" },
                  { valor: "faturamento", rotulo: "Faturamento" },
                ]}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Período</Label>
              <ControleSegmentado
                tamanho="sm"
                valor={periodo}
                aoMudar={setPeriodo}
                opcoes={(Object.keys(ROTULO_PERIODO_META) as PeriodoMeta[]).map((p) => ({
                  valor: p,
                  rotulo: ROTULO_PERIODO_META[p],
                }))}
              />
            </div>
          </div>

          {colaborador && (
            <p className="flex items-start gap-2 rounded-[var(--radius-card-sm)] bg-surface-2 px-4 py-3 text-[13px] text-muted-fg">
              <Icone nome="info" size={15} className="mt-0.5 shrink-0" />
              <span>
                Conta: <span className="text-fg">{baseDaMeta(colaborador, tipo).toLowerCase()}</span>.
                A regra é fixa para o setor.
              </span>
            </p>
          )}

          <div className="flex flex-col gap-2">
            <Label>Faixas</Label>
            {faixas.map((faixa, i) => (
              <div
                key={faixa.id}
                className="grid grid-cols-[1fr_auto] items-end gap-2 rounded-[var(--radius-card-sm)] border border-border p-3 sm:grid-cols-[1fr_auto_1fr_auto]"
              >
                <Campo rotulo={`${i + 1}ª faixa: alvo`}>
                  <Input
                    value={faixa.alvo}
                    onChange={(e) =>
                      mudarFaixa(faixa.id, {
                        alvo: tipo === "pedidos" ? e.target.value.replace(/\D/g, "") : e.target.value,
                      })
                    }
                    inputMode={tipo === "pedidos" ? "numeric" : "decimal"}
                    placeholder={tipo === "pedidos" ? "10 pedidos" : "R$ 0,00"}
                    className="tabular"
                  />
                </Campo>
                <Botao
                  type="button"
                  variante="fantasma"
                  tamanho="icone"
                  className="sm:order-last"
                  aria-label={`Remover ${i + 1}ª faixa`}
                  onClick={() => setFaixas((atual) => atual.filter((f) => f.id !== faixa.id))}
                >
                  <Icone nome="excluir" size={15} />
                </Botao>
                <div className="flex flex-col gap-1.5">
                  <Label>Recompensa</Label>
                  <ControleSegmentado
                    tamanho="sm"
                    valor={faixa.recompensa}
                    aoMudar={(v) => mudarFaixa(faixa.id, { recompensa: v, valor: "" })}
                    opcoes={[
                      { valor: "bonus", rotulo: "Bônus R$" },
                      { valor: "percentual", rotulo: "+ %" },
                    ]}
                  />
                </div>
                <Campo rotulo={faixa.recompensa === "bonus" ? "Valor do bônus" : "Aumento da comissão"}>
                  <Input
                    value={faixa.valor}
                    onChange={(e) => mudarFaixa(faixa.id, { valor: e.target.value })}
                    inputMode="decimal"
                    placeholder={faixa.recompensa === "bonus" ? "R$ 0,00" : "0,5 %"}
                    className="tabular"
                  />
                </Campo>
              </div>
            ))}
            {erros.faixas && <p className="text-xs text-[var(--st-vermelho-fg)]">{erros.faixas}</p>}
            <Botao
              type="button"
              variante="contorno"
              tamanho="sm"
              className="self-start"
              onClick={() => setFaixas((atual) => [...atual, novaFaixa()])}
            >
              <Icone nome="adicionar" size={14} />
              Adicionar faixa
            </Botao>
            <p className="text-xs text-muted-fg">
              “+ %” soma pontos percentuais à comissão sobre a base do período em que a faixa foi
              batida. Exemplo: {descreverRecompensa({ id: "", alvo: 0, recompensa: "percentual", valor: 50 })}.
            </p>
          </div>

          <CampoAtivo
            ativo={ativa}
            aoMudar={setAtiva}
            rotulo="Meta ativa"
            descricao="Inativa, não gera bônus nem aparece no progresso."
          />
        </div>
        <ModalRodape className="sm:justify-between">
          {meta ? (
            <Botao
              variante="perigo"
              onClick={() => {
                excluirMeta(meta.id);
                toast.success("Meta excluída", { description: `${meta.nome} não gera mais bônus.` });
                aoFechar();
              }}
            >
              <Icone nome="excluir" size={15} />
              Excluir meta
            </Botao>
          ) : (
            <span />
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Botao variante="secundaria" onClick={aoFechar}>
              Cancelar
            </Botao>
            <Botao variante="principal" onClick={salvar}>
              <Icone nome="check" size={15} />
              {meta ? "Salvar meta" : "Criar meta"}
            </Botao>
          </div>
        </ModalRodape>
      </ModalConteudo>
    </Modal>
  );
}
