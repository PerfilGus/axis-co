import type { Kit, Pedido } from "@/lib/types";
import { formatCEP, formatDataHoraCurta, formatHa } from "@/lib/format";
import { STATUS_RASTREIO } from "@/lib/status";
import { potesDoPedido } from "@/lib/fornecedor";
import { atualizacaoDe, enderecoCompleto } from "./lista";
import type { AbaRastreio } from "./lista";

type PedidoRastreado = Pedido & { rastreio: NonNullable<Pedido["rastreio"]> };

/** As doze colunas do axis-tracking, na mesma ordem. */
const COLUNAS = [
  "codigo",
  "nome",
  "telefone",
  "endereco",
  "cep",
  "potes",
  "valor",
  "status",
  "motivo_falha",
  "endereco_retirada",
  "data_pedido",
  "ultima_atualizacao",
] as const;

function celula(valor: unknown): string {
  return `"${String(valor ?? "").replace(/"/g, '""')}"`;
}

/**
 * Exporta os pedidos visíveis, respeitando aba e filtro.
 * Portado de `exportCsv()`: separador `;` e BOM UTF-8, para o Excel pt-BR
 * abrir sem embaralhar acento nem juntar tudo numa coluna.
 */
export function montarCsv(lista: PedidoRastreado[], kits: Kit[]): Blob {
  const linhas = lista.map((p) =>
    [
      p.rastreio.codigo,
      p.cliente.nome,
      p.cliente.telefone,
      enderecoCompleto(p),
      p.cliente.endereco.cep ? formatCEP(p.cliente.endereco.cep) : "",
      potesDoPedido(p, kits) || "",
      (p.valorTotal / 100).toFixed(2),
      STATUS_RASTREIO[p.rastreio.status].rotulo,
      p.rastreio.motivoFalha ?? "",
      p.rastreio.retirada?.endereco ?? "",
      formatDataHoraCurta(p.criadoEm),
      formatHa(atualizacaoDe(p)),
    ].map(celula).join(";"),
  );

  const csv = [COLUNAS.join(";"), ...linhas].join("\n");
  return new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
}

export function baixarCsv(lista: PedidoRastreado[], aba: AbaRastreio, kits: Kit[]): void {
  const url = URL.createObjectURL(montarCsv(lista, kits));
  const a = document.createElement("a");
  a.href = url;
  a.download = `axis-rastreio_${aba}_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
