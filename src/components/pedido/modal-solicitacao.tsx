"use client";

import { useState } from "react";
import type { Pedido } from "@/lib/types";
import { formatBRL, parseBRL } from "@/lib/format";
import { usePedidos } from "@/lib/providers/pedidos";
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
import { AvisoSaude } from "@/components/shared/aviso-saude";
import { ControleSegmentado } from "@/components/shared/controles";
import { toast } from "@/components/ui/toast";

type TipoSolicitacao = "alteracao_cadastral" | "desconto" | "exclusao";

const DESCRICAO: Record<TipoSolicitacao, string> = {
  alteracao_cadastral:
    "Correção de endereço, telefone ou kit. O Admin aplica a mudança.",
  desconto: "Mudança no valor do pedido. O Admin aprova ou recusa.",
  exclusao: "Pedido duplicado ou desistência. O Admin decide se apaga.",
};

/**
 * Pedido de alteração do vendedor.
 *
 * O vendedor nunca edita nem exclui um pedido: ele descreve o que precisa e o
 * Admin resolve na fila de solicitações.
 */
export function ModalSolicitacao({
  pedido,
  aberto,
  aoFechar,
}: {
  pedido: Pedido;
  aberto: boolean;
  aoFechar: () => void;
}) {
  const { solicitarAjuste } = usePedidos();
  const [tipo, setTipo] = useState<TipoSolicitacao>("alteracao_cadastral");
  const [motivo, setMotivo] = useState("");
  const [valor, setValor] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const valorCentavos = parseBRL(valor);

  async function enviar() {
    if (motivo.trim().length < 5) {
      setErro("Explique o que precisa mudar: é o que o Admin vai ler.");
      return;
    }
    if (tipo === "desconto" && (!valorCentavos || valorCentavos <= 0)) {
      setErro("Informe o valor que o pedido deve passar a ter.");
      return;
    }

    const enviado = await solicitarAjuste(pedido.id, {
      tipo,
      valorSolicitado: tipo === "desconto" ? valorCentavos! : pedido.valorTotal,
      motivo: motivo.trim(),
    });
    if (!enviado) return;

    toast.success("Solicitação enviada ao Admin", {
      description: `O pedido ${pedido.codigo} fica marcado até a decisão.`,
    });
    setMotivo("");
    setValor("");
    setErro(null);
    aoFechar();
  }

  return (
    <Modal open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <ModalConteudo larguraMaxima="max-w-xl">
        <ModalCabecalho
          titulo="Solicitar alteração"
          descricao={`Pedido ${pedido.codigo}, de ${pedido.cliente.nome}.`}
        />

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <ControleSegmentado
              tamanho="sm"
              valor={tipo}
              aoMudar={(v) => {
                setTipo(v);
                setErro(null);
              }}
              opcoes={[
                { valor: "alteracao_cadastral", rotulo: "Alterar dados", icone: "editar" },
                { valor: "desconto", rotulo: "Mudar valor", icone: "percentual" },
                { valor: "exclusao", rotulo: "Excluir", icone: "excluir" },
              ]}
            />
            <p className="text-[13px] text-muted-fg">{DESCRICAO[tipo]}</p>
          </div>

          {tipo === "desconto" && (
            <Campo
              rotulo="Novo valor do pedido"
              obrigatorio
              ajuda={`Hoje está em ${formatBRL(pedido.valorTotal)}.`}
            >
              <Input
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="257,00"
                inputMode="decimal"
              />
            </Campo>
          )}

          <Campo rotulo="Motivo" obrigatorio erro={erro}>
            <Textarea
              value={motivo}
              onChange={(e) => {
                setMotivo(e.target.value);
                setErro(null);
              }}
              placeholder="Cliente passou o número do endereço errado: é 482, não 428."
            />
          </Campo>
          <AvisoSaude />
        </div>

        <ModalRodape>
          <Botao variante="secundaria" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao variante="principal" onClick={enviar}>
            <Icone nome="check" size={16} />
            Enviar solicitação
          </Botao>
        </ModalRodape>
      </ModalConteudo>
    </Modal>
  );
}
