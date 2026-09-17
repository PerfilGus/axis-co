import "server-only";
import webpush, { WebPushError } from "web-push";
import { eq, inArray } from "drizzle-orm";
import type { Colaborador } from "@/lib/types";
import { agoraISO } from "@/lib/iso";
import { GRUPOS_POR_PERFIL } from "@/lib/nav";
import {
  alcanca,
  hrefDaNotificacao,
  preferenciaDe,
  textoDoPush,
  type Notificacao,
} from "@/lib/notificacoes";
import { db } from "./db";
import * as t from "./schema";
import { consultaAtividades, paraNotificacao, preferenciasDe } from "./notificacoes";

/**
 * Web Push. Quem chama é `registrarAtividades`, depois da resposta (`after`):
 * se a transação que gravou a atividade desfez, a consulta não a encontra e
 * nada é enviado. Sem as chaves VAPID, não faz nada.
 */

export interface MensagemPush {
  titulo: string;
  corpo: string;
  url: string;
  /** Mesma tag substitui o aviso anterior no aparelho, em vez de empilhar. */
  tag: string;
}

/** Mais que isso numa leva (autorizar 20 envios) vira um resumo só. */
const MAXIMO_POR_LEVA = 3;

function configurado(): boolean {
  const publica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privada = process.env.VAPID_PRIVATE_KEY;
  const contato = process.env.VAPID_SUBJECT;
  if (!publica || !privada || !contato) return false;
  webpush.setVapidDetails(contato, publica, privada);
  return true;
}

export const pushConfigurado = () =>
  Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);

/** Envia para todos os aparelhos da pessoa e limpa as inscrições mortas. */
export async function enviarParaUsuario(usuarioId: string, mensagem: MensagemPush): Promise<number> {
  if (!configurado()) return 0;
  const inscricoes = await db.select().from(t.inscricoesPush).where(eq(t.inscricoesPush.usuarioId, usuarioId));
  let entregues = 0;
  const mortas: string[] = [];
  await Promise.all(
    inscricoes.map(async (i) => {
      try {
        await webpush.sendNotification(
          { endpoint: i.endpoint, keys: { p256dh: i.p256dh, auth: i.auth } },
          JSON.stringify(mensagem),
          { TTL: 60 * 60 * 12, urgency: "normal" },
        );
        entregues += 1;
      } catch (erro) {
        // 404/410: o aparelho desinstalou o app ou revogou a permissão.
        if (erro instanceof WebPushError && (erro.statusCode === 404 || erro.statusCode === 410)) {
          mortas.push(i.id);
        } else {
          console.error("[push]", erro instanceof Error ? erro.message : erro);
        }
      }
    }),
  );
  if (mortas.length > 0) await db.delete(t.inscricoesPush).where(inArray(t.inscricoesPush.id, mortas));
  if (entregues > 0) {
    await db.update(t.inscricoesPush).set({ ultimoEnvioEm: agoraISO() }).where(eq(t.inscricoesPush.usuarioId, usuarioId));
  }
  return entregues;
}

const primeiroNome = (c: Pick<Colaborador, "apelido" | "nome">) => c.apelido || c.nome.split(" ")[0];

/** Destinatários, preferência de push e texto de cada atividade nova. */
export async function enviarPushDasAtividades(ids: string[]): Promise<void> {
  if (ids.length === 0 || !configurado()) return;

  const linhas = await consultaAtividades(inArray(t.atividades.id, ids), ids.length);
  const notificacoes = linhas.map((l) => paraNotificacao(l)).filter((n): n is Notificacao => n !== null);
  if (notificacoes.length === 0) return;

  // Só quem tem aparelho inscrito interessa.
  const inscritos = await db.selectDistinct({ usuarioId: t.inscricoesPush.usuarioId }).from(t.inscricoesPush);
  if (inscritos.length === 0) return;
  const colaboradores = await db
    .select()
    .from(t.colaboradores)
    .where(inArray(t.colaboradores.id, inscritos.map((i) => i.usuarioId)));
  const todos = await db.select({ id: t.colaboradores.id, nome: t.colaboradores.nome, apelido: t.colaboradores.apelido }).from(t.colaboradores);
  const autorDe = (id: string | null) => {
    const c = id ? todos.find((x) => x.id === id) : null;
    return c ? primeiroNome(c) : null;
  };

  await Promise.all(
    colaboradores
      .filter((c) => c.ativo)
      .map(async (c) => {
        const preferencias = await preferenciasDe(c.id);
        const minhas = notificacoes.filter((n) => {
          const p = preferenciaDe(preferencias, n.tipo);
          return alcanca(c, n) && p.noApp && p.push;
        });
        if (minhas.length === 0) return;

        if (minhas.length > MAXIMO_POR_LEVA) {
          const autores = [...new Set(minhas.map((n) => autorDe(n.autorId)).filter(Boolean))];
          await enviarParaUsuario(c.id, {
            titulo: "Axis",
            corpo: `${minhas.length} novas notificações${autores.length === 1 ? ` — por ${autores[0]}` : ""}`,
            url: `${GRUPOS_POR_PERFIL[c.perfil][0].href}?notificacoes=1`,
            tag: `leva-${minhas[0].id}`,
          });
          return;
        }
        for (const n of minhas) {
          await enviarParaUsuario(c.id, {
            titulo: "Axis",
            corpo: textoDoPush(n, autorDe(n.autorId)),
            url: hrefDaNotificacao(n, c.perfil) ?? `${GRUPOS_POR_PERFIL[c.perfil][0].href}?notificacoes=1`,
            tag: n.id,
          });
        }
      }),
  );
}
