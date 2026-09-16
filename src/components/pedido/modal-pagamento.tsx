"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { FormaPagamento, Pedido } from "@/lib/types";
import { formatBRL, parseBRL } from "@/lib/format";
import { deCampoData, paraCampoData } from "@/lib/datas";
import {
  explicacaoTaxa,
  FORMAS_PAGAMENTO,
  taxaEstimada,
  valorLiquido,
} from "@/lib/taxas";
import { useSessao } from "@/lib/providers/sessao";
import { usePedidos } from "@/lib/providers/pedidos";
import { BANCOS_PLATAFORMAS } from "@/lib/mock/financeiro";
import { Icone } from "@/components/icone";
import { Botao } from "@/components/ui/button";
import {
  Modal,
  ModalCabecalho,
  ModalConteudo,
  ModalRodape,
} from "@/components/ui/dialog";
import { Campo } from "@/components/ui/label";
import { Input, Textarea } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";

type Forma = Exclude<FormaPagamento, "nao_definido">;

/**
 * Registro de pagamento.
 *
 * A taxa estimada aparece antes de confirmar: o cobrador precisa ver quanto
 * sobra de verdade em cada forma antes de escolher onde receber.
 */
export function ModalPagamento({
  pedido,
  aberto,
  aoFechar,
}: {
  pedido: Pedido | null;
  aberto: boolean;
  aoFechar: () => void;
}) {
  if (!pedido) return null;
  // A `key` zera o formulário a cada pedido, sem efeito de sincronização.
  return (
    <Formulario
      key={pedido.id}
      pedido={pedido}
      aberto={aberto}
      aoFechar={aoFechar}
    />
  );
}

