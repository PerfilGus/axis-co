import type { Pedido } from "@/lib/types";

/**
 * Checagem que todo pedido precisa passar antes do envio ser autorizado.
 *
 * É a mesma lista usada pela tela de autorização e pela ação de autorizar —
 * não dá para liberar um pedido por outro caminho e furar a conferência.
 */
export interface ItemChecklist {
  chave: "print" | "confirmacao" | "endereco" | "ajuste";
  rotulo: string;
  ok: boolean;
  /** Por que está pendente. Só aparece quando `ok` é falso. */
  motivo: string | null;
}

export function checklistAutorizacao(pedido: Pedido): ItemChecklist[] {
  // Arquivo apagado pela retenção não conta como prova.
  const presentes = pedido.anexos.filter((a) => !a.removidoEm);
  const temPrint = presentes.some((a) => a.tipo === "print_confirmacao");
  const temAudio = presentes.some((a) => a.tipo === "audio_confirmacao");
  const ajustePendente = pedido.ajustes.find(
    (a) =>
      a.status === "pendente" && (a.tipo === "desconto" || a.tipo === "acrescimo"),
  );

  return [
    {
      chave: "print",
      rotulo: "Print da confirmação",
      ok: temPrint,
      motivo: temPrint ? null : "O vendedor não anexou o print da conversa.",
    },
    {
      chave: "confirmacao",
      rotulo: pedido.confirmacaoPorTexto
        ? "Confirmado por texto"
        : "Áudio de confirmação",
      ok: pedido.confirmacaoPorTexto || temAudio,
      motivo:
        pedido.confirmacaoPorTexto || temAudio
          ? null
          : "Falta o áudio, e o pedido não está marcado como confirmado por texto.",
    },
    {
      chave: "endereco",
      rotulo: "Endereço validado",
      ok: pedido.enderecoValidado,
      motivo: pedido.enderecoValidado
        ? null
        : "Endereço ainda não conferido com o cliente.",
    },
    {
      chave: "ajuste",
      rotulo: "Ajuste de valor resolvido",
      ok: !ajustePendente,
      motivo: ajustePendente
        ? `Ajuste de valor aguardando decisão do Admin: ${ajustePendente.motivo}`
        : null,
    },
  ];
}

export function pendenciasDe(pedido: Pedido): ItemChecklist[] {
  return checklistAutorizacao(pedido).filter((item) => !item.ok);
}

export function podeAutorizar(pedido: Pedido): boolean {
  return pendenciasDe(pedido).length === 0;
}
