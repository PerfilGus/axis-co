"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { agoraISO } from "@/lib/iso";
import { podeConfigurar, podeGerirEquipe } from "@/lib/permissoes";
import { db } from "@/lib/servidor/db";
import * as t from "@/lib/servidor/schema";
import { carregarCadastros, type DadosCadastros } from "@/lib/servidor/dados";
import { registrarAtividades } from "@/lib/servidor/atividades";
import { salvarArquivo } from "@/lib/servidor/arquivos";
import { urlDoAnexo } from "@/lib/servidor/repositorio/pedidos";
import { ErroDeAcao, executar, exigir, exigirUsuario, type ContextoSessao, type Resultado } from "@/lib/servidor/sessao";
import { bps, centavos, schemaId } from "./validacao";

/**
 * Cadastros de Configurações. Cada `salvar` é um upsert — sem id cria, com id
 * substitui — e devolve os cadastros inteiros para a tela trocar o estado.
 */

type Retorno<T> = Resultado<{ cadastros: DadosCadastros; extra: T }>;

async function admin(): Promise<ContextoSessao> {
  const ctx = await exigirUsuario();
  exigir(podeConfigurar(ctx.colaborador), "Só o Admin altera cadastros.");
  return ctx;
}

async function responder<T>(ctx: ContextoSessao, extra: T) {
  return { cadastros: await carregarCadastros(ctx.colaborador), extra };
}

/** Imagem de cadastro (produto, banco, criativo, foto de colaborador). */
const urlImagem = z
  .string()
  .regex(/^\/api\/anexos\/[\w-]+$/, "Imagem inválida.")
  .nullable();

/**
 * Upsert genérico com atividade de criação ou edição. `tabela` e `entidade`
 * vêm sempre desta mesma ação, nunca da tela.
 */
async function upsert<T extends { id: string }>(
  ctx: ContextoSessao,
  tabela: typeof t.produtos | typeof t.kits | typeof t.linhasWhatsapp | typeof t.criativos | typeof t.bancosPlataformas,
  entidade: string,
  registro: T,
  titulo: string,
) {
  const [antes] = await db.select().from(tabela).where(eq(tabela.id, registro.id)).limit(1);
  await db.transaction(async (tx) => {
    // O Drizzle não aceita união de tabelas no insert; os campos já foram validados.
    const alvo = tabela as typeof t.produtos;
    const valores = registro as unknown as typeof t.produtos.$inferInsert;
    await tx.insert(alvo).values(valores).onConflictDoUpdate({ target: alvo.id, set: valores });
    await registrarAtividades(
      [
        {
          usuarioId: ctx.colaborador.id,
          papel: ctx.colaborador.perfil,
          acao: antes ? "edicao" : "criacao",
          entidade,
          entidadeId: registro.id,
          titulo,
          antes: antes ?? null,
          depois: registro,
        },
      ],
      tx,
    );
  });
  return antes ?? null;
}

/* ---------------- imagens ---------------- */

export async function enviarImagem(formulario: FormData): Promise<Resultado<string>> {
  return executar(async () => {
    const ctx = await exigirUsuario();
    // Fotos de cadastro e de colaborador: quem altera cadastro ou equipe.
    exigir(podeConfigurar(ctx.colaborador) || podeGerirEquipe(ctx.colaborador));
    const arquivo = formulario.get("arquivo");
    if (!(arquivo instanceof File)) throw new ErroDeAcao("Escolha uma imagem.");
    if (!arquivo.type.startsWith("image/")) throw new ErroDeAcao("Envie uma imagem.");
    const salvo = await salvarArquivo(arquivo, "cadastros");
    await db.insert(t.anexos).values({
      id: salvo.id,
      nome: arquivo.name,
      tipo: "outro",
      tamanhoBytes: salvo.tamanho,
      mime: salvo.mime,
      criadoEm: agoraISO(),
      criadoPor: ctx.colaborador.id,
      caminhoBlob: salvo.caminho,
      entidade: "imagem_cadastro",
      entidadeId: null,
    });
    return urlDoAnexo(salvo.id);
  });
}

