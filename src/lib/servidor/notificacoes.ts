import "server-only";
import { and, desc, eq, gte, inArray, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import type { Colaborador, Perfil } from "@/lib/types";
import { iso } from "@/lib/iso";
import { escopoVendedores, PERFIS } from "@/lib/permissoes";
import {
  ACOES_NOTIFICAVEIS,
  alcanca,
  ENTIDADES_NOTIFICAVEIS,
  ehTipoNotificacao,
  preferenciaDe,
  tipoDaAtividade,
  type EstadoNotificacoes,
  type Notificacao,
  type PreferenciaNotificacao,
} from "@/lib/notificacoes";
import { db } from "./db";
import * as t from "./schema";
import { codigoDoPedido } from "./repositorio/pedidos";

/**
 * Notificações lidas da tabela de atividades. Uma janela curta e um limite
 * mantêm a consulta barata: o sino é feito para o que é recente.
 */

const JANELA_DIAS = 60;
/** Quantas o sino mostra. */
const LIMITE = 100;
/** Linhas lidas do banco antes de filtrar tipo, alcance e preferência. */
const LIMITE_LEITURA = 800;

type Linha = {
  atividade: typeof t.atividades.$inferSelect;
  numero: number | null;
  vendedorId: string | null;
  cliente: string | null;
};

const doJson = (valor: unknown) => (valor && typeof valor === "object" ? (valor as Record<string, unknown>) : {});

/** Monta a notificação de uma atividade; `null` se não for notificável. */
export function paraNotificacao(linha: Linha, lida = false): Notificacao | null {
  const a = linha.atividade;
  const tipo = tipoDaAtividade(a);
  if (!tipo) return null;
  const antes = doJson(a.antes);
  const dados = doJson(a.dados);
  const dePedido = a.entidade === "pedido" || a.entidade === "rastreio";
  const codigoGuardado = typeof antes.codigo === "string" ? antes.codigo : typeof dados.pedido === "string" ? dados.pedido : null;
  return {
    id: a.id,
    tipo,
    ocorridoEm: a.ocorridoEm,
    registradoEm: a.registradoEm,
    autorId: a.usuarioId,
    papel: PERFIS.includes(a.papel as Perfil) ? (a.papel as Perfil) : null,
    pedidoId: dePedido && linha.numero !== null ? a.entidadeId : null,
    codigo: linha.numero !== null ? codigoDoPedido(linha.numero) : codigoGuardado,
    vendedorId: linha.vendedorId ?? (typeof antes.vendedorId === "string" ? antes.vendedorId : null),
    cliente: linha.cliente,
    alvoId: dePedido ? null : a.entidadeId,
    titulo: a.titulo,
    descricao: a.descricao,
    valor: typeof dados.valor === "number" ? dados.valor : null,
    lida,
  };
}

/** Consulta base: atividade com o pedido e o cliente, quando houver. */
export function consultaAtividades(filtro: SQL | undefined, limite: number) {
  return db
    .select({
      atividade: t.atividades,
      numero: t.pedidos.numero,
      vendedorId: t.pedidos.vendedorId,
      cliente: t.clientes.nome,
    })
    .from(t.atividades)
    .leftJoin(
      t.pedidos,
      and(eq(t.pedidos.id, t.atividades.entidadeId), inArray(t.atividades.entidade, ["pedido", "rastreio"])),
    )
    .leftJoin(t.clientes, eq(t.clientes.id, t.pedidos.clienteId))
    .where(
      and(
        inArray(t.atividades.acao, ACOES_NOTIFICAVEIS),
        inArray(t.atividades.entidade, ENTIDADES_NOTIFICAVEIS),
        filtro,
      ),
    )
    .orderBy(desc(t.atividades.registradoEm))
    .limit(limite);
}

export async function preferenciasDe(usuarioId: string): Promise<PreferenciaNotificacao[]> {
  const linhas = await db
    .select()
    .from(t.preferenciasNotificacao)
    .where(eq(t.preferenciasNotificacao.usuarioId, usuarioId));
  return linhas
    .filter((l) => ehTipoNotificacao(l.tipo))
    .map((l) => ({ tipo: l.tipo as PreferenciaNotificacao["tipo"], noApp: l.noApp, push: l.push }));
}

export async function carregarNotificacoes(quem: Colaborador): Promise<EstadoNotificacoes> {
  const desde = iso(new Date(Date.now() - JANELA_DIAS * 86_400_000));
  const escopo = escopoVendedores(quem);

  // Recorte grosso no banco; o fino (tipo, alcance) é o mesmo `alcanca` da tela.
  const noEscopo =
    escopo === null
      ? undefined
      : or(
          eq(t.atividades.entidadeId, quem.id),
          ...(escopo.length > 0
            ? [
                inArray(t.pedidos.vendedorId, escopo),
                inArray(sql<string>`${t.atividades.antes}->>'vendedorId'`, escopo),
              ]
            : []),
        );

  const [linhas, preferencias, lidas, [estado]] = await Promise.all([
    consultaAtividades(
      and(
        gte(t.atividades.registradoEm, desde),
        or(isNull(t.atividades.usuarioId), ne(t.atividades.usuarioId, quem.id), eq(t.atividades.acao, "login_bloqueado")),
        noEscopo,
      ),
      LIMITE_LEITURA,
    ),
    preferenciasDe(quem.id),
    db
      .select({ id: t.notificacoesLidas.atividadeId })
      .from(t.notificacoesLidas)
      .where(and(eq(t.notificacoesLidas.usuarioId, quem.id), gte(t.notificacoesLidas.lidaEm, desde))),
    db.select().from(t.notificacoesEstado).where(eq(t.notificacoesEstado.usuarioId, quem.id)).limit(1),
  ]);

  const lidasPorId = new Set(lidas.map((l) => l.id));
  const lidasAte = estado ? new Date(estado.lidasAte).getTime() : 0;

  const itens: Notificacao[] = [];
  for (const linha of linhas) {
    const lida =
      lidasPorId.has(linha.atividade.id) || new Date(linha.atividade.registradoEm).getTime() <= lidasAte;
    const n = paraNotificacao(linha, lida);
    if (!n || !alcanca(quem, n) || !preferenciaDe(preferencias, n.tipo).noApp) continue;
    itens.push(n);
    if (itens.length >= LIMITE) break;
  }
  return { itens, preferencias };
}
