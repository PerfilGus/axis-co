import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import type {
  BonusNivel,
  Colaborador,
  ID,
  LancamentoPontos,
  Pedido,
  RecompensaLiberada,
  SetorPontuavel,
} from "@/lib/types";
import { agoraISO } from "@/lib/iso";
import { formatBRL, formatNumero } from "@/lib/format";
import { diaDe, janelasFechadas, rotuloDaJanela, type Janela } from "@/lib/periodos";
import { lancamentosDevidos, regraVigente, REGRA_PADRAO } from "@/lib/pontos";
import { ajustarNiveis } from "@/lib/dominio/equipe";
import { conquistasADesbloquear, recompensasALiberar } from "@/lib/recompensas";
import type { FontesMetricas } from "@/lib/metricas";
import { db, type Transacao } from "./db";
import * as t from "./schema";
import { registrarAtividades } from "./atividades";

/**
 * Pontos no banco.
 *
 * Um único caminho grava pontos de pedido: `sincronizarPontosDoPedido`, chamada
 * por `gravarPedido` dentro da mesma transação da mudança de status. Ela compara
 * o extrato com o que o status atual deveria render (`lib/pontos.ts`) e insere
 * só a diferença — corrigir um status reverte sozinho, e rodar duas vezes não
 * duplica nada.
 *
 * Depois de qualquer lançamento, o saldo de `colaboradores.pontos` é recalculado
 * da soma do extrato e a trilha de níveis é reavaliada (sobe, cai e libera bônus).
 */

interface Autor {
  usuarioId: ID | null;
  papel: string | null;
}

/** A tolerância de queda de nível vigente hoje, por setor. */
async function quedasDeNivel(tx: Transacao | typeof db): Promise<Record<SetorPontuavel, number>> {
  const regras = await tx.select().from(t.regrasPontuacao);
  const dia = diaDe(agoraISO());
  const de = (setor: SetorPontuavel) =>
    regraVigente(regras, setor, dia)?.quedaNivelBps ?? REGRA_PADRAO.quedaNivelBps;
  return { vendas: de("vendas"), financeiro: de("financeiro") };
}

/**
 * Recalcula o saldo de quem recebeu lançamento e acerta o nível. Devolve os
 * bônus liberados, para a tela mostrar a premiação.
 */
export async function atualizarSaldoENivel(
  tx: Transacao,
  colaboradorIds: ID[],
  autor: Autor,
): Promise<BonusNivel[]> {
  const ids = [...new Set(colaboradorIds)];
  if (ids.length === 0) return [];

  const saldos = await tx
    .select({
      colaboradorId: t.lancamentosPontos.colaboradorId,
      total: sql<number>`coalesce(sum(${t.lancamentosPontos.pontos}), 0)::int`,
    })
    .from(t.lancamentosPontos)
    .where(inArray(t.lancamentosPontos.colaboradorId, ids))
    .groupBy(t.lancamentosPontos.colaboradorId);

  const porId = new Map(saldos.map((s) => [s.colaboradorId, Number(s.total)]));
  const colaboradores = await tx
    .select()
    .from(t.colaboradores)
    .where(inArray(t.colaboradores.id, ids));

  const atualizados: Colaborador[] = [];
  for (const c of colaboradores) {
    const pontos = porId.get(c.id) ?? 0;
    if (pontos !== c.pontos) {
      await tx.update(t.colaboradores).set({ pontos }).where(eq(t.colaboradores.id, c.id));
    }
    atualizados.push({ ...c, pontos });
  }

  const [niveis, bonus, queda] = await Promise.all([
    tx.select().from(t.niveis),
    tx.select().from(t.bonusNivel),
    quedasDeNivel(tx),
  ]);

  const resultado = ajustarNiveis(atualizados, niveis, bonus, (setor) => queda[setor], {
    agora: agoraISO(),
    novoId: () => crypto.randomUUID(),
  });

  for (const mudanca of resultado.mudancas) {
    await tx
      .update(t.colaboradores)
      .set({ nivelId: mudanca.para?.id ?? null })
      .where(eq(t.colaboradores.id, mudanca.colaboradorId));
  }
  if (resultado.mudancas.length > 0) {
    await registrarAtividades(
      resultado.mudancas.map((m) => ({
        ...autor,
        acao: "nivel",
        entidade: "colaborador",
        entidadeId: m.colaboradorId,
        titulo: m.subiu ? `Subiu para ${m.para?.nome ?? "novo nível"}` : `Voltou para ${m.para?.nome ?? "nível anterior"}`,
        antes: { nivel: m.de?.nome ?? null },
        depois: { nivel: m.para?.nome ?? null, subiu: m.subiu },
      })),
      tx,
    );
  }
  if (resultado.liberados.length > 0) {
    await tx.insert(t.bonusNivel).values(resultado.liberados);
    await registrarAtividades(
      resultado.liberados.map((b) => ({
        ...autor,
        acao: "bonus_liberado",
        entidade: "colaborador",
        entidadeId: b.colaboradorId,
        titulo: "Bônus de nível liberado",
        depois: { nivelId: b.nivelId, valor: b.valor },
      })),
      tx,
    );
  }
  return resultado.liberados;
}