function Formulario({
  pedido,
  aberto,
  aoFechar,
}: {
  pedido: Pedido;
  aberto: boolean;
  aoFechar: () => void;
}) {
  const { usuario } = useSessao();
  const { registrarPagamento } = usePedidos();

  const esperado = pedido.valorTotal + pedido.frete;
  const [valor, setValor] = useState("");
  const [data, setData] = useState(paraCampoData(new Date()));
  const [forma, setForma] = useState<Forma>("pix");
  const [bancoId, setBancoId] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});

  const recebido = parseBRL(valor) ?? esperado;
  const taxa = bancoId ? taxaEstimada(bancoId, forma, recebido) : 0;
  const liquido = bancoId ? valorLiquido(bancoId, forma, recebido) : recebido;
  const diferenca = recebido - esperado;

  // Link de cartão entra pela plataforma; Pix e boleto caem em conta.
  const bancos = BANCOS_PLATAFORMAS.filter((b) =>
    forma === "link_cartao" ? b.tipo === "plataforma" : b.tipo === "banco",
  );

  function confirmar() {
    const encontrados: Record<string, string> = {};
    const valorCentavos = parseBRL(valor);
    if (!valorCentavos || valorCentavos <= 0) {
      encontrados.valor = "Informe quanto o cliente pagou.";
    }
    if (!bancoId) encontrados.banco = "Escolha onde o dinheiro caiu.";
    if (!data) encontrados.data = "Informe a data do recebimento.";

    setErros(encontrados);
    if (Object.keys(encontrados).length > 0 || valorCentavos === null) return;

    registrarPagamento(
      pedido.id,
      {
        valorRecebido: valorCentavos,
        data: deCampoData(data),
        forma,
        bancoId,
        observacoes: observacoes.trim() || null,
      },
      usuario.id,
    );

    toast.success(`Pagamento de ${pedido.codigo} registrado`, {
      description: `${formatBRL(valorCentavos)} via ${forma === "pix" ? "Pix" : forma === "boleto" ? "boleto" : "link de cartão"}. Taxa estimada de ${formatBRL(taxaEstimada(bancoId, forma, valorCentavos))}.`,
    });

    aoFechar();
  }

  return (
    <Modal open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <ModalConteudo larguraMaxima="max-w-xl">
        <ModalCabecalho
          titulo="Registrar pagamento"
          descricao={`${pedido.codigo}, de ${pedido.cliente.nome}. Esperado: ${formatBRL(esperado)}.`}
        />

        <div className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              rotulo="Valor recebido"
              obrigatorio
              erro={erros.valor}
              ajuda={
                valor && diferenca !== 0
                  ? diferenca > 0
                    ? `${formatBRL(diferenca)} acima do esperado.`
                    : `${formatBRL(-diferenca)} abaixo do esperado.`
                  : undefined
              }
            >
              <Input
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder={(esperado / 100).toFixed(2).replace(".", ",")}
                inputMode="decimal"
              />
            </Campo>

            <Campo rotulo="Data do recebimento" obrigatorio erro={erros.data}>
              <Input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
              />
            </Campo>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-medium text-muted-fg">Forma</span>
            <div className="grid grid-cols-3 gap-2">
              {FORMAS_PAGAMENTO.map((opcao) => {
                const ativo = forma === opcao.valor;
                return (
                  <button
                    key={opcao.valor}
                    onClick={() => {
                      setForma(opcao.valor);
                      setBancoId("");
                    }}
                    aria-pressed={ativo}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-[var(--radius-card-sm)] border p-3 transition-colors",
                      ativo
                        ? "border-[var(--accent)] text-fg"
                        : "border-border text-muted-fg hover:border-border-strong",
                    )}
                  >
                    <Icone
                      nome={opcao.icone}
                      size={18}
                      className={ativo ? "text-[var(--accent)]" : undefined}
                    />
                    <span className="text-[13px] font-medium">{opcao.rotulo}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-medium text-muted-fg">
              Onde caiu<span className="text-[var(--accent)]"> *</span>
            </span>
            <div className="grid gap-2 sm:grid-cols-2">
              {bancos.map((banco) => {
                const ativo = bancoId === banco.id;
                return (
                  <button
                    key={banco.id}
                    onClick={() => setBancoId(banco.id)}
                    aria-pressed={ativo}
                    className={cn(
                      "flex items-center gap-3 rounded-full border px-4 py-2.5 text-left transition-colors",
                      ativo
                        ? "border-[var(--accent)]"
                        : "border-border hover:border-border-strong",
                    )}
                  >
                    <span
                      className="flex size-7 shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: `${banco.cor}22`, color: banco.cor }}
                    >
                      <Icone
                        nome={banco.tipo === "banco" ? "bancos" : "loja"}
                        size={14}
                      />
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-[13px] font-medium">
                        {banco.nome}
                      </span>
                      <span className="text-[11px] text-muted-fg">
                        {banco.taxaBps > 0
                          ? `Taxa de ${(banco.taxaBps / 100).toFixed(2).replace(".", ",")}%`
                          : "Sem taxa percentual"}
                      </span>
                    </span>
                    {ativo && (
                      <Icone
                        nome="checkCircle"
                        size={16}
                        className="ml-auto shrink-0 text-[var(--accent)]"
                      />
                    )}
                  </button>
                );
              })}
            </div>
            {erros.banco && (
              <p className="text-xs text-[var(--st-vermelho-fg)]">{erros.banco}</p>
            )}
          </div>

          {bancoId && (
            <div className="flex flex-col gap-2 rounded-[var(--radius-card-sm)] border border-border bg-surface-2 px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                <span className="text-[13px] text-muted-fg">Taxa estimada</span>
                <span
                  className="tabular text-[13px] font-medium"
                  style={{ color: "var(--st-vermelho-fg)" }}
                >
                  − {formatBRL(taxa)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-[13px] text-muted-fg">Entra líquido</span>
                <span className="tabular text-[15px] font-medium">
                  {formatBRL(liquido)}
                </span>
              </div>
              <p className="text-[11px] text-muted-fg/80">
                {explicacaoTaxa(bancoId, forma)} Vem do cadastro, não do extrato.
              </p>
            </div>
          )}

          <Campo rotulo="Observações">
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Cliente pagou metade agora e o resto na sexta."
              className="min-h-20"
            />
          </Campo>
        </div>

        <ModalRodape>
          <Botao variante="secundaria" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao variante="principal" onClick={confirmar}>
            <Icone nome="check" size={16} />
            Registrar pagamento
          </Botao>
        </ModalRodape>
      </ModalConteudo>
    </Modal>
  );
}
