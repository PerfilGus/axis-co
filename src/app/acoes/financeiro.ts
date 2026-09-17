"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { agoraISO, iso } from "@/lib/iso";
import { podeVerFinanceiro, podeVerMarketing } from "@/lib/permissoes";
import { db } from "@/lib/servidor/db";
import * as t from "@/lib/servidor/schema";
import {
  carregarFinanceiro,
  carregarMarketing,
  type DadosFinanceiro,
  type DadosMarketing,
} from "@/lib/servidor/dados";
import { registrarAtividades, type NovaAtividade } from "@/lib/servidor/atividades";
import { apagarArquivos, salvarArquivo } from "@/lib/servidor/arquivos";
import { ErroDeAcao, executar, exigir, exigirUsuario, type ContextoSessao, type Resultado } from "@/lib/servidor/sessao";
import { bps, centavos, competencia, dataISO, dia, schemaId, textoLivre } from "./validacao";

/**
 * Financeiro e marketing guardam só o que é lançado à mão: previsto, DRE e
 * análises são recalculados na tela. Só o Admin entra aqui.
 */

type Retorno = Resultado<DadosFinanceiro>;

async function admin(): Promise<ContextoSessao> {
  const ctx = await exigirUsuario();
  exigir(podeVerFinanceiro(ctx.colaborador), "Só o Admin mexe no financeiro.");
  return ctx;
}

function atividade(ctx: ContextoSessao, a: Omit<NovaAtividade, "usuarioId" | "papel">): NovaAtividade {
  return { usuarioId: ctx.colaborador.id, papel: ctx.colaborador.perfil, ...a };
}

/* ---------------- fornecedor ---------------- */

export async function salvarParametros(entrada: { fornecedor: string; custoPote: number; freteEnvio: number }): Promise<Retorno> {
  return executar(async () => {
    const ctx = await admin();
    const dados = z
      .object({ fornecedor: z.string().trim().min(1, "Informe o fornecedor.").max(120), custoPote: centavos, freteEnvio: centavos })
      .parse(entrada);
    const [antes] = await db.select().from(t.parametrosFornecedor).where(eq(t.parametrosFornecedor.id, "atual")).limit(1);
    const novo = { id: "atual", ...dados, atualizadoEm: agoraISO() };
    await db.transaction(async (tx) => {
      await tx.insert(t.parametrosFornecedor).values(novo).onConflictDoUpdate({ target: t.parametrosFornecedor.id, set: novo });
      await registrarAtividades([atividade(ctx, { acao: antes ? "edicao" : "criacao", entidade: "fornecedor", entidadeId: "atual", titulo: "Parâmetros do fornecedor", antes: antes ?? null, depois: novo })], tx);
    });
    return carregarFinanceiro(ctx.colaborador);
  });
}

export async function lancarPagamentoFornecedor(formulario: FormData): Promise<Retorno> {
  return executar(async () => {
    const ctx = await admin();
    const dados = z
      .object({ pagoEm: dataISO, valor: centavos.positive("Informe o valor pago."), observacoes: textoLivre(1000) })
      .parse(JSON.parse(String(formulario.get("dados") ?? "{}")));
    const arquivo = formulario.get("comprovante");
    const id = crypto.randomUUID();
    const agora = agoraISO();
    const salvo = arquivo instanceof File ? await salvarArquivo(arquivo, `fornecedor/${id}`) : null;
    try {
      await db.transaction(async (tx) => {
        if (salvo && arquivo instanceof File) {
          await tx.insert(t.anexos).values({
            id: salvo.id,
            nome: arquivo.name,
            tipo: "comprovante",
            tamanhoBytes: salvo.tamanho,
            mime: salvo.mime,
            criadoEm: agora,
            criadoPor: ctx.colaborador.id,
            caminhoBlob: salvo.caminho,
            entidade: "pagamento_fornecedor",
            entidadeId: id,
          });
        }
        const pagamento = {
          id,
          pagoEm: dados.pagoEm,
          valor: dados.valor,
          observacoes: dados.observacoes || null,
          comprovanteAnexoId: salvo?.id ?? null,
          lancadoEm: agora,
        };
        await tx.insert(t.pagamentosFornecedor).values(pagamento);
        await registrarAtividades([atividade(ctx, { acao: "pagamento", entidade: "pagamento_fornecedor", entidadeId: id, titulo: "Pagamento ao fornecedor lançado", depois: pagamento })], tx);
      });
    } catch (erro) {
      if (salvo) await apagarArquivos([salvo.caminho]);
      throw erro;
    }
    return carregarFinanceiro(ctx.colaborador);
  });
}

