import "server-only";
import { headers } from "next/headers";
import { agoraISO } from "@/lib/iso";
import { db, type Transacao } from "./db";
import { atividades } from "./schema";

/**
 * Tabela única de atividades (regra 8): linha do tempo, notificações e
 * auditoria da LGPD saem daqui. Toda ação do servidor grava pela mesma função,
 * de preferência na mesma transação da mudança.
 */

export interface NovaAtividade {
  /** Por padrão, um uuid novo. */
  id?: string;
  usuarioId: string | null;
  papel: string | null;
  acao: string;
  entidade: string;
  entidadeId?: string | null;
  titulo?: string | null;
  descricao?: string | null;
  antes?: unknown;
  depois?: unknown;
  dados?: Record<string, unknown> | null;
  /** Por padrão, agora. Pagamento, por exemplo, vale na data informada. */
  ocorridoEm?: string;
}

/** IP e navegador, só para eventos de segurança. */
export async function origemDaRequisicao(): Promise<{ ip: string | null; userAgent: string | null }> {
  try {
    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip");
    return { ip: ip ?? null, userAgent: h.get("user-agent") };
  } catch {
    return { ip: null, userAgent: null };
  }
}

function linha(a: NovaAtividade, origem?: { ip: string | null; userAgent: string | null }) {
  return {
    id: a.id ?? crypto.randomUUID(),
    usuarioId: a.usuarioId,
    papel: a.papel,
    acao: a.acao,
    entidade: a.entidade,
    entidadeId: a.entidadeId ?? null,
    ocorridoEm: a.ocorridoEm ?? agoraISO(),
    titulo: a.titulo ?? null,
    descricao: a.descricao ?? null,
    antes: a.antes ?? null,
    depois: a.depois ?? null,
    dados: a.dados ?? null,
    ip: origem?.ip ?? null,
    userAgent: origem?.userAgent ?? null,
  };
}

export async function registrarAtividades(
  lista: NovaAtividade[],
  tx: Transacao | typeof db = db,
): Promise<void> {
  if (lista.length === 0) return;
  await tx.insert(atividades).values(lista.map((a) => linha(a)));
}

/** Evento de segurança: grava também IP e navegador. */
export async function registrarAtividadeSeguranca(a: NovaAtividade): Promise<void> {
  const origem = await origemDaRequisicao();
  await db.insert(atividades).values(linha(a, origem));
}
