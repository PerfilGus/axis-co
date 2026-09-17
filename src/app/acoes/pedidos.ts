"use server";

import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { Anexo, Pedido } from "@/lib/types";
import { agoraISO } from "@/lib/iso";
import * as dominio from "@/lib/dominio/pedidos";
import {
  pedidoNoEscopo,
  podeAnexarNoPedido,
  podeAprovarAjuste,
  podeAutorizarEnvio,
  podeCancelarPedido,
  podeCobrarPedido,
  podeCriarPedido,
  podeEditarPedido,
  podeExcluirPedido,
  podeOperarRastreio,
  podeSolicitarAjuste,
  podeVerDadosCliente,
} from "@/lib/permissoes";
import { db } from "@/lib/servidor/db";
import * as t from "@/lib/servidor/schema";
import { mascararPedido } from "@/lib/servidor/dados";
import { carregarPedidos, gravarPedido } from "@/lib/servidor/repositorio/pedidos";
import { registrarAtividades } from "@/lib/servidor/atividades";
import { apagarArquivos, salvarArquivo } from "@/lib/servidor/arquivos";
import {
  ErroDeAcao,
  executar,
  exigir,
  exigirUsuario,
  type ContextoSessao,
  type Resultado,
} from "@/lib/servidor/sessao";
import { schemaCliente, schemaId, textoLivre } from "./validacao";

function contexto(ctx: ContextoSessao): dominio.Contexto {
  return { autorId: ctx.colaborador.id, agora: agoraISO(), novoId: () => crypto.randomUUID() };
}

async function umPedido(id: string): Promise<Pedido> {
  const [pedido] = await carregarPedidos([id]);
  if (!pedido) throw new ErroDeAcao("Pedido não encontrado.");
  return pedido;
}

/** Relê do banco e devolve mascarado, como a lista recebe. */
async function devolver(ids: string[]): Promise<Pedido[]> {
  return (await carregarPedidos(ids)).map(mascararPedido);
}

/* ---------------- criação ---------------- */

const schemaRascunho = z.object({
  cliente: schemaCliente,
  kitId: schemaId,
  criativoId: z.string().min(1, "Escolha o criativo de origem."),
  observacoes: textoLivre(2000),
  confirmacaoPorTexto: z.boolean(),
  ajuste: z
    .object({
      tipo: z.enum(["desconto", "acrescimo"]),
      valor: z.number().int().positive("Informe o valor do ajuste."),
      motivo: z.string().trim().min(5, "Explique o motivo do ajuste.").max(1000),
    })
    .nullable(),
});

const TIPOS_ANEXO_PEDIDO = ["print_confirmacao", "audio_confirmacao", "comprovante", "foto_entrega", "documento", "outro"] as const;

/**
 * Cria o pedido e sobe os anexos da confirmação no mesmo envio. Se um arquivo
 * falhar, nada fica gravado.
 */