export async function excluirPagamentoFornecedor(id: string): Promise<Retorno> {
  return executar(async () => {
    const ctx = await admin();
    const [antes] = await db.select().from(t.pagamentosFornecedor).where(eq(t.pagamentosFornecedor.id, schemaId.parse(id))).limit(1);
    if (!antes) throw new ErroDeAcao("Pagamento não encontrado.");
    const arquivos = await db.select().from(t.anexos).where(eq(t.anexos.entidadeId, antes.id));
    await db.transaction(async (tx) => {
      await tx.delete(t.anexos).where(eq(t.anexos.entidadeId, antes.id));
      await tx.delete(t.pagamentosFornecedor).where(eq(t.pagamentosFornecedor.id, antes.id));
      await registrarAtividades([atividade(ctx, { acao: "exclusao", entidade: "pagamento_fornecedor", entidadeId: antes.id, titulo: "Pagamento ao fornecedor excluído", antes })], tx);
    });
    await apagarArquivos(arquivos.map((a) => a.caminhoBlob));
    return carregarFinanceiro(ctx.colaborador);
  });
}

const schemaFatura = z.object({
  id: schemaId.optional(),
  numero: z.string().trim().max(60).nullable().transform((v) => v || null),
  de: dia,
  ate: dia,
  valorCobrado: centavos.positive("Informe o valor cobrado."),
  observacoes: z.string().trim().max(1000).nullable().transform((v) => v || null),
});

export async function salvarFatura(entrada: z.input<typeof schemaFatura>): Promise<Retorno> {
  return executar(async () => {
    const ctx = await admin();
    const dados = schemaFatura.parse(entrada);
    if (dados.ate < dados.de) throw new ErroDeAcao("O fim do período vem antes do início.");
    const id = dados.id ?? crypto.randomUUID();
    const [antes] = await db.select().from(t.faturasFornecedor).where(eq(t.faturasFornecedor.id, id)).limit(1);
    const fatura = { ...dados, id, lancadaEm: antes?.lancadaEm ?? agoraISO() };
    await db.transaction(async (tx) => {
      await tx.insert(t.faturasFornecedor).values(fatura).onConflictDoUpdate({ target: t.faturasFornecedor.id, set: fatura });
      await registrarAtividades([atividade(ctx, { acao: antes ? "edicao" : "criacao", entidade: "fatura_fornecedor", entidadeId: id, titulo: "Fatura do fornecedor", antes: antes ?? null, depois: fatura })], tx);
    });
    return carregarFinanceiro(ctx.colaborador);
  });
}

export async function excluirFatura(id: string): Promise<Retorno> {
  return executar(async () => {
    const ctx = await admin();
    const [antes] = await db.select().from(t.faturasFornecedor).where(eq(t.faturasFornecedor.id, schemaId.parse(id))).limit(1);
    if (!antes) throw new ErroDeAcao("Fatura não encontrada.");
    await db.transaction(async (tx) => {
      await tx.delete(t.faturasFornecedor).where(eq(t.faturasFornecedor.id, antes.id));
      await registrarAtividades([atividade(ctx, { acao: "exclusao", entidade: "fatura_fornecedor", entidadeId: antes.id, titulo: "Fatura excluída", antes })], tx);
    });
    return carregarFinanceiro(ctx.colaborador);
  });
}

/* ---------------- resultado ---------------- */

/** Lança ou corrige a alíquota de uma competência; `null` volta a estimar. */
export async function definirAliquota(comp: string, aliquotaBps: number | null): Promise<Retorno> {
  return executar(async () => {
    const ctx = await admin();
    const competenciaOk = competencia.parse(comp);
    const valor = aliquotaBps === null ? null : bps.max(10_000).parse(aliquotaBps);
    const [antes] = await db.select().from(t.aliquotas).where(eq(t.aliquotas.competencia, competenciaOk)).limit(1);
    await db.transaction(async (tx) => {
      if (valor === null) {
        await tx.delete(t.aliquotas).where(eq(t.aliquotas.competencia, competenciaOk));
      } else {
        const nova = { competencia: competenciaOk, aliquotaBps: valor, lancadaEm: agoraISO() };
        await tx.insert(t.aliquotas).values(nova).onConflictDoUpdate({ target: t.aliquotas.competencia, set: nova });
      }
      await registrarAtividades([atividade(ctx, { acao: "edicao", entidade: "aliquota", entidadeId: competenciaOk, titulo: `Alíquota de ${competenciaOk}`, antes: antes ?? null, depois: valor === null ? null : { aliquotaBps: valor } })], tx);
    });
    return carregarFinanceiro(ctx.colaborador);
  });
}

