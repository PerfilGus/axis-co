"use client";

import { cn } from "@/lib/utils";
import type { Pedido } from "@/lib/types";
import {
  formatBRL,
  formatCEP,
  formatDataHoraCurta,
  formatDataHoraEvento,
  formatHa,
  formatTelefone,
} from "@/lib/format";
import { corComOpacidade, coresRastreio, STATUS_RASTREIO } from "@/lib/status";
import { atualizacaoDe } from "@/lib/rastreio/lista";
import { potesDoPedido } from "@/lib/fornecedor";
import { useCadastros } from "@/lib/providers/cadastros";
import { BotaoRevelar, useDadosSensiveis } from "@/components/pedido/dado-sensivel";
import { resumoParaCliente } from "@/lib/rastreio/resumo";
import { Icone } from "@/components/icone";
import { Botao } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

type PedidoRastreado = Pedido & { rastreio: NonNullable<Pedido["rastreio"]> };

function Campo({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="shrink-0 text-[12px] text-muted-fg">{rotulo}</span>
      <span className="text-right text-[13px]">{valor}</span>
    </div>
  );
}

/**
 * Painel de detalhe do rastreio, portado do `renderPanel()` do axis-tracking
 * (INVENTARIO.md §7). Coluna à direita, com a lista sempre visível ao lado —
 * não é navegação entre telas.
 */