export async function criarPedido(formulario: FormData): Promise<Resultado<Pedido>> {
  return executar(async () => {
    const ctx = await exigirUsuario();
    exigir(podeCriarPedido(ctx.colaborador), "Seu perfil não cria pedidos.");

    const rascunho = schemaRascunho.parse(JSON.parse(String(formulario.get("dados") ?? "{}")));
    const arquivos = TIPOS_ANEXO_PEDIDO.flatMap((tipo) =>
      formulario.getAll(tipo).filter((f): f is File => f instanceof File).map((arquivo) => ({ tipo, arquivo })),
    );
    if (!arquivos.some((a) => a.tipo === "print_confirmacao")) {
      throw new ErroDeAcao("O print da confirmação é obrigatório.");
    }
    if (!rascunho.confirmacaoPorTexto && !arquivos.some((a) => a.tipo === "audio_confirmacao")) {
      throw new ErroDeAcao("Anexe o áudio ou marque que o cliente confirmou por texto.");
    }

    const [kits, linhas] = await Promise.all([
      db.select().from(t.kits),
      db.select().from(t.linhasWhatsapp),
    ]);
    const kit = kits.find((k) => k.id === rascunho.kitId && k.ativo);
    if (!kit) throw new ErroDeAcao("Kit indisponível.");
    if (rascunho.ajuste?.tipo === "desconto" && rascunho.ajuste.valor >= kit.precoTabela) {
      throw new ErroDeAcao("O desconto não pode zerar o pedido.");
    }

    const dc = contexto(ctx);
    let pedido = dominio.criarPedido(rascunho, ctx.colaborador.id, { kits, linhas }, dc) as Pedido;

    // Sobe os arquivos antes da transação; se a gravação falhar, apaga.
    const enviados: Anexo[] = [];
    const caminhos: string[] = [];
    try {
      for (const { tipo, arquivo } of arquivos) {
        const salvo = await salvarArquivo(arquivo, `pedidos/${pedido.id}`);
        caminhos.push(salvo.caminho);
        const anexo: Anexo = {
          id: salvo.id,
          nome: arquivo.name,
          tipo,
          tamanhoBytes: salvo.tamanho,
          mime: salvo.mime,
          criadoEm: dc.agora,
          criadoPor: ctx.colaborador.id,
          url: `/api/anexos/${salvo.id}`,
        };
        enviados.push(anexo);
        pedido = dominio.anexar(pedido, anexo, dc);
      }

      await db.transaction(async (tx) => {
        await gravarPedido(tx, null, pedido, ctx.colaborador.perfil);
        if (enviados.length > 0) {
          await tx.insert(t.anexos).values(
            enviados.map((a, i) => ({
              id: a.id,
              nome: a.nome,
              tipo: a.tipo,
              tamanhoBytes: a.tamanhoBytes,
              mime: a.mime,
              criadoEm: a.criadoEm,
              criadoPor: a.criadoPor,
              caminhoBlob: caminhos[i],
              entidade: "pedido",
              entidadeId: pedido.id,
            })),
          );
        }
      });
    } catch (erro) {
      await apagarArquivos(caminhos);
      throw erro;
    }

    const [criado] = await devolver([pedido.id]);
    return criado;
  });
}

/* ---------------- anexos ---------------- */

export async function anexarAoPedido(formulario: FormData): Promise<Resultado<Pedido>> {
  return executar(async () => {
    const ctx = await exigirUsuario();
    const pedidoId = schemaId.parse(formulario.get("pedidoId"));
    const tipo = z.enum(TIPOS_ANEXO_PEDIDO).parse(formulario.get("tipo"));
    const arquivo = formulario.get("arquivo");
    if (!(arquivo instanceof File)) throw new ErroDeAcao("Escolha um arquivo.");

    const pedido = await umPedido(pedidoId);
    exigir(podeAnexarNoPedido(ctx.colaborador, pedido));

    const dc = contexto(ctx);
    const salvo = await salvarArquivo(arquivo, `pedidos/${pedido.id}`);
    const anexo: Anexo = {
      id: salvo.id,
      nome: arquivo.name,
      tipo,
      tamanhoBytes: salvo.tamanho,
      mime: salvo.mime,
      criadoEm: dc.agora,
      criadoPor: ctx.colaborador.id,
      url: `/api/anexos/${salvo.id}`,
    };
    try {
      await db.transaction(async (tx) => {
        await tx.insert(t.anexos).values({
          id: anexo.id,
          nome: anexo.nome,
          tipo,
          tamanhoBytes: anexo.tamanhoBytes,
          mime: anexo.mime,
          criadoEm: anexo.criadoEm,
          criadoPor: anexo.criadoPor,
          caminhoBlob: salvo.caminho,
          entidade: "pedido",
          entidadeId: pedido.id,
        });
        await gravarPedido(tx, pedido, dominio.anexar(pedido, anexo, dc), ctx.colaborador.perfil);
      });
    } catch (erro) {
      await apagarArquivos([salvo.caminho]);
      throw erro;
    }
    const [atualizado] = await devolver([pedido.id]);
    return atualizado;
  });
}

/* ---------------- dados do cliente (LGPD) ---------------- */

export interface DadosSensiveis {
  pedidoId: string;
  telefone: string;
  cpf: string | null;
}

/**
 * Telefone e CPF completos. Cada abertura grava uma atividade de
 * visualização — é o registro de quem viu dado pessoal de quem.
 */
