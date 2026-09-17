import { timingSafeEqual } from "node:crypto";
import { avaliarJanelasFechadas } from "@/lib/servidor/pontos";

/**
 * Fechamento das janelas de metas, conquistas e recompensas, uma vez por dia
 * (`vercel.json`), logo depois da virada em São Paulo.
 *
 * Não usa sessão: a Vercel manda `Authorization: Bearer $CRON_SECRET`. É
 * idempotente — o índice único por janela impede pontuar duas vezes, então
 * rodar de novo depois de uma falha não duplica nada.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function autorizado(request: Request): boolean {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return false;
  const recebido = Buffer.from(request.headers.get("authorization") ?? "");
  const esperado = Buffer.from(`Bearer ${segredo}`);
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
}

export async function GET(request: Request) {
  if (!autorizado(request)) return new Response("Não autorizado", { status: 401 });
  const resultado = await avaliarJanelasFechadas({ usuarioId: null, papel: null });
  return Response.json({ ok: true, ...resultado });
}
