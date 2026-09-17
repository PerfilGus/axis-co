import type { StatusRastreio } from "@/lib/types";

/**
 * Mapa evento SRO → status, portado de `mapEventType()` em
 * `referencia/axis-tracking/lib/correios.js`.
 *
 * A ordem das checagens é parte da regra e não pode ser reorganizada:
 *
 * - `FC` significa coisas opostas conforme o tipo: `82` é "Etiqueta emitida"
 *   (o objeto nem saiu do remetente), `03` é correção de rota (já viajando).
 * - "Objeto não entregue - cliente desconhecido no local" **contém**
 *   "entregue". A negação é checada antes de qualquer teste de entrega, senão
 *   um insucesso real aparece como entregue e some da seção de falhas.
 *
 * Aqui a função ainda não tem quem a chame — a consulta real entra com a
 * integração dos Correios. Está portada para a regra não se perder no caminho.
 */
export interface EventoSRO {
  codigo?: string;
  tipo?: string;
  descricao?: string;
}

export function statusDoEventoSRO(ev: EventoSRO): StatusRastreio {
  const codigo = String(ev.codigo ?? "").toUpperCase();
  const tipo = String(ev.tipo ?? "");
  const desc = String(ev.descricao ?? "").toLowerCase();

  if (codigo === "FC") {
    return tipo === "82" ? "aguardando_postagem" : "em_transferencia";
  }

  if (desc.includes("não entregue") || desc.includes("nao entregue")) {
    return "falha";
  }

  // BDE/BDI/BDR são a baixa de entrega: tipo 01 deu certo, o resto é insucesso.
  if (codigo === "BDE" || codigo === "BDI" || codigo === "BDR") {
    return tipo === "01" || desc.includes("entregue") ? "entregue" : "falha";
  }
  if (
    codigo === "OEC" ||
    desc.includes("rota de entrega") ||
    desc.includes("saiu para entrega")
  ) {
    return "saiu_para_entrega";
  }
  if (
    codigo === "LDI" ||
    desc.includes("aguardando retirada") ||
    desc.includes("disponível para retirada")
  ) {
    return "aguardando_retirada";
  }
  if (codigo === "PO" || codigo === "PA" || desc.includes("postado")) {
    return "postado";
  }
  if (
    codigo === "RO" ||
    codigo === "DO" ||
    codigo === "RC" ||
    desc.includes("transferência") ||
    desc.includes("encaminhado")
  ) {
    return "em_transferencia";
  }
  // "endereço" sozinho era amplo demais aqui — casava com a retirada em agência.
  if (
    desc.includes("não efetuada") ||
    desc.includes("tentativa de entrega") ||
    desc.includes("recusado") ||
    desc.includes("ausente") ||
    desc.includes("endereço incorreto") ||
    desc.includes("endereço insuficiente") ||
    desc.includes("extraviado") ||
    desc.includes("avariado")
  ) {
    return "falha";
  }
  return "em_transferencia";
}

/**
 * Motivo do insucesso, portado de `failureReasonOf()`.
 *
 * O motivo vem no próprio título ("Objeto não entregue - endereço
 * insuficiente"); o detalhe costuma ser a consequência ("Objeto será devolvido
 * ao remetente"), não o porquê.
 */
export function motivoDaFalha(titulo: string, detalhe?: string | null): string {
  const i = titulo.indexOf(" - ");
  if (i === -1) return detalhe || titulo;
  const motivo = titulo.slice(i + 3).trim();
  if (!motivo) return detalhe || titulo;
  return motivo.charAt(0).toUpperCase() + motivo.slice(1);
}

const MINUSCULAS = new Set(["de", "da", "do", "das", "dos", "e"]);

/**
 * `"ADEILDO JOSE DA SILVA"` → `"Adeildo Jose da Silva"`.
 *
 * O SRO manda tudo em caixa alta e a cópia vai para o WhatsApp do cliente.
 * Portado de `titleCase()` / `nameCase()`.
 */
export function nomeProprio(texto: string): string {
  return String(texto || "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((palavra, i) =>
      i && MINUSCULAS.has(palavra)
        ? palavra
        : palavra.charAt(0).toUpperCase() + palavra.slice(1),
    )
    .join(" ");
}