/* ---------------- produtos e kits ---------------- */

const schemaProduto = z.object({
  id: schemaId.optional(),
  nome: z.string().trim().min(1, "Informe o nome.").max(120),
  sabor: z.string().trim().max(60).nullable().transform((v) => v || null),
  gramas: z.number().int().positive("Informe o peso."),
  custoUnitario: centavos,
  fotoUrl: urlImagem,
  ativo: z.boolean(),
});

export async function salvarProduto(entrada: z.input<typeof schemaProduto>): Promise<Retorno<typeof t.produtos.$inferSelect>> {
  return executar(async () => {
    const ctx = await admin();
    const dados = schemaProduto.parse(entrada);
    const id = dados.id ?? crypto.randomUUID();
    const [existente] = await db.select().from(t.produtos).where(eq(t.produtos.id, id)).limit(1);
    const produto = { ...dados, id, criadoEm: existente?.criadoEm ?? agoraISO() };
    await upsert(ctx, t.produtos, "produto", produto, `Produto ${produto.nome}`);
    return responder(ctx, produto);
  });
}

const schemaKit = z.object({
  id: schemaId.optional(),
  nome: z.string().trim().min(1, "Informe o nome.").max(120),
  descricao: z.string().trim().max(300),
  itens: z.array(z.object({ produtoId: schemaId, quantidade: z.number().int().positive() })).min(1, "Escolha o produto."),
  precoTabela: centavos.positive("Informe o preço."),
  precoMinimo: centavos,
  freteEstimado: centavos,
  ativo: z.boolean(),
});

export async function salvarKit(entrada: z.input<typeof schemaKit>): Promise<Retorno<typeof t.kits.$inferSelect>> {
  return executar(async () => {
    const ctx = await admin();
    const dados = schemaKit.parse(entrada);
    if (dados.precoMinimo > dados.precoTabela) throw new ErroDeAcao("O piso não pode passar do preço de tabela.");
    const id = dados.id ?? crypto.randomUUID();
    const [existente] = await db.select().from(t.kits).where(eq(t.kits.id, id)).limit(1);
    const kit = { ...dados, id, criadoEm: existente?.criadoEm ?? agoraISO() };
    await upsert(ctx, t.kits, "kit", kit, `Kit ${kit.nome}`);
    return responder(ctx, kit);
  });
}

/* ---------------- linhas e criativos ---------------- */

const schemaLinha = z.object({
  id: schemaId.optional(),
  nome: z.string().trim().min(1, "Informe o nome.").max(60),
  numero: z.string().transform((v) => v.replace(/\D/g, "")).pipe(z.string().min(10, "Número com DDD.").max(13)),
  vendedoresIds: z.array(schemaId),
  ativa: z.boolean(),
});

export async function salvarLinha(entrada: z.input<typeof schemaLinha>): Promise<Retorno<typeof t.linhasWhatsapp.$inferSelect>> {
  return executar(async () => {
    const ctx = await admin();
    const dados = schemaLinha.parse(entrada);
    const id = dados.id ?? crypto.randomUUID();
    const [existente] = await db.select().from(t.linhasWhatsapp).where(eq(t.linhasWhatsapp.id, id)).limit(1);
    const linha = { ...dados, id, criadaEm: existente?.criadaEm ?? agoraISO() };
    await upsert(ctx, t.linhasWhatsapp, "linha_whatsapp", linha, `Linha ${linha.nome}`);
    return responder(ctx, linha);
  });
}

const schemaCriativo = z.object({
  id: schemaId.optional(),
  nome: z.string().trim().min(1, "Informe o nome.").max(120),
  codigo: z.string().regex(/^\d{5}$/, "Código com cinco dígitos."),
  variacao: z.string().regex(/^[A-Z]$/).nullable(),
  formato: z.enum(["video", "imagem", "carrossel"]),
  linhaWhatsappId: schemaId,
  anuncioMeta: z.string().trim().max(120).nullable().transform((v) => v || null),
  thumbUrl: urlImagem,
  ativo: z.boolean(),
});

