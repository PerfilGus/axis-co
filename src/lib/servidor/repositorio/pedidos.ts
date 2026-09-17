import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { Anexo, EventoPedido, ID, Pedido, TipoEventoPedido } from "@/lib/types";
import { db, type Transacao } from "../db";
import { ajustes, anexos, atividades, clientes, pedidos } from "../schema";
import { registrarAtividades, type NovaAtividade } from "../atividades";
import { agoraISO } from "@/lib/iso";
import { finalizadoEmApos } from "@/lib/retencao";

/**
 * Leitura e gravação de pedidos.
 *
 * O pedido do domínio é um agregado: cliente, ajustes, anexos e linha do tempo.
 * No banco, cada parte tem a sua tabela, e a linha do tempo é a própria tabela
 * de atividades filtrada pela entidade `pedido`.
 */

export const codigoDoPedido = (numero: number) => `AX-${1000 + numero}`;

export function urlDoAnexo(id: ID): string {
  return `/api/anexos/${id}`;
}

function paraAnexo(linha: typeof anexos.$inferSelect): Anexo {
  return {
    id: linha.id,
    nome: linha.nome,
    tipo: linha.tipo,
    tamanhoBytes: linha.tamanhoBytes,
    mime: linha.mime,
    criadoEm: linha.criadoEm,
    criadoPor: linha.criadoPor,
    url: urlDoAnexo(linha.id),
    removidoEm: linha.removidoEm,
  };
}

function paraEvento(linha: typeof atividades.$inferSelect): EventoPedido {
  const dados = (linha.dados ?? {}) as Partial<EventoPedido>;
  return {
    id: linha.id,
    tipo: (dados.tipo ?? "status") as TipoEventoPedido,
    titulo: linha.titulo ?? "",
    descricao: linha.descricao,
    ocorridoEm: linha.ocorridoEm,
    autorId: linha.usuarioId,
    fonte: dados.fonte ?? "manual",
    ...(dados.status ? { status: dados.status } : {}),
    ...(typeof dados.valor === "number" ? { valor: dados.valor } : {}),
  };
}

/** Pedidos completos, do mais novo para o mais antigo. */
export async function carregarPedidos(ids?: ID[]): Promise<Pedido[]> {
  if (ids && ids.length === 0) return [];
  const linhas = await db
    .select({ pedido: pedidos, cliente: clientes })
    .from(pedidos)
    .innerJoin(clientes, eq(clientes.id, pedidos.clienteId))
    .where(ids ? inArray(pedidos.id, ids) : undefined)
    .orderBy(desc(pedidos.criadoEm));
  if (linhas.length === 0) return [];

  const pedidoIds = linhas.map((l) => l.pedido.id);
  const [listaAjustes, listaAnexos, listaEventos] = await Promise.all([
    db.select().from(ajustes).where(inArray(ajustes.pedidoId, pedidoIds)).orderBy(asc(ajustes.solicitadoEm)),
    db
      .select()
      .from(anexos)
      .where(and(eq(anexos.entidade, "pedido"), inArray(anexos.entidadeId, pedidoIds)))
      .orderBy(asc(anexos.criadoEm)),
    db
      .select()
      .from(atividades)
      .where(and(eq(atividades.entidade, "pedido"), inArray(atividades.entidadeId, pedidoIds)))
      .orderBy(asc(atividades.ocorridoEm)),
  ]);

  const agrupar = <T,>(lista: T[], chave: (x: T) => string | null) => {
    const mapa = new Map<string, T[]>();
    for (const item of lista) {
      const k = chave(item);
      if (!k) continue;
      mapa.set(k, [...(mapa.get(k) ?? []), item]);
    }
    return mapa;
  };
  const ajustesPor = agrupar(listaAjustes, (a) => a.pedidoId);
  const anexosPor = agrupar(listaAnexos, (a) => a.entidadeId);
  // Só eventos da linha do tempo; visualizações e exclusões ficam de fora.
  const eventosPor = agrupar(
    listaEventos.filter((e) => e.dados && "tipo" in e.dados),
    (e) => e.entidadeId,
  );

  return linhas.map(({ pedido: p, cliente: c }) => {
    const { numero, clienteId: _clienteId, ...resto } = p;
    void _clienteId;
    return {
      ...resto,
      codigo: codigoDoPedido(numero),
      cliente: c,
      ajustes: ajustesPor.get(p.id) ?? [],
      anexos: (anexosPor.get(p.id) ?? []).map(paraAnexo),
      linhaDoTempo: (eventosPor.get(p.id) ?? []).map(paraEvento),
    };
  });
}

