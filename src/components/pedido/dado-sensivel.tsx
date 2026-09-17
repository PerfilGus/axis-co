"use client";

import { useState } from "react";
import type { ID } from "@/lib/types";
import type { DadosSensiveis } from "@/app/acoes/pedidos";
import { usePedidos } from "@/lib/providers/pedidos";
import { Icone } from "@/components/icone";
import { Botao } from "@/components/ui/button";

/**
 * CPF e telefone completos sob demanda. A lista sempre recebe o dado
 * mascarado; o completo só vem ao tocar aqui, e cada abertura fica registrada.
 */
export function useDadosSensiveis(pedidoId: ID) {
  const { revelarDados } = usePedidos();
  const [dados, setDados] = useState<DadosSensiveis | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function revelar() {
    setCarregando(true);
    const resposta = await revelarDados([pedidoId]);
    setCarregando(false);
    if (resposta?.[0]) setDados(resposta[0]);
  }

  // Trocou de pedido: o que foi revelado era de outro cliente.
  const atuais = dados?.pedidoId === pedidoId ? dados : null;
  return { dados: atuais, carregando, revelar };
}

export function BotaoRevelar({
  carregando,
  aoRevelar,
}: {
  carregando: boolean;
  aoRevelar: () => void;
}) {
  return (
    <Botao variante="fantasma" tamanho="sm" onClick={aoRevelar} disabled={carregando}>
      <Icone nome="ver" size={14} />
      {carregando ? "Abrindo…" : "Ver dados completos"}
    </Botao>
  );
}
