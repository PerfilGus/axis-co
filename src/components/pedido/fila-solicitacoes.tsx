"use client";

import { useMemo, useState } from "react";
import type { AjusteValor, Pedido } from "@/lib/types";
import { formatBRL, formatDataHora } from "@/lib/format";
import { useSessao } from "@/lib/providers/sessao";
import { usePedidos } from "@/lib/providers/pedidos";
import { useEquipe } from "@/lib/providers/equipe";
import { Icone, type NomeIcone } from "@/components/icone";
import { Botao } from "@/components/ui/button";
import {
  Gaveta,
  GavetaCabecalho,
  GavetaConteudo,
  GavetaCorpo,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { SeloTom } from "@/components/shared/selo-status";
import { EstadoVazio } from "@/components/shared/estado-vazio";
import { toast } from "@/components/ui/toast";

const ROTULO_TIPO: Record<AjusteValor["tipo"], { texto: string; icone: NomeIcone }> = {
  desconto: { texto: "Desconto", icone: "percentual" },
  acrescimo: { texto: "Acréscimo", icone: "percentual" },
  alteracao_cadastral: { texto: "Alteração de dados", icone: "editar" },
  exclusao: { texto: "Exclusão", icone: "excluir" },
};

interface Solicitacao {
  pedido: Pedido;
  ajuste: AjusteValor;
}

/** Junta as solicitações pendentes de todos os pedidos no escopo. */
export function solicitacoesPendentes(
  pedidos: Pedido[],
  escopoVendedores: string[] | null,
): Solicitacao[] {
  return pedidos
    .filter((p) => !escopoVendedores || escopoVendedores.includes(p.vendedorId))
    .flatMap((pedido) =>
      pedido.ajustes
        .filter((ajuste) => ajuste.status === "pendente")
        .map((ajuste) => ({ pedido, ajuste })),
    )
    .sort(
      (a, b) =>
        new Date(a.ajuste.solicitadoEm).getTime() -
        new Date(b.ajuste.solicitadoEm).getTime(),
    );
}

/**
 * Aprovar ou recusar uma solicitação. A fila e o sino decidem pelo mesmo
 * caminho: aprovar exclusão também apaga o pedido.
 */
export function useDecidirSolicitacao() {
  const { decidirAjuste, excluir } = usePedidos();
  return async (
    pedido: Pedido,
    ajuste: AjusteValor,
    decisao: "aprovado" | "recusado",
    observacao: string | null,
  ): Promise<boolean> => {
    if (!(await decidirAjuste(pedido.id, ajuste.id, decisao, observacao))) return false;

    if (decisao === "aprovado" && ajuste.tipo === "exclusao") {
      if (!(await excluir(pedido.id))) return false;
      toast.success(`Pedido ${pedido.codigo} excluído`, {
        description: "A exclusão foi aprovada e o pedido saiu da lista.",
      });
      return true;
    }

    const mexeNoValor = ajuste.tipo === "desconto" || ajuste.tipo === "acrescimo";
    toast.success(
      decisao === "aprovado" ? "Solicitação aprovada" : "Solicitação recusada",
      {
        description: mexeNoValor && decisao === "aprovado"
          ? `${pedido.codigo} passou a valer ${formatBRL(ajuste.valorSolicitado)}.`
          : `${pedido.codigo} foi atualizado.`,
      },
    );
    return true;
  };
}

function CartaoSolicitacao({
  pedido,
  ajuste,
  aoAbrirPedido,
}: Solicitacao & { aoAbrirPedido: (pedido: Pedido) => void }) {
  const decidirSolicitacao = useDecidirSolicitacao();
  const { nomeDe: nomeColaborador } = useEquipe();
  const [observacao, setObservacao] = useState("");
  const tipo = ROTULO_TIPO[ajuste.tipo];
  const mexeNoValor = ajuste.tipo === "desconto" || ajuste.tipo === "acrescimo";

  function decidir(decisao: "aprovado" | "recusado") {
    return decidirSolicitacao(pedido, ajuste, decisao, observacao.trim() || null);
  }

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-card-sm)] border border-border bg-surface-2 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <SeloTom tom="bronze" ponto={false}>
          <Icone nome={tipo.icone} size={12} />
          {tipo.texto}
        </SeloTom>
        <button
          onClick={() => aoAbrirPedido(pedido)}
          className="tabular text-[13px] font-medium underline-offset-4 hover:underline"
        >
          {pedido.codigo}
        </button>
        <span className="text-[13px] text-muted-fg">{pedido.cliente.nome}</span>
      </div>

      {mexeNoValor && (
        <div className="flex items-center gap-2">
          <span className="tabular text-[13px] text-muted-fg line-through">
            {formatBRL(ajuste.valorAnterior)}
          </span>
          <Icone nome="avancar" size={12} className="text-muted-fg" />
          <span className="tabular text-[15px] font-medium">
            {formatBRL(ajuste.valorSolicitado)}
          </span>
        </div>
      )}

      <p className="text-[13px] text-fg">{ajuste.motivo}</p>
      <p className="text-[11px] text-muted-fg/80">
        {nomeColaborador(ajuste.solicitadoPor)} · {formatDataHora(ajuste.solicitadoEm)}
      </p>

      <Input
        value={observacao}
        onChange={(e) => setObservacao(e.target.value)}
        placeholder="Observação da decisão (opcional)"
        className="h-9 text-[13px]"
      />

      <div className="flex gap-2">
        <Botao variante="principal" tamanho="sm" onClick={() => decidir("aprovado")}>
          <Icone nome="check" size={14} />
          Aprovar
        </Botao>
        <Botao variante="secundaria" tamanho="sm" onClick={() => decidir("recusado")}>
          <Icone nome="fechar" size={14} />
          Recusar
        </Botao>
      </div>
    </div>
  );
}

/**
 * Fila de solicitações dos vendedores. Só o Admin resolve: aprovar um ajuste
 * de valor muda o valor do pedido, e aprovar uma exclusão apaga o pedido.
 */
export function FilaSolicitacoes({
  aberto,
  aoFechar,
  aoAbrirPedido,
}: {
  aberto: boolean;
  aoFechar: () => void;
  aoAbrirPedido: (pedido: Pedido) => void;
}) {
  const { pedidos } = usePedidos();
  const { escopoVendedores } = useSessao();
  const fila = useMemo(
    () => solicitacoesPendentes(pedidos, escopoVendedores),
    [pedidos, escopoVendedores],
  );

  return (
    <Gaveta open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <GavetaConteudo larguraMaxima="sm:max-w-lg">
        <GavetaCabecalho
          titulo="Solicitações"
          descricao={
            fila.length > 0
              ? `${fila.length} pedido(s) esperando sua decisão.`
              : "Nada esperando decisão."
          }
        />
        <GavetaCorpo className="flex flex-col gap-3">
          {fila.length === 0 ? (
            <EstadoVazio
              icone="checkCircle"
              titulo="Fila limpa"
              descricao="Nenhum vendedor está esperando aprovação de ajuste, alteração ou exclusão."
            />
          ) : (
            fila.map(({ pedido, ajuste }) => (
              <CartaoSolicitacao
                key={ajuste.id}
                pedido={pedido}
                ajuste={ajuste}
                aoAbrirPedido={aoAbrirPedido}
              />
            ))
          )}
        </GavetaCorpo>
      </GavetaConteudo>
    </Gaveta>
  );
}
