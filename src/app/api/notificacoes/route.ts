import { carregarNotificacoes } from "@/lib/servidor/notificacoes";
import { contextoDaSessao } from "@/lib/servidor/sessao";

/**
 * Polling do sino. É GET e não server action porque ações rodam em fila no
 * navegador: uma consulta de fundo não pode atrasar o clique de ninguém.
 */
export async function GET() {
  const ctx = await contextoDaSessao();
  if (!ctx || ctx.pendencia) return Response.json({ erro: "Não autorizado" }, { status: 401 });
  const estado = await carregarNotificacoes(ctx.colaborador);
  return Response.json(estado, { headers: { "Cache-Control": "private, no-store" } });
}
