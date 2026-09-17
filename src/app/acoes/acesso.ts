"use server";

import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { APIError } from "better-auth/api";
import { problemaDaSenha } from "@/lib/senha";
import { auth } from "@/lib/servidor/auth";
import { db } from "@/lib/servidor/db";
import { user } from "@/lib/servidor/schema";
import { registrarAtividadeSeguranca } from "@/lib/servidor/atividades";
import {
  contextoDaSessao,
  ErroDeAcao,
  executar,
  VERSAO_TERMO,
  type Resultado,
} from "@/lib/servidor/sessao";

/**
 * Primeiro acesso e segurança da própria conta. Estas ações aceitam sessão com
 * pendência — é justamente por elas que a pendência é resolvida.
 */

async function sessaoAtual() {
  const ctx = await contextoDaSessao();
  if (!ctx) throw new ErroDeAcao("Sua sessão terminou. Entre de novo.");
  return ctx;
}

/** Troca a senha, derruba as outras sessões e libera o próximo passo. */
export async function trocarSenha(atual: string, nova: string): Promise<Resultado<null>> {
  return executar(async () => {
    const ctx = await sessaoAtual();
    if (typeof atual !== "string" || typeof nova !== "string") throw new ErroDeAcao("Dados inválidos.");
    const problema = problemaDaSenha(nova, ctx.email);
    if (problema) throw new ErroDeAcao(problema);
    if (atual === nova) throw new ErroDeAcao("A nova senha precisa ser diferente da atual.");
    try {
      await auth.api.changePassword({
        headers: await headers(),
        body: { currentPassword: atual, newPassword: nova, revokeOtherSessions: true },
      });
    } catch (erro) {
      if (erro instanceof APIError) {
        throw new ErroDeAcao(erro.body?.code === "INVALID_PASSWORD" ? "Senha atual incorreta." : (erro.body?.message ?? "Não foi possível trocar a senha."));
      }
      throw erro;
    }
    await db.update(user).set({ trocarSenha: false }).where(eq(user.id, ctx.usuarioId));
    await registrarAtividadeSeguranca({
      usuarioId: ctx.usuarioId,
      papel: ctx.colaborador.perfil,
      acao: "troca_senha",
      entidade: "sessao",
      entidadeId: ctx.usuarioId,
      titulo: "Senha trocada",
    });
    return null;
  });
}

/** Registra o aceite do termo de confidencialidade, com data, hora e versão. */
export async function aceitarTermo(): Promise<Resultado<null>> {
  return executar(async () => {
    const ctx = await sessaoAtual();
    if (ctx.pendencia === "trocar_senha") throw new ErroDeAcao("Troque a senha antes.");
    const agora = new Date();
    await db.update(user).set({ termoAceitoEm: agora, termoVersao: VERSAO_TERMO }).where(eq(user.id, ctx.usuarioId));
    await registrarAtividadeSeguranca({
      usuarioId: ctx.usuarioId,
      papel: ctx.colaborador.perfil,
      acao: "aceite_termo",
      entidade: "termo_confidencialidade",
      entidadeId: VERSAO_TERMO,
      titulo: "Aceitou o termo de confidencialidade",
      depois: { versao: VERSAO_TERMO, aceitoEm: agora.toISOString() },
    });
    return null;
  });
}