/**
 * Lança o que falta do pedido e acerta saldo e nível. `pedido` nulo é exclusão:
 * estorna tudo o que aquele pedido rendeu.
 */
export async function sincronizarPontosDoPedido(
  tx: Transacao,
  pedidoId: ID,
  pedido: (Pedido & { codigo: string }) | null,
  autor: Autor,
): Promise<LancamentoPontos[]> {
  const [regras, colaboradores, existentes] = await Promise.all([
    tx.select().from(t.regrasPontuacao),
    tx.select().from(t.colaboradores),
    tx.select().from(t.lancamentosPontos).where(eq(t.lancamentosPontos.pedidoId, pedidoId)),
  ]);

  const novos = lancamentosDevidos(pedido, existentes, {
    regras,
    colaboradores,
    agora: agoraISO(),
    novoId: () => crypto.randomUUID(),
  });
  if (novos.length === 0) return [];

  await tx.insert(t.lancamentosPontos).values(novos.map((l) => ({ ...l, pedidoId })));
  await atualizarSaldoENivel(tx, novos.map((l) => l.colaboradorId), autor);
  return novos;
}

/** Um lançamento avulso: conquista registrada à mão ou pela rotina. */
export async function lancarPontos(
  tx: Transacao,
  lancamento: Omit<LancamentoPontos, "id" | "ocorridoEm"> & { ocorridoEm?: string },
  autor: Autor,
): Promise<void> {
  await tx.insert(t.lancamentosPontos).values({
    ...lancamento,
    id: crypto.randomUUID(),
    ocorridoEm: lancamento.ocorridoEm ?? agoraISO(),
  });
  await atualizarSaldoENivel(tx, [lancamento.colaboradorId], autor);
}

/* ================================================================
   Janelas fechadas: conquistas e recompensas
   ================================================================ */

/** Quantas janelas de cada período a rotina reavalia, para tolerar um dia sem rodar. */
const JANELAS_AVALIADAS: Array<{ periodo: "diaria" | "semanal" | "mensal"; quantidade: number }> = [
  { periodo: "diaria", quantidade: 3 },
  { periodo: "semanal", quantidade: 1 },
  { periodo: "mensal", quantidade: 1 },
];

export interface ResultadoAvaliacao {
  conquistas: number;
  recompensas: number;
  janelas: number;
}

/**
 * Fecha as contas das janelas que já terminaram: desbloqueia conquistas e
 * libera recompensas. Idempotente — o índice único por janela impede repetir.
 *
 * Roda uma vez por dia (`api/cron/pontos`) e também pelo botão do Admin.
 */