const schemaDespesa = z.object({
  id: schemaId.optional(),
  descricao: z.string().trim().min(1, "Descreva a despesa.").max(160),
  categoria: z.enum(["ferramentas", "telefonia", "internet", "aluguel", "energia", "contabilidade", "pro_labore", "outros"]),
  valor: centavos.positive("Informe o valor."),
  diaVencimento: z.number().int().min(1).max(31),
  desde: competencia,
  ate: competencia.nullable(),
});

export async function salvarDespesa(entrada: z.input<typeof schemaDespesa>): Promise<Retorno> {
  return executar(async () => {
    const ctx = await admin();
    const dados = schemaDespesa.parse(entrada);
    if (dados.ate && dados.ate < dados.desde) throw new ErroDeAcao("O fim vem antes do início.");
    const despesa = { ...dados, id: dados.id ?? crypto.randomUUID() };
    const [antes] = await db.select().from(t.despesasFixas).where(eq(t.despesasFixas.id, despesa.id)).limit(1);
    await db.transaction(async (tx) => {
      await tx.insert(t.despesasFixas).values(despesa).onConflictDoUpdate({ target: t.despesasFixas.id, set: despesa });
      await registrarAtividades([atividade(ctx, { acao: antes ? "edicao" : "criacao", entidade: "despesa", entidadeId: despesa.id, titulo: `Despesa ${despesa.descricao}`, antes: antes ?? null, depois: despesa })], tx);
    });
    return carregarFinanceiro(ctx.colaborador);
  });
}

export async function excluirDespesa(id: string): Promise<Retorno> {
  return executar(async () => {
    const ctx = await admin();
    const [antes] = await db.select().from(t.despesasFixas).where(eq(t.despesasFixas.id, schemaId.parse(id))).limit(1);
    if (!antes) throw new ErroDeAcao("Despesa não encontrada.");
    await db.transaction(async (tx) => {
      await tx.delete(t.despesasFixas).where(eq(t.despesasFixas.id, antes.id));
      await registrarAtividades([atividade(ctx, { acao: "exclusao", entidade: "despesa", entidadeId: antes.id, titulo: `Despesa ${antes.descricao} excluída`, antes })], tx);
    });
    return carregarFinanceiro(ctx.colaborador);
  });
}

const schemaDivida = z.object({
  credor: z.string().trim().min(1, "Informe o credor.").max(120),
  descricao: z.string().trim().max(300),
  valorOriginal: centavos.positive("Informe o valor."),
  jurosBps: bps,
  quantidadeParcelas: z.number().int().min(1).max(360),
  valorParcela: centavos.positive("Informe a parcela."),
  primeiroVencimento: dataISO,
});

export type EntradaDivida = z.input<typeof schemaDivida>;

export async function criarDivida(entrada: EntradaDivida): Promise<Retorno> {
  return executar(async () => {
    const ctx = await admin();
    const dados = schemaDivida.parse(entrada);
    const inicio = new Date(dados.primeiroVencimento);
    const divida = {
      id: crypto.randomUUID(),
      credor: dados.credor,
      descricao: dados.descricao,
      valorOriginal: dados.valorOriginal,
      jurosBps: dados.jurosBps,
      contratadaEm: agoraISO(),
      parcelas: Array.from({ length: dados.quantidadeParcelas }, (_, i) => {
        const vence = new Date(inicio.getTime());
        vence.setUTCMonth(vence.getUTCMonth() + i);
        return { numero: i + 1, valor: dados.valorParcela, venceEm: iso(vence), pagaEm: null };
      }),
    };
    await db.transaction(async (tx) => {
      await tx.insert(t.dividas).values(divida);
      await registrarAtividades([atividade(ctx, { acao: "criacao", entidade: "divida", entidadeId: divida.id, titulo: `Dívida com ${divida.credor}`, depois: { ...divida, parcelas: divida.parcelas.length } })], tx);
    });
    return carregarFinanceiro(ctx.colaborador);
  });
}