export async function revelarDadosCliente(
  pedidoIds: string[],
  motivo: "detalhe" | "exportacao" = "detalhe",
): Promise<Resultado<DadosSensiveis[]>> {
  return executar(async () => {
    const ctx = await exigirUsuario();
    exigir(podeVerDadosCliente(ctx.colaborador));
    const ids = z.array(schemaId).min(1).max(5000).parse(pedidoIds);

    const linhas = await db
      .select({ pedidoId: t.pedidos.id, clienteId: t.clientes.id, telefone: t.clientes.telefone, cpf: t.clientes.cpf })
      .from(t.pedidos)
      .innerJoin(t.clientes, eq(t.clientes.id, t.pedidos.clienteId))
      .where(inArray(t.pedidos.id, ids));

    await registrarAtividades(
      motivo === "exportacao"
        ? [
            {
              usuarioId: ctx.colaborador.id,
              papel: ctx.colaborador.perfil,
              acao: "exportacao_dados",
              entidade: "cliente",
              titulo: `Exportou dados de ${linhas.length} cliente(s)`,
              dados: { clientes: linhas.map((l) => l.clienteId) },
            },
          ]
        : linhas.map((l) => ({
            usuarioId: ctx.colaborador.id,
            papel: ctx.colaborador.perfil,
            acao: "visualizacao_dados",
            entidade: "cliente",
            entidadeId: l.clienteId,
            titulo: "Abriu os dados completos do cliente",
            dados: { pedidoId: l.pedidoId },
          })),
    );

    return linhas.map(({ pedidoId, telefone, cpf }) => ({ pedidoId, telefone, cpf }));
  });
}

/* ---------------- fluxo do pedido ---------------- */

export async function editarPedido(
  pedidoId: string,
  edicao: dominio.EdicaoPedido,
): Promise<Resultado<Pedido>> {
  return executar(async () => {
    const ctx = await exigirUsuario();
    exigir(podeEditarPedido(ctx.colaborador), "Só o Admin edita pedidos.");
    const dados = z
      .object({
        cliente: schemaCliente,
        observacoes: textoLivre(2000).nullable(),
        valorTotal: z.number().int().positive("O valor precisa ser maior que zero."),
        enderecoValidado: z.boolean(),
        confirmacaoPorTexto: z.boolean(),
      })
      .parse(edicao);
    const pedido = await umPedido(schemaId.parse(pedidoId));
    const editado = dominio.editarPedido(pedido, { ...dados, observacoes: dados.observacoes || null }, contexto(ctx));
    await db.transaction((tx) => gravarPedido(tx, pedido, editado, ctx.colaborador.perfil));
    return (await devolver([pedido.id]))[0];
  });
}

export async function autorizarPedidos(
  ids: string[],
): Promise<Resultado<{ autorizados: Pedido[]; bloqueados: Array<{ pedidoId: string; codigo: string; motivo: string }> }>> {
  return executar(async () => {
    const ctx = await exigirUsuario();
    exigir(podeAutorizarEnvio(ctx.colaborador), "Só o Admin autoriza envios.");
    const lista = await carregarPedidos(z.array(schemaId).min(1).parse(ids));
    const colaboradores = await db.select().from(t.colaboradores);
    const resultado = dominio.autorizar(lista, colaboradores, contexto(ctx));
    await db.transaction(async (tx) => {
      for (const p of resultado.autorizados) {
        await gravarPedido(tx, lista.find((x) => x.id === p.id)!, p, ctx.colaborador.perfil);
      }
    });
    return {
      autorizados: await devolver(resultado.autorizados.map((p) => p.id)),
      bloqueados: resultado.bloqueados.map((b) => ({ pedidoId: b.pedido.id, codigo: b.pedido.codigo, motivo: b.motivo })),
    };
  });
}

export async function cancelarPedidos(ids: string[], motivo: string): Promise<Resultado<Pedido[]>> {
  return executar(async () => {
    const ctx = await exigirUsuario();
    exigir(podeCancelarPedido(ctx.colaborador), "Só o Admin cancela pedidos.");
    const texto = z.string().trim().min(3, "Informe o motivo do cancelamento.").max(1000).parse(motivo);
    const lista = await carregarPedidos(z.array(schemaId).min(1).parse(ids));
    const dc = contexto(ctx);
    const cancelados = lista
      .map((p) => ({ antes: p, depois: dominio.cancelar(p, texto, dc) }))
      .filter((x): x is { antes: Pedido; depois: Pedido } => x.depois !== null);
    await db.transaction(async (tx) => {
      for (const c of cancelados) await gravarPedido(tx, c.antes, c.depois, ctx.colaborador.perfil);
    });
    return devolver(cancelados.map((c) => c.depois.id));
  });
}