export async function avaliarJanelasFechadas(
  autor: Autor,
  referencia = new Date(),
): Promise<ResultadoAvaliacao> {
  const { carregarPedidos } = await import("./repositorio/pedidos");
  const [colaboradores, conquistas, recompensas, metas, pedidos] = await Promise.all([
    db.select().from(t.colaboradores),
    db.select().from(t.conquistas),
    db.select().from(t.recompensas),
    db.select().from(t.metas),
    carregarPedidos(),
  ]);

  const ativos = colaboradores.filter((c) => c.ativo && c.setor !== "administracao");
  if (ativos.length === 0) return { conquistas: 0, recompensas: 0, janelas: 0 };

  const janelas: Janela[] = JANELAS_AVALIADAS.flatMap(({ periodo, quantidade }) =>
    janelasFechadas(periodo, quantidade, referencia),
  );

  let totalConquistas = 0;
  let totalRecompensas = 0;

  for (const janela of janelas) {
    await db.transaction(async (tx) => {
      const [desbloqueadas, liberadas, lancamentos] = await Promise.all([
        tx.select().from(t.conquistasDesbloqueadas),
        tx.select().from(t.recompensasLiberadas),
        tx.select().from(t.lancamentosPontos),
      ]);
      const fontes: FontesMetricas = { pedidos, lancamentos, metas };
      const tocados: ID[] = [];

      for (const colaborador of ativos) {
        for (const etapa of conquistasADesbloquear(
          colaborador,
          conquistas,
          desbloqueadas,
          janela,
          fontes,
        )) {
          const inseridas = await tx
            .insert(t.conquistasDesbloqueadas)
            .values({
              conquistaId: etapa.conquista.id,
              colaboradorId: colaborador.id,
              janela: janela.chave,
              pontos: etapa.conquista.pontos,
              desbloqueadaEm: agoraISO(),
            })
            .onConflictDoNothing()
            .returning({ id: t.conquistasDesbloqueadas.id });
          if (inseridas.length === 0) continue;

          await tx.insert(t.lancamentosPontos).values({
            id: crypto.randomUUID(),
            colaboradorId: colaborador.id,
            setor: colaborador.setor as SetorPontuavel,
            pedidoId: null,
            pedidoCodigo: null,
            evento: "conquista",
            pontos: etapa.conquista.pontos,
            descricao: `Conquista ${etapa.conquista.nome} (${rotuloDaJanela(janela.chave)})`,
            regraId: null,
            ocorridoEm: agoraISO(),
          });
          await registrarAtividades(
            [
              {
                ...autor,
                acao: "conquista",
                entidade: "colaborador",
                entidadeId: colaborador.id,
                titulo: `Conquista ${etapa.conquista.nome}`,
                descricao: `+${formatNumero(etapa.conquista.pontos)} pontos na ${rotuloDaJanela(janela.chave)}.`,
                depois: { conquistaId: etapa.conquista.id, pontos: etapa.conquista.pontos },
              },
            ],
            tx,
          );
          tocados.push(colaborador.id);
          totalConquistas += 1;
        }

        for (const premio of recompensasALiberar(
          colaborador,
          recompensas,
          liberadas,
          janela,
          fontes,
        )) {
          const liberada: RecompensaLiberada = {
            id: crypto.randomUUID(),
            recompensaId: premio.recompensa.id,
            colaboradorId: colaborador.id,
            janela: janela.chave,
            janelaFim: janela.ate,
            nome: premio.recompensa.nome,
            valor: premio.recompensa.valor,
            liberadaEm: agoraISO(),
            status: "liberado",
            pagoEm: null,
          };
          const inseridas = await tx
            .insert(t.recompensasLiberadas)
            .values(liberada)
            .onConflictDoNothing()
            .returning({ id: t.recompensasLiberadas.id });
          if (inseridas.length === 0) continue;

          await registrarAtividades(
            [
              {
                ...autor,
                acao: "recompensa_liberada",
                entidade: "colaborador",
                entidadeId: colaborador.id,
                titulo: `Recompensa ${premio.recompensa.nome}`,
                descricao: `${formatBRL(premio.recompensa.valor)} na ${rotuloDaJanela(janela.chave)}, no fechamento do mês.`,
                depois: { recompensaId: premio.recompensa.id, valor: premio.recompensa.valor },
              },
            ],
            tx,
          );
          totalRecompensas += 1;
        }
      }

      if (tocados.length > 0) await atualizarSaldoENivel(tx, tocados, autor);
    });
  }

  return { conquistas: totalConquistas, recompensas: totalRecompensas, janelas: janelas.length };
}

/** Marca como pagas as recompensas quitadas num fechamento. */
export async function quitarRecompensas(
  tx: Transacao,
  ids: ID[],
  pagoEm: string,
): Promise<void> {
  if (ids.length === 0) return;
  await tx
    .update(t.recompensasLiberadas)
    .set({ status: "pago", pagoEm })
    .where(
      and(inArray(t.recompensasLiberadas.id, ids), eq(t.recompensasLiberadas.status, "liberado")),
    );
}