/** O verbo da tabela de atividades para cada evento da linha do tempo. */
function acaoDoEvento(e: EventoPedido): string {
  switch (e.tipo) {
    case "criacao":
      return "criacao";
    case "autorizacao":
      return "aprovacao";
    case "cobranca":
      return "pagamento";
    case "custo":
      return "frustracao";
    case "anexo":
      return "anexo";
    case "rastreio":
      return "rastreio";
    case "ajuste":
      if (e.titulo.includes("aprovado")) return "aprovacao";
      if (e.titulo.includes("recusado")) return "recusa";
      return "solicitacao_alteracao";
    default:
      if (e.titulo.includes("editado")) return "edicao";
      return "mudanca_status";
  }
}

const CAMPOS_AUDITADOS = [
  "status",
  "valorTotal",
  "observacoes",
  "enderecoValidado",
  "confirmacaoPorTexto",
  "motivoCancelamento",
] as const;

/** Só o que mudou, para a auditoria não copiar o pedido inteiro. */
function diferencas(antes: Pedido | null, depois: Pedido) {
  if (!antes) return { antes: null, depois: { status: depois.status, valorTotal: depois.valorTotal } };
  const a: Record<string, unknown> = {};
  const d: Record<string, unknown> = {};
  for (const campo of CAMPOS_AUDITADOS) {
    if (antes[campo] !== depois[campo]) {
      a[campo] = antes[campo];
      d[campo] = depois[campo];
    }
  }
  const ca = antes.cliente as unknown as Record<string, unknown>;
  const cd = depois.cliente as unknown as Record<string, unknown>;
  for (const campo of ["nome", "telefone", "cpf", "endereco", "observacoes"]) {
    if (JSON.stringify(ca[campo]) !== JSON.stringify(cd[campo])) {
      a[`cliente.${campo}`] = ca[campo];
      d[`cliente.${campo}`] = cd[campo];
    }
  }
  return Object.keys(d).length > 0 ? { antes: a, depois: d } : { antes: null, depois: null };
}

/**
 * Grava o pedido e o que mudou nele: cliente, ajustes e os eventos novos da
 * linha do tempo, que viram atividades. Anexos são gravados por quem sobe o
 * arquivo (`anexos.ts`). `finalizadoEm` sai do status, nunca de quem chama.
 */
export async function gravarPedido(
  tx: Transacao,
  antes: Pedido | null,
  depois: Omit<Pedido, "codigo"> & { codigo?: string },
  papel: string,
): Promise<number> {
  const { cliente, ajustes: listaAjustes, anexos: _anexos, linhaDoTempo, codigo: _codigo, ...campos } = depois;
  void _anexos;
  void _codigo;
  // A contagem da retenção é invariante de gravação: nenhuma ação a decide.
  const linha = { ...campos, finalizadoEm: finalizadoEmApos(antes, depois, agoraISO()) };

  await tx
    .insert(clientes)
    .values(cliente)
    .onConflictDoUpdate({
      target: clientes.id,
      set: {
        nome: cliente.nome,
        telefone: cliente.telefone,
        cpf: cliente.cpf,
        endereco: cliente.endereco,
        observacoes: cliente.observacoes,
      },
    });

  const [gravado] = await tx
    .insert(pedidos)
    .values({ ...linha, clienteId: cliente.id })
    .onConflictDoUpdate({
      target: pedidos.id,
      set: { ...linha, clienteId: cliente.id },
    })
    .returning({ numero: pedidos.numero });

  for (const ajuste of listaAjustes) {
    await tx
      .insert(ajustes)
      .values(ajuste)
      .onConflictDoUpdate({ target: ajustes.id, set: ajuste });
  }

  const conhecidos = new Set(antes?.linhaDoTempo.map((e) => e.id) ?? []);
  const novos = linhaDoTempo.filter((e) => !conhecidos.has(e.id));
  const { antes: vAntes, depois: vDepois } = diferencas(antes, depois as Pedido);

  const lista: NovaAtividade[] = novos.map((e, i) => ({
    // O mesmo id do evento do domínio, para a tela e o banco baterem.
    id: e.id,
    usuarioId: e.autorId,
    papel,
    acao: acaoDoEvento(e),
    entidade: "pedido",
    entidadeId: depois.id,
    titulo: e.titulo,
    descricao: e.descricao,
    ocorridoEm: e.ocorridoEm,
    // A diferença vai no evento principal (o último da mudança).
    antes: i === novos.length - 1 ? vAntes : null,
    depois: i === novos.length - 1 ? vDepois : null,
    dados: {
      tipo: e.tipo,
      fonte: e.fonte,
      ...(e.status ? { status: e.status } : {}),
      ...(typeof e.valor === "number" ? { valor: e.valor } : {}),
    },
  }));
  await registrarAtividades(lista, tx);

  return gravado.numero;
}
