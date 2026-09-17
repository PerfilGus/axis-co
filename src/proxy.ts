import { NextResponse, type NextRequest } from "next/server";
import type { Perfil } from "@/lib/types";
import { podeAcessar } from "@/lib/nav";
import { PERFIS } from "@/lib/permissoes";
import { auth } from "@/lib/servidor/auth";

/**
 * Proxy (antigo middleware): primeira barreira de toda requisição.
 *
 * 1. Headers de segurança, com CSP por nonce.
 * 2. Sem sessão, só passam login, política de privacidade e a API de auth.
 * 3. Com sessão, a rota precisa estar na matriz do perfil.
 *
 * Não é a única barreira: layouts, rotas de API e cada server action conferem
 * sessão e permissão de novo no servidor.
 */

/**
 * `/api/cron` não tem sessão: a própria rota confere o `CRON_SECRET`. `/sw.js`
 * precisa carregar mesmo com a sessão vencida, para o aparelho seguir recebendo push.
 */
const PUBLICAS = ["/entrar", "/privacidade", "/api/auth", "/api/cron", "/sw.js"];
/** Exigem sessão, mas valem para qualquer perfil. */
const LIVRES_COM_SESSAO = ["/", "/primeiro-acesso", "/api/anexos", "/api/notificacoes"];

function politicaDeConteudo(nonce: string): string {
  const dev = process.env.NODE_ENV === "development";
  const preview = process.env.VERCEL_ENV === "preview";
  // A barra de comentários da Vercel só existe no preview.
  const vercelLive = preview ? " https://vercel.live" : "";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}${vercelLive}`,
    // Atributos `style` (cores dinâmicas, larguras de barra) não aceitam nonce.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:" + vercelLive,
    "font-src 'self' data:" + vercelLive,
    `connect-src 'self'${dev ? " ws:" : ""}${preview ? " https://vercel.live wss://ws-us3.pusher.com" : ""}`,
    `frame-src 'self'${vercelLive}`,
    "media-src 'self' blob:",
    // Service worker das notificações: sem isto, o `strict-dynamic` o bloquearia.
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    // Só onde há HTTPS: no `next start` local quebraria os recursos.
    ...(process.env.VERCEL ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

function comSeguranca(resposta: NextResponse, csp: string): NextResponse {
  resposta.headers.set("Content-Security-Policy", csp);
  resposta.headers.set("X-Frame-Options", "DENY");
  resposta.headers.set("X-Content-Type-Options", "nosniff");
  resposta.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  resposta.headers.set("Permissions-Policy", "camera=(self), microphone=(self), geolocation=(), payment=()");
  if (process.env.NODE_ENV === "production") {
    resposta.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }
  return resposta;
}

const comecaCom = (pathname: string, lista: string[]) =>
  lista.some((p) => (p === "/" ? pathname === "/" : pathname === p || pathname.startsWith(`${p}/`)));

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = politicaDeConteudo(nonce);

  const cabecalhos = new Headers(request.headers);
  cabecalhos.set("x-nonce", nonce);
  cabecalhos.set("Content-Security-Policy", csp);
  const seguir = () => comSeguranca(NextResponse.next({ request: { headers: cabecalhos } }), csp);

  if (comecaCom(pathname, PUBLICAS)) return seguir();

  const sessao = await auth.api.getSession({ headers: request.headers });
  const ehApi = pathname.startsWith("/api/");

  if (!sessao) {
    if (ehApi) return comSeguranca(NextResponse.json({ erro: "Não autorizado" }, { status: 401 }), csp);
    const destino = new URL("/entrar", request.url);
    return comSeguranca(NextResponse.redirect(destino), csp);
  }

  if (comecaCom(pathname, LIVRES_COM_SESSAO)) return seguir();

  const perfil = sessao.user.role as Perfil | undefined;
  if (!perfil || !PERFIS.includes(perfil) || !podeAcessar(perfil, pathname)) {
    if (ehApi) return comSeguranca(NextResponse.json({ erro: "Sem permissão" }, { status: 403 }), csp);
    return comSeguranca(NextResponse.redirect(new URL("/", request.url)), csp);
  }

  return seguir();
}

export const config = {
  // Inclusive prefetch: a checagem de perfil vale para toda navegação.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest).*)"],
};
