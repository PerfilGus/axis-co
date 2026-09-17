import type { BonusNivel, Colaborador, Nivel, Pedido } from "@/lib/types";
import type { NomeIcone } from "@/components/icone";
import type { ChaveContador } from "@/lib/nav";
import { filaAutorizacao, filaCobranca, noEscopo } from "@/lib/filas";

/**
 * Contadores das subabas e do sino. Recebem a lista de pedidos da sessão, para
 * refletirem na hora o que acabou de ser autorizado, cancelado ou pago, e
 * usam as mesmas filas das telas — o número bate com o que a tela abre.
 */
export function contadores(
  pedidos: Pedido[],
  escopoVendedores: string[] | null,
): Record<ChaveContador, number> {
  return {
    autorizacoes: filaAutorizacao(pedidos, escopoVendedores).length,
    cobrancas: filaCobranca(pedidos, escopoVendedores).length,
    ajustes: noEscopo(pedidos, escopoVendedores)
      .flatMap((p) => p.ajustes)
      .filter((a) => a.status === "pendente").length,
  };
}

export interface Pendencia {
  chave: string;
  icone: NomeIcone;
  texto: string;
  href?: string;
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/**
 * O que está esperando uma ação de quem está logado. Não é notificação — não
 * se marca como lida: some quando a fila anda. Fica no topo do sino.
 */
export function pendenciasDe(
  usuario: Colaborador,
  pedidos: Pedido[],
  escopoVendedores: string[] | null,
  equipe: { niveis: Nivel[]; bonusNivel: BonusNivel[] },
): Pendencia[] {
  const c = contadores(pedidos, escopoVendedores);
  const lista: Pendencia[] = [];
  if (usuario.perfil === "admin") {
    if (c.autorizacoes > 0) {
      lista.push({ chave: "autorizacoes", icone: "autorizar", texto: `${plural(c.autorizacoes, "envio esperando", "envios esperando")} autorização`, href: "/operacao/autorizar" });
    }
    if (c.ajustes > 0) {
      lista.push({ chave: "ajustes", icone: "lista", texto: `${plural(c.ajustes, "solicitação esperando", "solicitações esperando")} sua decisão`, href: "/operacao/pedidos" });
    }
    return lista;
  }
  if (usuario.perfil === "cobrador") {
    if (c.cobrancas > 0) {
      lista.push({ chave: "cobranca", icone: "cobranca", texto: `${plural(c.cobrancas, "pedido esperando", "pedidos esperando")} cobrança`, href: "/operacao/cobranca" });
    }
  } else {
    const meus = noEscopo(pedidos, escopoVendedores)
      .flatMap((p) => p.ajustes)
      .filter((a) => a.status === "pendente" && a.solicitadoPor === usuario.id).length;
    if (meus > 0) {
      lista.push({ chave: "ajustes", icone: "relogio", texto: `${plural(meus, "pedido de ajuste esperando", "pedidos de ajuste esperando")} o Admin`, href: "/operacao/pedidos" });
    }
  }
  for (const b of equipe.bonusNivel) {
    if (b.colaboradorId !== usuario.id || b.status !== "liberado") continue;
    lista.push({
      chave: b.id,
      icone: "pix",
      texto: `Bônus de ${equipe.niveis.find((n) => n.id === b.nivelId)?.nome ?? "nível"} liberado, aguardando o Pix`,
    });
  }
  return lista;
}