export async function solicitarAjuste(
  pedidoId: string,
  entrada: { tipo: "desconto" | "acrescimo" | "alteracao_cadastral" | "exclusao"; valorSolicitado: number; motivo: string },
): Promise<Resultado<Pedido>> {
  return executar(async () => {
    const ctx = await exigirUsuario();
    const dados = z
      .object({
        tipo: z.enum(["desconto", "acrescimo", "alteracao_cadastral", "exclusao"]),
        valorSolicitado: z.number().int().positive(),
        motivo: z.string().trim().min(5, "Explique o que precisa mudar.").max(1000),
      })
      .parse(entrada);
    const pedido = await umPedido(schemaId.parse(pedidoId));
    exigir(podeSolicitarAjuste(ctx.colaborador, pedido), "Você só pede alteração nos seus pedidos.");
    const novo = dominio.solicitarAjuste(pedido, dados, contexto(ctx));
    await db.transaction((tx) => gravarPedido(tx, pedido, novo, ctx.colaborador.perfil));
    return (await devolver([pedido.id]))[0];
  });
}

export async function decidirAjuste(
  pedidoId: string,
  ajusteId: string,
  decisao: "aprovado" | "recusado",
  observacao: string | null,
): Promise<Resultado<Pedido>> {
  return executar(async () => {
    const ctx = await exigirUsuario();
    exigir(podeAprovarAjuste(ctx.colaborador), "Só o Admin decide ajustes.");
    const pedido = await umPedido(schemaId.parse(pedidoId));
    const novo = dominio.decidirAjuste(
      pedido,
      schemaId.parse(ajusteId),
      z.enum(["aprovado", "recusado"]).parse(decisao),
      observacao ? textoLivre(1000).parse(observacao) || null : null,
      contexto(ctx),
    );
    if (!novo) throw new ErroDeAcao("Esse ajuste já foi decidido.");
    await db.transaction((tx) => gravarPedido(tx, pedido, novo, ctx.colaborador.perfil));
    return (await devolver([pedido.id]))[0];
  });
}

export async function registrarPagamento(
  pedidoId: string,
  dados: dominio.DadosPagamento,
): Promise<Resultado<Pedido>> {
  return executar(async () => {
    const ctx = await exigirUsuario();
    const pagamento = z
      .object({
        valorRecebido: z.number().int().positive("Informe o valor recebido."),
        data: z.string().datetime({ offset: true }),
        forma: z.enum(["pix", "boleto", "link_cartao"]),
        bancoId: schemaId,
        taxaAplicada: z.number().int().min(0),
        observacoes: textoLivre(1000).nullable(),
      })
      .parse(dados);
    const pedido = await umPedido(schemaId.parse(pedidoId));
    exigir(podeCobrarPedido(ctx.colaborador, pedido), "Este pedido não está na sua carteira.");
    if (!["entregue", "inadimplente", "em_transito", "autorizado"].includes(pedido.status)) {
      throw new ErroDeAcao("Este pedido não está em cobrança.");
    }
    const novo = dominio.registrarPagamento(pedido, { ...pagamento, observacoes: pagamento.observacoes || null }, contexto(ctx));
    await db.transaction((tx) => gravarPedido(tx, pedido, novo, ctx.colaborador.perfil));
    return (await devolver([pedido.id]))[0];
  });
}

export async function marcarInadimplente(pedidoId: string): Promise<Resultado<Pedido>> {
  return executar(async () => {
    const ctx = await exigirUsuario();
    const pedido = await umPedido(schemaId.parse(pedidoId));
    exigir(podeCobrarPedido(ctx.colaborador, pedido), "Este pedido não está na sua carteira.");
    const [kits, produtos] = await Promise.all([db.select().from(t.kits), db.select().from(t.produtos)]);
    const novo = dominio.marcarInadimplente(pedido, { kits, produtos }, contexto(ctx));
    await db.transaction((tx) => gravarPedido(tx, pedido, novo, ctx.colaborador.perfil));
    return (await devolver([pedido.id]))[0];
  });
}

/**
 * Exclui o pedido, os ajustes e os arquivos. A atividade de exclusão guarda só
 * código, valor e status — nada do cliente, que deixa de existir aqui se não
 * tiver outro pedido.
 */