export function PainelRastreio({
  pedido,
  aoFechar,
  aoArquivar,
}: {
  pedido: PedidoRastreado;
  aoFechar: () => void;
  aoArquivar: () => void;
}) {
  const { rastreio } = pedido;
  const def = STATUS_RASTREIO[rastreio.status];
  const { base, texto } = coresRastreio(rastreio.status);
  const endereco = pedido.cliente.endereco;
  const { kits } = useCadastros();
  const sensiveis = useDadosSensiveis(pedido.id);
  const potes = potesDoPedido(pedido, kits);

  function copiar() {
    const resumo = resumoParaCliente(pedido);
    navigator.clipboard
      ?.writeText(resumo)
      .then(() => toast.success("Resumo copiado"))
      .catch(() => toast.error("Não foi possível copiar"));
  }

  return (
    <aside className="flex max-h-[calc(100dvh-7rem)] flex-col overflow-y-auto rounded-[var(--radius-card)] border border-border bg-surface-1 p-5 lg:sticky lg:top-24">
      <div className="flex items-start gap-3">
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-input)]"
          style={{ backgroundColor: corComOpacidade(base, 0.18), color: texto }}
        >
          <Icone nome="pedidos" size={18} />
        </span>
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="truncate font-mono text-[17px] font-medium tracking-tight">
            {rastreio.codigo}
          </span>
          <Botao
            variante="fantasma"
            tamanho="iconeSm"
            onClick={copiar}
            title="Copiar resumo para o cliente"
            aria-label="Copiar resumo para o cliente"
          >
            <Icone nome="copiar" size={15} />
          </Botao>
        </div>
        <Botao
          variante="fantasma"
          tamanho="iconeSm"
          onClick={aoFechar}
          aria-label="Fechar painel"
        >
          <Icone nome="fechar" size={15} />
        </Botao>
      </div>

      <div className="mt-3 flex items-center gap-2 text-[12px] text-muted-fg">
        <Icone nome="rastreio" size={14} />
        Correios · {rastreio.servico}
      </div>

      <div className="mt-4 divide-y divide-border border-y border-border">
        <Campo rotulo="Cliente" valor={pedido.cliente.nome || "—"} />
        <Campo
          rotulo="Telefone"
          valor={
            <span className="flex items-center justify-end gap-1">
              <span className="tabular">
                {formatTelefone(sensiveis.dados?.telefone ?? pedido.cliente.telefone) || "—"}
              </span>
              {!sensiveis.dados && (
                <BotaoRevelar carregando={sensiveis.carregando} aoRevelar={sensiveis.revelar} />
              )}
            </span>
          }
        />
        <Campo
          rotulo="Endereço"
          valor={
            endereco.logradouro || endereco.cidade ? (
              <span className="block max-w-56">
                {endereco.logradouro}, {endereco.numero}
                <br />
                {endereco.bairro} - {endereco.cidade}/{endereco.uf}
                <br />
                CEP {formatCEP(endereco.cep)}
              </span>
            ) : (
              "Endereço não informado"
            )
          }
        />
        <Campo rotulo="Potes" valor={potes ? `${potes} potes` : "—"} />
        <Campo
          rotulo="Valor do pedido"
          valor={<span className="tabular">{formatBRL(pedido.valorTotal)}</span>}
        />
        <Campo
          rotulo="Data do pedido"
          valor={
            <span className="tabular">{formatDataHoraCurta(pedido.criadoEm)}</span>
          }
        />
      </div>

      <div
        className="mt-4 rounded-[var(--radius-card-sm)] border p-4"
        style={{
          backgroundColor: corComOpacidade(base, 0.08),
          borderColor: corComOpacidade(base, 0.35),
        }}
      >
        <div className="flex items-center gap-2" style={{ color: texto }}>
          <Icone nome={def.icone} size={16} />
          <span className="text-[15px] font-medium text-fg">{def.rotulo}</span>
        </div>
        <p className="mt-1 text-[12px] text-muted-fg">
          Última atualização: {formatHa(atualizacaoDe(pedido))}
        </p>
      </div>

      {/* Bloco condicional: só falha e aguardando retirada têm o quê dizer. */}
      {rastreio.status === "falha" && (
        <div
          className="mt-3 rounded-[var(--radius-card-sm)] border p-4"
          style={{
            backgroundColor: corComOpacidade(base, 0.08),
            borderColor: corComOpacidade(base, 0.35),
          }}
        >
          <div
            className="flex items-center gap-2 text-[12px] font-medium"
            style={{ color: texto }}
          >
            <Icone nome="alerta" size={14} />
            Motivo da falha
          </div>
          {/* A informação mais fácil de achar na tela inteira. */}
          <p className="mt-1.5 text-[17px] leading-snug font-medium">
            {rastreio.motivoFalha || "Não informado"}
          </p>
        </div>
      )}

      {rastreio.status === "aguardando_retirada" && (
        <div
          className="mt-3 rounded-[var(--radius-card-sm)] border p-4"
          style={{
            backgroundColor: corComOpacidade(base, 0.08),
            borderColor: corComOpacidade(base, 0.35),
          }}
        >
          <div
            className="flex items-center gap-2 text-[12px] font-medium"
            style={{ color: texto }}
          >
            <Icone nome="local" size={14} />
            Endereço para retirada
          </div>
          {rastreio.retirada ? (
            <>
              <p className="mt-1.5 text-[15px] leading-snug font-medium">
                {rastreio.retirada.agencia}
              </p>
              <p className="mt-0.5 text-[13px] text-muted-fg">
                {rastreio.retirada.endereco}
              </p>
              <p className="mt-1.5 text-[12px] text-muted-fg">
                Disponível desde{" "}
                {formatDataHoraCurta(rastreio.retirada.disponivelDesde)}
                {rastreio.retirada.prazo &&
                  ` · Retirar até ${new Date(rastreio.retirada.prazo).toLocaleDateString("pt-BR")}`}
              </p>
            </>
          ) : (
            <p className="mt-1.5 text-[13px] text-muted-fg">
              Carregando endereço da agência na próxima atualização
            </p>
          )}
        </div>
      )}

      <h3 className="mt-6 mb-3 text-[12px] font-medium text-muted-fg">
        Histórico de eventos
      </h3>

      {rastreio.eventos.length > 0 ? (
        <ol className="flex flex-col">
          {rastreio.eventos.map((evento, i) => {
            const cores = coresRastreio(evento.status);
            const ultimo = i === rastreio.eventos.length - 1;
            return (
              <li key={evento.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className="flex size-6 shrink-0 items-center justify-center rounded-full border"
                    style={{
                      borderColor: corComOpacidade(cores.base, 0.5),
                      color: cores.texto,
                    }}
                  >
                    <Icone
                      nome={STATUS_RASTREIO[evento.status].icone}
                      size={12}
                    />
                  </span>
                  {!ultimo && <span className="w-px flex-1 bg-border" aria-hidden />}
                </div>
                <div className={cn("flex flex-1 flex-col gap-0.5", !ultimo && "pb-4")}>
                  <div className="flex items-center justify-between gap-2 text-[11px] text-muted-fg">
                    <span className="tabular">
                      {formatDataHoraEvento(evento.ocorridoEm)}
                    </span>
                    <span>
                      {evento.cidade}/{evento.uf}
                    </span>
                  </div>
                  <p className="text-[13px] font-medium">{evento.titulo}</p>
                  {evento.detalhe && (
                    <p className="text-[12px] text-muted-fg">{evento.detalhe}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="rounded-[var(--radius-card-sm)] border border-dashed border-border px-4 py-6 text-center text-[13px] text-muted-fg">
          Sem eventos de rastreio ainda.
          <br />
          Use &quot;Atualizar rastreios&quot; quando o objeto for postado.
        </p>
      )}

      {/* Arquivar por engano custa dinheiro: perde-se o acompanhamento de um
          pedido que ainda pode precisar de cobrança. Por isso o botão fica
          vermelho no hover. Desarquivar não tem risco e não recebe o alerta. */}
      <button
        onClick={aoArquivar}
        className={cn(
          "mt-6 flex w-full items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-[13px] font-medium transition-colors",
          rastreio.arquivado
            ? "border-border text-fg hover:bg-surface-3"
            : "border-border text-fg hover:border-[var(--st-vermelho-fg)] hover:bg-[var(--st-vermelho-bg)] hover:text-[var(--st-vermelho-fg)]",
        )}
      >
        <Icone nome={rastreio.arquivado ? "desarquivar" : "arquivar"} size={15} />
        {rastreio.arquivado ? "Desarquivar" : "Arquivar"}
      </button>
    </aside>
  );
}