export async function alternarParcela(dividaId: string, numero: number, pagaEm: string | null): Promise<Retorno> {
  return executar(async () => {
    const ctx = await admin();
    const [divida] = await db.select().from(t.dividas).where(eq(t.dividas.id, schemaId.parse(dividaId))).limit(1);
    if (!divida) throw new ErroDeAcao("Dívida não encontrada.");
    const quando = pagaEm === null ? null : dataISO.parse(pagaEm);
    const parcelas = divida.parcelas.map((p) => (p.numero === numero ? { ...p, pagaEm: quando } : p));
    await db.transaction(async (tx) => {
      await tx.update(t.dividas).set({ parcelas }).where(eq(t.dividas.id, divida.id));
      await registrarAtividades([atividade(ctx, { acao: "pagamento", entidade: "divida", entidadeId: divida.id, titulo: `Parcela ${numero} ${quando ? "paga" : "reaberta"}`, antes: { pagaEm: divida.parcelas.find((p) => p.numero === numero)?.pagaEm ?? null }, depois: { pagaEm: quando } })], tx);
    });
    return carregarFinanceiro(ctx.colaborador);
  });
}

export async function excluirDivida(id: string): Promise<Retorno> {
  return executar(async () => {
    const ctx = await admin();
    const [antes] = await db.select().from(t.dividas).where(eq(t.dividas.id, schemaId.parse(id))).limit(1);
    if (!antes) throw new ErroDeAcao("Dívida não encontrada.");
    await db.transaction(async (tx) => {
      await tx.delete(t.dividas).where(eq(t.dividas.id, antes.id));
      await registrarAtividades([atividade(ctx, { acao: "exclusao", entidade: "divida", entidadeId: antes.id, titulo: `Dívida com ${antes.credor} excluída`, antes: { credor: antes.credor, valorOriginal: antes.valorOriginal } })], tx);
    });
    return carregarFinanceiro(ctx.colaborador);
  });
}

/* ================================================================
   Marketing — dias de Meta Ads lançados à mão
   ================================================================ */

export async function lancarDiaMetaAds(data: string, investimento: number, leads: number): Promise<Resultado<DadosMarketing>> {
  return executar(async () => {
    const ctx = await exigirUsuario();
    exigir(podeVerMarketing(ctx.colaborador), "Só o Admin lança Meta Ads.");
    const diaOk = dia.parse(data);
    const valores = z.object({ investimento: centavos, leads: z.number().int().min(0) }).parse({ investimento, leads });
    const daApi = await db.select({ id: t.lancamentosMetaAds.id }).from(t.lancamentosMetaAds).where(eq(t.lancamentosMetaAds.data, diaOk)).limit(1);
    if (daApi.length > 0) throw new ErroDeAcao("Esse dia já veio da API e não aceita lançamento manual.");
    const [antes] = await db.select().from(t.diasMetaAds).where(eq(t.diasMetaAds.data, diaOk)).limit(1);
    const registro = { id: antes?.id ?? crypto.randomUUID(), data: diaOk, ...valores, fonte: "manual" as const, lancadoEm: agoraISO() };
    await db.transaction(async (tx) => {
      await tx.insert(t.diasMetaAds).values(registro).onConflictDoUpdate({ target: t.diasMetaAds.data, set: registro });
      await registrarAtividades([atividade(ctx, { acao: antes ? "edicao" : "criacao", entidade: "meta_ads_dia", entidadeId: diaOk, titulo: `Meta Ads de ${diaOk}`, antes: antes ?? null, depois: registro })], tx);
    });
    return carregarMarketing(ctx.colaborador);
  });
}

export async function excluirDiaMetaAds(data: string): Promise<Resultado<DadosMarketing>> {
  return executar(async () => {
    const ctx = await exigirUsuario();
    exigir(podeVerMarketing(ctx.colaborador), "Só o Admin lança Meta Ads.");
    const diaOk = dia.parse(data);
    const [antes] = await db.select().from(t.diasMetaAds).where(eq(t.diasMetaAds.data, diaOk)).limit(1);
    if (!antes) throw new ErroDeAcao("Nada lançado nesse dia.");
    await db.transaction(async (tx) => {
      await tx.delete(t.diasMetaAds).where(eq(t.diasMetaAds.data, diaOk));
      await registrarAtividades([atividade(ctx, { acao: "exclusao", entidade: "meta_ads_dia", entidadeId: diaOk, titulo: `Meta Ads de ${diaOk} excluído`, antes })], tx);
    });
    return carregarMarketing(ctx.colaborador);
  });
}
