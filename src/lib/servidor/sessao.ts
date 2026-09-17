import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { ZodError } from "zod";
import type { Colaborador } from "@/lib/types";
import { auth } from "./auth";
import { db } from "./db";
import { colaboradores, user } from "./schema";

/**
 * Sessão no servidor.
 *
 * `contextoDaSessao` é a única leitura de "quem está pedindo": layouts, rotas
 * e ações passam por ela. O resultado é memoizado por requisição.
 */

/** Versão do termo de confidencialidade. Mudar o texto pede novo aceite. */
export const VERSAO_TERMO = "2026-09-rascunho";

export type Pendencia = "trocar_senha" | "aceitar_termo" | "configurar_2fa";

export interface ContextoSessao {
  sessaoId: string;
  usuarioId: string;
  email: string;
  colaborador: Colaborador;
  doisFatores: boolean;
  pendencia: Pendencia | null;
}

export const contextoDaSessao = cache(async (): Promise<ContextoSessao | null> => {
  const sessao = await auth.api.getSession({ headers: await headers() });
  if (!sessao) return null;

  const [conta] = await db.select().from(user).where(eq(user.id, sessao.user.id)).limit(1);
  const [colaborador] = await db
    .select()
    .from(colaboradores)
    .where(eq(colaboradores.id, sessao.user.id))
    .limit(1);
  if (!conta || conta.banned || !colaborador || !colaborador.ativo) return null;

  const doisFatores = Boolean(conta.twoFactorEnabled);
  let pendencia: Pendencia | null = null;
  if (conta.trocarSenha) pendencia = "trocar_senha";
  else if (!conta.termoAceitoEm || conta.termoVersao !== VERSAO_TERMO) pendencia = "aceitar_termo";
  else if (colaborador.perfil === "admin" && !doisFatores) pendencia = "configurar_2fa";

  return {
    sessaoId: sessao.session.id,
    usuarioId: conta.id,
    email: conta.email,
    colaborador,
    doisFatores,
    pendencia,
  };
});

/* ---------------- ações ---------------- */

/** Erro com mensagem que pode ir para a tela. */
export class ErroDeAcao extends Error {}

export class SemPermissao extends ErroDeAcao {
  constructor(mensagem = "Você não tem permissão para esta ação.") {
    super(mensagem);
  }
}

export type Resultado<T> = { ok: true; dados: T } | { ok: false; erro: string };

/**
 * Exige usuário logado e sem pendência de primeiro acesso. Toda server action
 * e rota de API que mexe em dado começa por aqui.
 */
export async function exigirUsuario(): Promise<ContextoSessao> {
  const ctx = await contextoDaSessao();
  if (!ctx) throw new ErroDeAcao("Sua sessão terminou. Entre de novo.");
  if (ctx.pendencia) throw new ErroDeAcao("Conclua o primeiro acesso antes de continuar.");
  return ctx;
}

export function exigir(condicao: boolean, mensagem?: string): asserts condicao {
  if (!condicao) throw new SemPermissao(mensagem);
}

/** Converte exceções em `Resultado`, sem vazar detalhe interno para a tela. */
export async function executar<T>(fn: () => Promise<T>): Promise<Resultado<T>> {
  try {
    return { ok: true, dados: await fn() };
  } catch (erro) {
    if (erro instanceof ErroDeAcao) return { ok: false, erro: erro.message };
    if (erro instanceof ZodError) {
      const primeiro = erro.issues[0];
      return { ok: false, erro: primeiro?.message ?? "Dados inválidos." };
    }
    console.error("[acao]", erro);
    return { ok: false, erro: "Não foi possível concluir. Tente de novo." };
  }
}
