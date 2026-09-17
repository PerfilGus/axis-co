"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { agoraISO } from "@/lib/iso";
import { db } from "@/lib/servidor/db";
import * as t from "@/lib/servidor/schema";
import { origemDaRequisicao, registrarAtividades } from "@/lib/servidor/atividades";
import { enviarParaUsuario, pushConfigurado } from "@/lib/servidor/push";
import { ErroDeAcao, executar, exigirUsuario, type Resultado } from "@/lib/servidor/sessao";

/**
 * Aparelhos que recebem push. A inscrição vem do navegador depois que a pessoa
 * tocou em "Ativar notificações"; cada aparelho é uma linha.
 */

const schemaInscricao = z.object({
  endpoint: z.string().url().max(1000).startsWith("https://"),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

export async function inscreverPush(entrada: z.input<typeof schemaInscricao>): Promise<Resultado<true>> {
  return executar(async () => {
    const ctx = await exigirUsuario();
    if (!pushConfigurado()) throw new ErroDeAcao("As notificações no celular ainda não foram configuradas no servidor.");
    const dados = schemaInscricao.parse(entrada);
    const { userAgent } = await origemDaRequisicao();
    await db.transaction(async (tx) => {
      // O mesmo aparelho trocando de conta passa a ser da conta nova.
      await tx
        .insert(t.inscricoesPush)
        .values({
          id: crypto.randomUUID(),
          usuarioId: ctx.colaborador.id,
          endpoint: dados.endpoint,
          p256dh: dados.keys.p256dh,
          auth: dados.keys.auth,
          userAgent: userAgent?.slice(0, 300) ?? null,
          criadaEm: agoraISO(),
        })
        .onConflictDoUpdate({
          target: t.inscricoesPush.endpoint,
          set: { usuarioId: ctx.colaborador.id, p256dh: dados.keys.p256dh, auth: dados.keys.auth },
        });
      await registrarAtividades(
        [
          {
            usuarioId: ctx.colaborador.id,
            papel: ctx.colaborador.perfil,
            acao: "criacao",
            entidade: "inscricao_push",
            titulo: "Notificações ativadas num aparelho",
            depois: { userAgent: userAgent?.slice(0, 300) ?? null },
          },
        ],
        tx,
      );
    });
    return true as const;
  });
}

export async function cancelarPush(endpoint: string): Promise<Resultado<true>> {
  return executar(async () => {
    const ctx = await exigirUsuario();
    const alvo = z.string().max(1000).parse(endpoint);
    await db.transaction(async (tx) => {
      const apagadas = await tx
        .delete(t.inscricoesPush)
        .where(and(eq(t.inscricoesPush.endpoint, alvo), eq(t.inscricoesPush.usuarioId, ctx.colaborador.id)))
        .returning({ id: t.inscricoesPush.id });
      if (apagadas.length === 0) return;
      await registrarAtividades(
        [
          {
            usuarioId: ctx.colaborador.id,
            papel: ctx.colaborador.perfil,
            acao: "exclusao",
            entidade: "inscricao_push",
            titulo: "Notificações desativadas num aparelho",
          },
        ],
        tx,
      );
    });
    return true as const;
  });
}

/** Manda um aviso de teste para os aparelhos da própria pessoa. */
export async function testarPush(): Promise<Resultado<number>> {
  return executar(async () => {
    const ctx = await exigirUsuario();
    if (!pushConfigurado()) throw new ErroDeAcao("As notificações no celular ainda não foram configuradas no servidor.");
    const entregues = await enviarParaUsuario(ctx.colaborador.id, {
      titulo: "Axis",
      corpo: "Notificações funcionando neste aparelho.",
      url: "/configuracoes/notificacoes",
      tag: "teste",
    });
    if (entregues === 0) throw new ErroDeAcao("Nenhum aparelho recebeu. Ative as notificações de novo neste aparelho.");
    return entregues;
  });
}
