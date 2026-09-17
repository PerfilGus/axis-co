import { timingSafeEqual } from "node:crypto";
import { and, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { agoraISO } from "@/lib/iso";
import { DIAS_APOS_CRIACAO, DIAS_APOS_FINALIZAR, motivoDaRemocao } from "@/lib/retencao";
import { db } from "@/lib/servidor/db";
import { anexos, pedidos } from "@/lib/servidor/schema";
import { apagarArquivos } from "@/lib/servidor/arquivos";
import { registrarAtividades } from "@/lib/servidor/atividades";
import { codigoDoPedido } from "@/lib/servidor/repositorio/pedidos";

/**
 * Retenção dos arquivos de pedido (`lib/retencao.ts`), chamada pelo Vercel
 * Cron uma vez por dia (`vercel.json`).
 *
 * Não usa sessão: a Vercel manda `Authorization: Bearer $CRON_SECRET`. Apaga
 * do Blob em lotes e só marca `removidoEm` no que o Blob confirmou, com uma
 * atividade por arquivo na mesma transação. O que falhar fica para amanhã.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const LOTE = 200;
const LOTES_POR_EXECUCAO = 25;

function autorizado(request: Request): boolean {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return false;
  const recebido = Buffer.from(request.headers.get("authorization") ?? "");
  const esperado = Buffer.from(`Bearer ${segredo}`);
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
}

export async function GET(request: Request) {
  if (!autorizado(request)) return new Response("Não autorizado", { status: 401 });

  let removidos = 0;
  let falhas = 0;

  for (let lote = 0; lote < LOTES_POR_EXECUCAO; lote++) {
    const vencidos = await db
      .select({
        id: anexos.id,
        nome: anexos.nome,
        tipo: anexos.tipo,
        caminho: anexos.caminhoBlob,
        pedidoId: pedidos.id,
        numero: pedidos.numero,
        criadoEm: pedidos.criadoEm,
        finalizadoEm: pedidos.finalizadoEm,
      })
      .from(anexos)
      .innerJoin(pedidos, eq(pedidos.id, anexos.entidadeId))
      .where(
        and(
          eq(anexos.entidade, "pedido"),
          isNull(anexos.removidoEm),
          or(
            lte(pedidos.criadoEm, sql`now() - make_interval(days => ${DIAS_APOS_CRIACAO})`),
            lte(pedidos.finalizadoEm, sql`now() - make_interval(days => ${DIAS_APOS_FINALIZAR})`),
          ),
        ),
      )
      .limit(LOTE);
    if (vencidos.length === 0) break;

    if (!(await apagarArquivos(vencidos.map((v) => v.caminho)))) {
      falhas += vencidos.length;
      break;
    }

    const agora = agoraISO();
    await db.transaction(async (tx) => {
      await tx
        .update(anexos)
        .set({ removidoEm: agora })
        .where(and(inArray(anexos.id, vencidos.map((v) => v.id)), isNull(anexos.removidoEm)));
      await registrarAtividades(
        vencidos.map((v) => ({
          usuarioId: null,
          papel: "sistema",
          acao: "exclusao",
          entidade: "anexo",
          entidadeId: v.id,
          ocorridoEm: agora,
          titulo: `Arquivo ${v.nome} removido pela política de retenção`,
          descricao: motivoDaRemocao(v),
          antes: { nome: v.nome, tipo: v.tipo },
          depois: { removidoEm: agora },
          dados: { pedidoId: v.pedidoId, pedido: codigoDoPedido(v.numero), politica: "retencao_arquivos" },
        })),
        tx,
      );
    });
    removidos += vencidos.length;
    if (vencidos.length < LOTE) break;
  }

  console.info(`[retencao] ${removidos} arquivo(s) removido(s), ${falhas} com falha`);
  return Response.json({ removidos, falhas });
}
