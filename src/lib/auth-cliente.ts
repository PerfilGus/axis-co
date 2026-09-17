"use client";

import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";

/**
 * Cliente de autenticação do navegador. Fala com `/api/auth`. Sem o plugin
 * admin: criar e alterar usuário é sempre server action, nunca o navegador.
 */
export const authCliente = createAuthClient({
  plugins: [twoFactorClient()],
});

/** Mensagens do Better Auth em português, para o que a tela mostra. */
export function mensagemDeErro(erro: { code?: string; message?: string; status?: number } | null | undefined): string {
  if (!erro) return "Não foi possível concluir. Tente de novo.";
  switch (erro.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return "E-mail ou senha incorretos.";
    case "BANNED_USER":
      return "Seu acesso está desativado. Fale com o administrador.";
    case "CONTA_BLOQUEADA":
    case "SENHA_FRACA":
      return erro.message ?? "Não foi possível concluir.";
    case "INVALID_TWO_FACTOR_CODE":
    case "INVALID_CODE":
      return "Código incorreto. Confira o aplicativo e tente de novo.";
    case "INVALID_PASSWORD":
      return "Senha atual incorreta.";
    case "PASSWORD_TOO_SHORT":
      return "Senha curta demais.";
  }
  if (erro.status === 429) return erro.message?.startsWith("Muitas") ? erro.message : "Muitas tentativas. Aguarde um pouco.";
  return erro.message && /[à-ú]/i.test(erro.message) ? erro.message : "Não foi possível concluir. Tente de novo.";
}
