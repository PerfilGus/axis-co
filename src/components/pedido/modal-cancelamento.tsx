"use client";

import { useState } from "react";
import type { Pedido } from "@/lib/types";
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
import { Textarea } from "@/components/ui/input";
import { AvisoSaude } from "@/components/shared/aviso-saude";
import { toast } from "@/components/ui/toast";

const SUGESTOES = [
  "Cliente desistiu antes do envio.",
  "Endereço não confere e o cliente não responde.",
  "Pedido duplicado.",
  "Telefone errado no cadastro.",
];

/**
 * Cancelamento com motivo. Antes de autorizar o custo é zero: o pedido só
 * conta como frustrado na taxa do vendedor.
 */
export function ModalCancelamento({
  pedidos,
  aberto,
  aoFechar,
}: {
  pedidos: Pedido[];
  aberto: boolean;
  aoFechar: () => void;
}) {
  const { cancelar } = usePedidos();
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const varios = pedidos.length > 1;

  async function confirmar() {
    if (motivo.trim().length < 5) {
      setErro("O motivo fica registrado na linha do tempo. Escreva o que houve.");
      return;
    }
    const total = await cancelar(
      pedidos.map((p) => p.id),
      motivo.trim(),
    );
    if (total === null) return;
    toast(
      total === 1 ? "Pedido cancelado" : `${total} pedidos cancelados`,
      { description: "Custo zero: nada chegou a ser enviado." },
    );
    setMotivo("");
    setErro(null);
    aoFechar();
  }

  return (
    <Modal open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <ModalConteudo larguraMaxima="max-w-lg">
        <ModalCabecalho
          titulo={varios ? `Cancelar ${pedidos.length} pedidos` : "Cancelar pedido"}
          descricao={
            varios
              ? "O mesmo motivo vale para todos os selecionados."
              : pedidos[0]
                ? `${pedidos[0].codigo}, de ${pedidos[0].cliente.nome}.`
                : ""
          }
        />

        <div className="flex flex-col gap-4">
          <Campo rotulo="Motivo" obrigatorio erro={erro}>
            <Textarea
              value={motivo}
              onChange={(e) => {
                setMotivo(e.target.value);
                setErro(null);
              }}
              placeholder="Cliente desistiu antes do envio."
            />
          </Campo>
          <AvisoSaude />

          <div className="flex flex-wrap gap-2">
            {SUGESTOES.map((sugestao) => (
              <Botao
                key={sugestao}
                variante="contorno"
                tamanho="sm"
                onClick={() => {
                  setMotivo(sugestao);
                  setErro(null);
                }}
              >
                {sugestao}
              </Botao>
            ))}
          </div>
        </div>

        <ModalRodape>
          <Botao variante="secundaria" onClick={aoFechar}>
            Voltar
          </Botao>
          <Botao variante="perigo" onClick={confirmar}>
            <Icone nome="proibido" size={15} />
            Cancelar {varios ? "pedidos" : "pedido"}
          </Botao>
        </ModalRodape>
      </ModalConteudo>
    </Modal>
  );
}
