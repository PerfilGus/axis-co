import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware, getSessionFromCtx, isAPIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { admin, twoFactor } from "better-auth/plugins";
import { hash, verify } from "@node-rs/argon2";
import { eq } from "drizzle-orm";
import { problemaDaSenha, SENHA_MAX, SENHA_MIN } from "@/lib/senha";
import { db } from "./db";
import * as schema from "./schema";
import { registrarAtividadeSeguranca } from "./atividades";

/**
 * Autenticação.
 *
 * - Sem cadastro público: só o admin cria usuários (plugin `admin`).
 * - Senha em argon2id, com a política de `lib/senha.ts`.
 * - Sessão no banco, cookie httpOnly/secure/sameSite=lax. Não expira por
 *   inatividade: dura enquanto for usada e só termina ao sair ou quando o admin
 *   encerra as sessões do usuário.
 * - Limite por IP (`rateLimit` no banco) e bloqueio por conta: 5 falhas
 *   seguidas travam o login por 15 minutos.
 * - TOTP pelo plugin `twoFactor`; a obrigatoriedade para admin é aplicada em
 *   `lib/servidor/sessao.ts`.
 */

const FALHAS_PARA_BLOQUEAR = 5;
const BLOQUEIO_MS = 15 * 60_000;
/** 400 dias é o teto que os navegadores aceitam para um cookie. */
const SESSAO_SEGUNDOS = 400 * 24 * 60 * 60;

/** Parâmetros recomendados pela OWASP para argon2id. */
const ARGON2 = { memoryCost: 19_456, timeCost: 2, parallelism: 1, outputLen: 32 } as const;

async function usuarioPorEmail(email: unknown) {
  if (typeof email !== "string") return null;
  const [linha] = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.email, email.trim().toLowerCase()))
    .limit(1);
  return linha ?? null;
}

const hostsPermitidos = [
  "localhost:3000",
  "127.0.0.1:3000",
  "*.vercel.app",
  ...(process.env.BETTER_AUTH_URL ? [new URL(process.env.BETTER_AUTH_URL).host] : []),
];

