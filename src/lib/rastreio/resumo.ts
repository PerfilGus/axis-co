import type { Pedido } from "@/lib/types";
import { momentoDoEvento } from "@/lib/types/rastreio";
import { STATUS_RASTREIO } from "@/lib/status";
import { nomeProprio } from "./correios";
import { atualizacaoDe } from "./lista";

type PedidoRastreado = Pedido & { rastreio: NonNullable<Pedido["rastreio"]> };

/** `dd/mm/aaaa hh:mm` — o formato absoluto que vai na mensagem. */
function dataHora(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function soData(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
}

/**
 * Cópia inteligente — portada de `copySummary()` do axis-tracking.
 *
 * O botão ao lado do código não copia só o código: monta a mensagem pronta para
 * colar no WhatsApp do cliente. Sempre com data e hora absolutas, nunca
 * "há 3h" — a mensagem envelhece no instante em que é enviada.
 */
export function resumoParaCliente(pedido: PedidoRastreado): string {
  const rastreio = pedido.rastreio;
  const def = STATUS_RASTREIO[rastreio.status];
  const codigo = rastreio.codigo;
  const linhas: string[] = [];

  if (rastreio.status === "aguardando_retirada") {
    // A mais importante: sem agência e prazo o cliente não busca e o pedido
    // volta para o remetente.
    const retirada = rastreio.retirada;
    const primeiroNome = nomeProprio(pedido.cliente.nome).split(" ")[0] || "tudo bem";
    linhas.push(
      `Olá, ${primeiroNome}!`,
      "Seu pedido está disponível para retirada nos Correios.",
      "",
      `Destinatário: ${nomeProprio(pedido.cliente.nome) || "—"}`,
      `Código de rastreio: ${codigo}`,
      `Disponível desde: ${dataHora(
        retirada?.disponivelDesde ??
          momentoDoEvento(rastreio, "aguardando_retirada", pedido.criadoEm),
      )}`,
    );
    if (retirada?.prazo) linhas.push(`Retirar até: ${soData(retirada.prazo)}`);
    linhas.push(
      "",
      "Endereço para retirada:",
      retirada
        ? `${retirada.agencia}\n${retirada.endereco}`
        : "Endereço ainda não informado pelos Correios",
      "",
      "Para retirar, informe o código de rastreio e apresente um documento com foto do destinatário (ou de pessoa autorizada por ele).",
    );
  } else if (rastreio.status === "saiu_para_entrega") {
    linhas.push(
      `Código de rastreio: ${codigo}`,
      `Status: ${def.rotulo}`,
      `Saiu para entrega em: ${dataHora(momentoDoEvento(rastreio, "saiu_para_entrega", pedido.criadoEm))}`,
      "",
      "É necessário ter alguém em casa para receber o pedido.",
    );
  } else if (rastreio.status === "entregue") {
    linhas.push(
      `Código de rastreio: ${codigo}`,
      `Status: ${def.rotulo}`,
      `Entregue em: ${dataHora(momentoDoEvento(rastreio, "entregue", pedido.criadoEm))}`,
    );
  } else if (rastreio.status === "falha") {
    linhas.push(
      `Código de rastreio: ${codigo}`,
      `Status: ${def.rotulo}`,
      `Motivo da falha: ${rastreio.motivoFalha || "não informado"}`,
    );
  } else {
    linhas.push(
      `Código de rastreio: ${codigo}`,
      `Status: ${def.rotulo}`,
      `Última atualização: ${dataHora(atualizacaoDe(pedido))}`,
    );
  }

  return linhas.join("\n");
}
