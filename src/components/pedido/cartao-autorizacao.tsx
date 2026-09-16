"use client";

import { cn } from "@/lib/utils";
import type { Pedido } from "@/lib/types";
import { formatBRL, formatData } from "@/lib/format";
import { checklistAutorizacao, podeAutorizar } from "@/lib/checklist";
import { nomeColaborador } from "@/lib/mock/equipe";
import { rotuloCriativo } from "@/lib/mock/marketing";
import { Icone } from "@/components/icone";
import { Botao } from "@/components/ui/button";
import { Caixa } from "@/components/ui/checkbox";
import { SeloStatusPedido } from "@/components/shared/selo-status";

/**
 * Um pedido na fila de autorização, com a checagem aberta.
 *
 * Pedido com item pendente mostra o motivo e não pode ser autorizado — nem
 * pelo botão do cartão, nem pela seleção em lote.
 */
export function CartaoAutorizacao({
  pedido,
  selecionado,
  aoSelecionar,
  aoAutorizar,
  aoCancelar,
  aoAbrir,
}: {
  pedido: Pedido;
  selecionado: boolean;
  aoSelecionar: (selecionado: boolean) => void;
  aoAutorizar: () => void;
  aoCancelar: () => void;
  aoAbrir: () => void;
}) {
  const itens = checklistAutorizacao(pedido);
  const liberado = podeAutorizar(pedido);
  const pendencias = itens.filter((i) => !i.ok);

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-[var(--radius-card)] border bg-surface-1 p-5 transition-colors",
        selecionado ? "border-[var(--accent)]" : "border-border",
      )}
    >
      <div className="flex flex-wrap items-start gap-4">
        <Caixa
          checked={selecionado}
          onCheckedChange={(v) => aoSelecionar(v === true)}
          disabled={!liberado}
          aria-label={`Selecionar ${pedido.codigo}`}
          className="mt-1"
        />

        <div className="flex min-w-48 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={aoAbrir}
              className="tabular text-[15px] font-medium underline-offset-4 hover:underline"
            >
              {pedido.codigo}
            </button>
            <SeloStatusPedido status={pedido.status} />
          </div>
          <span className="text-[13px]">{pedido.cliente.nome}</span>
          <span className="text-[11px] text-muted-fg">
            {pedido.cliente.endereco.cidade}/{pedido.cliente.endereco.uf} ·{" "}
            {pedido.itens[0]?.kitNome} · {rotuloCriativo(pedido.criativoId)}
          </span>
          <span className="text-[11px] text-muted-fg/80">
            {nomeColaborador(pedido.vendedorId)} · agendado em{" "}
            {formatData(pedido.criadoEm)}
          </span>
        </div>

        <div className="flex flex-col items-end gap-1">
          <span className="tabular text-lg font-medium">
            {formatBRL(pedido.valorTotal)}
          </span>
          <span className="tabular text-[11px] text-muted-fg">
            + {formatBRL(pedido.frete)} de frete
          </span>
        </div>
      </div>

      <ul className="grid gap-2 sm:grid-cols-2">
        {itens.map((item) => (
          <li key={item.chave} className="flex items-start gap-2">
            <span
              className="mt-0.5 shrink-0"
              style={{
                color: item.ok ? "var(--st-verde-fg)" : "var(--st-vermelho-fg)",
              }}
            >
              <Icone nome={item.ok ? "checkCircle" : "alerta"} size={15} />
            </span>
            <span className="flex flex-col">
              <span
                className={cn(
                  "text-[13px]",
                  item.ok ? "text-muted-fg" : "text-fg",
                )}
              >
                {item.rotulo}
              </span>
              {item.motivo && (
                <span className="text-[11px] leading-snug text-[var(--st-vermelho-fg)]">
                  {item.motivo}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <Botao
          variante="principal"
          tamanho="sm"
          onClick={aoAutorizar}
          disabled={!liberado}
          title={
            liberado
              ? undefined
              : `Resolva a pendência antes: ${pendencias[0]?.rotulo}`
          }
        >
          <Icone nome="autorizar" size={14} />
          Autorizar envio
        </Botao>
        <Botao variante="secundaria" tamanho="sm" onClick={aoCancelar}>
          <Icone nome="proibido" size={14} />
          Cancelar
        </Botao>
        <Botao variante="fantasma" tamanho="sm" onClick={aoAbrir}>
          <Icone nome="ver" size={14} />
          Ver pedido
        </Botao>
        {!liberado && (
          <span className="ml-auto text-[11px] text-muted-fg">
            {pendencias.length} pendência{pendencias.length > 1 ? "s" : ""} para
            resolver.
          </span>
        )}
      </div>
    </div>
  );
}