export const auth = betterAuth({
  appName: "Axis",
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: {
    allowedHosts: hostsPermitidos,
    fallback: process.env.BETTER_AUTH_URL,
    protocol: process.env.NODE_ENV === "production" ? "https" : "auto",
  },
  trustedOrigins: hostsPermitidos.map((h) =>
    h.startsWith("localhost") || h.startsWith("127.") ? `http://${h}` : `https://${h}`,
  ),
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      twoFactor: schema.twoFactor,
      rateLimit: schema.rateLimit,
    },
  }),
  telemetry: { enabled: false },
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: SENHA_MIN,
    maxPasswordLength: SENHA_MAX,
    revokeSessionsOnPasswordReset: true,
    password: {
      hash: (senha) => hash(senha, ARGON2),
      verify: ({ hash: guardado, password }) => verify(guardado, password),
    },
  },
  user: {
    additionalFields: {
      trocarSenha: { type: "boolean", required: false, defaultValue: true, input: false },
      termoAceitoEm: { type: "date", required: false, input: false },
      termoVersao: { type: "string", required: false, input: false },
    },
  },
  session: {
    expiresIn: SESSAO_SEGUNDOS,
    updateAge: 24 * 60 * 60,
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 10 },
      "/two-factor/verify-totp": { window: 60, max: 10 },
      "/two-factor/verify-backup-code": { window: 60, max: 10 },
      "/change-password": { window: 60, max: 5 },
    },
  },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
    cookiePrefix: "axis",
    defaultCookieAttributes: { httpOnly: true, sameSite: "lax" },
    database: { generateId: () => crypto.randomUUID() },
    ipAddress: { ipAddressHeaders: ["x-forwarded-for", "x-real-ip"] },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      // Admin não desliga o próprio 2FA: é obrigatório para o perfil.
      if (ctx.path === "/two-factor/disable") {
        const sessao = await getSessionFromCtx(ctx);
        if ((sessao?.user as { role?: string } | undefined)?.role === "admin") {
          throw new APIError("FORBIDDEN", {
            message: "A verificação em duas etapas é obrigatória para administradores.",
            code: "2FA_OBRIGATORIO",
          });
        }
      }
      if (ctx.path === "/sign-in/email") {
        const usuario = await usuarioPorEmail(ctx.body?.email);
        if (usuario?.bloqueadoAte && usuario.bloqueadoAte.getTime() > Date.now()) {
          const minutos = Math.ceil((usuario.bloqueadoAte.getTime() - Date.now()) / 60_000);
          throw new APIError("TOO_MANY_REQUESTS", {
            message: `Muitas tentativas. Tente de novo em ${minutos} min.`,
            code: "CONTA_BLOQUEADA",
          });
        }
      }
      if (ctx.path === "/change-password") {
        const problema = problemaDaSenha(String(ctx.body?.newPassword ?? ""));
        if (problema) throw new APIError("BAD_REQUEST", { message: problema, code: "SENHA_FRACA" });
      }
      if (ctx.path === "/admin/set-user-password" || ctx.path === "/admin/create-user") {
        const senha = ctx.body?.newPassword ?? ctx.body?.password;
        const problema = senha ? problemaDaSenha(String(senha)) : null;
        if (problema) throw new APIError("BAD_REQUEST", { message: problema, code: "SENHA_FRACA" });
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      const falhou = isAPIError(ctx.context.returned);

      if (ctx.path === "/sign-in/email") {
        const usuario = await usuarioPorEmail(ctx.body?.email);
        const bloqueadaAgora =
          isAPIError(ctx.context.returned) &&
          (ctx.context.returned as APIError).body?.code === "CONTA_BLOQUEADA";
        if (!usuario || bloqueadaAgora) return;

        if (falhou) {
          const falhas = usuario.falhasLogin + 1;
          const bloquear = falhas >= FALHAS_PARA_BLOQUEAR;
          await db
            .update(schema.user)
            .set({
              falhasLogin: bloquear ? 0 : falhas,
              bloqueadoAte: bloquear ? new Date(Date.now() + BLOQUEIO_MS) : usuario.bloqueadoAte,
            })
            .where(eq(schema.user.id, usuario.id));
          await registrarAtividadeSeguranca({
            usuarioId: usuario.id,
            papel: usuario.role,
            acao: bloquear ? "login_bloqueado" : "login_falha",
            entidade: "sessao",
            entidadeId: usuario.id,
            titulo: bloquear ? "Login bloqueado por 15 minutos" : "Senha incorreta",
          });
          return;
        }

        await db
          .update(schema.user)
          .set({ falhasLogin: 0, bloqueadoAte: null })
          .where(eq(schema.user.id, usuario.id));
        await registrarAtividadeSeguranca({
          usuarioId: usuario.id,
          papel: usuario.role,
          acao: usuario.twoFactorEnabled ? "login_senha" : "login",
          entidade: "sessao",
          entidadeId: usuario.id,
          titulo: usuario.twoFactorEnabled ? "Senha conferida, falta o código" : "Entrou no sistema",
        });
      }

      if (ctx.path === "/two-factor/verify-totp" || ctx.path === "/two-factor/verify-backup-code") {
        // Com sessão já aberta é a ativação do 2FA; sem sessão, é o login.
        const aberta = await getSessionFromCtx(ctx);
        const sessao = aberta ?? ctx.context.newSession;
        const usuarioId = sessao?.user.id ?? null;
        if (!usuarioId) return;
        const papel = (sessao?.user as { role?: string } | undefined)?.role ?? null;
        await registrarAtividadeSeguranca(
          aberta
            ? {
                usuarioId,
                papel,
                acao: falhou ? "ativacao_2fa_falha" : "ativacao_2fa",
                entidade: "sessao",
                entidadeId: usuarioId,
                titulo: falhou ? "Código incorreto ao ativar a verificação" : "Ativou a verificação em duas etapas",
              }
            : {
                usuarioId,
                papel,
                acao: falhou ? "login_2fa_falha" : "login",
                entidade: "sessao",
                entidadeId: usuarioId,
                titulo: falhou ? "Código de verificação incorreto" : "Entrou no sistema",
              },
        );
      }

      if (ctx.path === "/two-factor/disable" && !falhou) {
        const sessao = await getSessionFromCtx(ctx);
        if (sessao) {
          await registrarAtividadeSeguranca({
            usuarioId: sessao.user.id,
            papel: (sessao.user as { role?: string }).role ?? null,
            acao: "desativacao_2fa",
            entidade: "sessao",
            entidadeId: sessao.user.id,
            titulo: "Desativou a verificação em duas etapas",
          });
        }
      }

      if (ctx.path === "/sign-out" && ctx.context.session) {
        await registrarAtividadeSeguranca({
          usuarioId: ctx.context.session.user.id,
          papel: (ctx.context.session.user as { role?: string }).role ?? null,
          acao: "logout",
          entidade: "sessao",
          entidadeId: ctx.context.session.user.id,
          titulo: "Saiu do sistema",
        });
      }
    }),
  },
  plugins: [
    admin({
      adminRoles: ["admin"],
      defaultRole: "vendedor",
      bannedUserMessage: "Seu acesso está desativado. Fale com o administrador.",
    }),
    twoFactor({
      issuer: "Axis",
      backupCodeOptions: { amount: 8, length: 10 },
      accountLockout: { enabled: true, maxFailedAttempts: 5, durationSeconds: 15 * 60 },
    }),
    // Precisa ser o último: grava os cookies quando a chamada vem de server action.
    nextCookies(),
  ],
});

export type Sessao = typeof auth.$Infer.Session;