export async function salvarCriativo(entrada: z.input<typeof schemaCriativo>): Promise<Retorno<typeof t.criativos.$inferSelect>> {
  return executar(async () => {
    const ctx = await admin();
    const dados = schemaCriativo.parse(entrada);
    const id = dados.id ?? crypto.randomUUID();
    const [existente] = await db.select().from(t.criativos).where(eq(t.criativos.id, id)).limit(1);
    const criativo = { ...dados, id, criadoEm: existente?.criadoEm ?? agoraISO() };
    await upsert(ctx, t.criativos, "criativo", criativo, `Criativo ${criativo.codigo}`);
    return responder(ctx, criativo);
  });
}

/* ---------------- bancos ---------------- */

const taxa = z.object({ ativa: z.boolean(), bps: bps.max(10_000), fixa: centavos });

const schemaBanco = z.object({
  id: schemaId.optional(),
  nome: z.string().trim().min(1, "Informe o nome.").max(80),
  tipo: z.enum(["banco", "plataforma"]),
  identificador: z.string().trim().max(80),
  iconeUrl: urlImagem,
  cor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida."),
  ativo: z.boolean(),
  boleto: taxa,
  franquiaBoleto: z.object({ quantidade: z.number().int().min(0), periodo: z.enum(["semanal", "mensal", "anual"]) }),
  pix: taxa,
  cartao: taxa,
});

export async function salvarBanco(entrada: z.input<typeof schemaBanco>): Promise<Retorno<typeof t.bancosPlataformas.$inferSelect>> {
  return executar(async () => {
    const ctx = await admin();
    const dados = schemaBanco.parse(entrada);
    const id = dados.id ?? crypto.randomUUID();
    const [existente] = await db.select().from(t.bancosPlataformas).where(eq(t.bancosPlataformas.id, id)).limit(1);
    const banco = {
      ...dados,
      id,
      saldo: existente?.saldo ?? 0,
      fonte: "manual" as const,
      atualizadoEm: agoraISO(),
    };
    await upsert(ctx, t.bancosPlataformas, "banco", banco, `Banco ${banco.nome}`);
    return responder(ctx, banco);
  });
}

/* ---------------- ativar e desativar ---------------- */

const TABELAS = {
  produto: { tabela: t.produtos, campo: "ativo" },
  kit: { tabela: t.kits, campo: "ativo" },
  criativo: { tabela: t.criativos, campo: "ativo" },
  banco: { tabela: t.bancosPlataformas, campo: "ativo" },
  linha: { tabela: t.linhasWhatsapp, campo: "ativa" },
} as const;

/** Liga ou desliga sem abrir o formulário. Desligar é o arquivamento do cadastro. */
export async function alternarAtivo(tipo: keyof typeof TABELAS, id: string): Promise<Retorno<null>> {
  return executar(async () => {
    const ctx = await admin();
    const { tabela, campo } = TABELAS[z.enum(["produto", "kit", "criativo", "banco", "linha"]).parse(tipo)];
    const alvo = tabela as typeof t.produtos;
    const [registro] = await db.select().from(alvo).where(eq(alvo.id, schemaId.parse(id))).limit(1);
    if (!registro) throw new ErroDeAcao("Cadastro não encontrado.");
    const atual = (registro as unknown as Record<string, boolean>)[campo];
    await db.transaction(async (tx) => {
      await tx.update(alvo).set({ [campo]: !atual } as { ativo: boolean }).where(eq(alvo.id, id));
      await registrarAtividades(
        [
          {
            usuarioId: ctx.colaborador.id,
            papel: ctx.colaborador.perfil,
            acao: atual ? "arquivamento" : "reativacao",
            entidade: tipo,
            entidadeId: id,
            titulo: `${registro.nome} ${atual ? "desativado" : "reativado"}`,
            antes: { [campo]: atual },
            depois: { [campo]: !atual },
          },
        ],
        tx,
      );
    });
    return responder(ctx, null);
  });
}