export async function excluirPedido(pedidoId: string): Promise<Resultado<string>> {
  return executar(async () => {
    const ctx = await exigirUsuario();
    exigir(podeExcluirPedido(ctx.colaborador), "Só o Admin exclui pedidos.");
    const pedido = await umPedido(schemaId.parse(pedidoId));
    const arquivos = await db
      .select({ caminho: t.anexos.caminhoBlob })
      .from(t.anexos)
      .where(eq(t.anexos.entidadeId, pedido.id));

    await db.transaction(async (tx) => {
      await tx.delete(t.anexos).where(eq(t.anexos.entidadeId, pedido.id));
      await tx.delete(t.pedidos).where(eq(t.pedidos.id, pedido.id));
      const outros = await tx
        .select({ id: t.pedidos.id })
        .from(t.pedidos)
        .where(eq(t.pedidos.clienteId, pedido.cliente.id))
        .limit(1);
      if (outros.length === 0) await tx.delete(t.clientes).where(eq(t.clientes.id, pedido.cliente.id));
      await registrarAtividades(
        [
          {
            usuarioId: ctx.colaborador.id,
            papel: ctx.colaborador.perfil,
            acao: "exclusao",
            entidade: "pedido",
            entidadeId: pedido.id,
            titulo: `Pedido ${pedido.codigo} excluído`,
            antes: { codigo: pedido.codigo, status: pedido.status, valorTotal: pedido.valorTotal },
          },
        ],
        tx,
      );
    });
    await apagarArquivos(arquivos.map((a) => a.caminho));
    return pedido.id;
  });
}

/* ---------------- rastreio ---------------- */

export async function arquivarRastreios(ids: string[], arquivar: boolean): Promise<Resultado<Pedido[]>> {
  return executar(async () => {
    const ctx = await exigirUsuario();
    exigir(podeOperarRastreio(ctx.colaborador));
    const lista = await carregarPedidos(z.array(schemaId).min(1).parse(ids));
    const dc = contexto(ctx);
    const mudados = lista
      .map((p) => ({ antes: p, depois: dominio.arquivarRastreio(p, z.boolean().parse(arquivar), dc) }))
      .filter((x): x is { antes: Pedido; depois: Pedido } => x.depois !== null);
    await db.transaction(async (tx) => {
      for (const m of mudados) {
        await gravarPedido(tx, m.antes, m.depois, ctx.colaborador.perfil);
      }
      await registrarAtividades(
        mudados.map((m) => ({
          usuarioId: ctx.colaborador.id,
          papel: ctx.colaborador.perfil,
          acao: "arquivamento",
          entidade: "pedido",
          entidadeId: m.depois.id,
          titulo: arquivar ? "Rastreio arquivado" : "Rastreio desarquivado",
          antes: { arquivado: !arquivar },
          depois: { arquivado: arquivar },
        })),
        tx,
      );
    });
    return devolver(mudados.map((m) => m.depois.id));
  });
}

/** Abrir o pedido consome o destaque; sem id, zera todos. */
export async function limparDestaques(ids: string[] | null): Promise<Resultado<string[]>> {
  return executar(async () => {
    const ctx = await exigirUsuario();
    const lista = await carregarPedidos(ids ? z.array(schemaId).parse(ids) : undefined);
    if (!ids) exigir(podeOperarRastreio(ctx.colaborador));
    const mudados = lista
      .filter((p) => pedidoNoEscopo(ctx.colaborador, p) || podeOperarRastreio(ctx.colaborador))
      .map((p) => ({ antes: p, depois: dominio.limparDestaque(p) }))
      .filter((x): x is { antes: Pedido; depois: Pedido } => x.depois !== null);
    await db.transaction(async (tx) => {
      for (const m of mudados) await gravarPedido(tx, m.antes, m.depois, ctx.colaborador.perfil);
    });
    return mudados.map((m) => m.depois.id);
  });
}

/**
 * Consulta os Correios. A integração ainda não está conectada: a ação existe,
 * confere permissão e devolve quantos objetos seriam verificados.
 */
export async function atualizarRastreios(): Promise<Resultado<{ atualizados: number; verificados: number; integrado: boolean }>> {
  return executar(async () => {
    const ctx = await exigirUsuario();
    exigir(podeOperarRastreio(ctx.colaborador));
    const lista = await db.select({ rastreio: t.pedidos.rastreio }).from(t.pedidos);
    const verificados = lista.filter((p) => p.rastreio && !p.rastreio.arquivado).length;
    return { atualizados: 0, verificados, integrado: false };
  });
}
