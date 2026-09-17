"use server";

import { headers } from "next/headers";
import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { z } from "zod";
import type {
  BonusNivel,
  Colaborador,
  Conquista,
  LancamentoPontos,
  Meta,
  Metrica,
  Nivel,
  Recompensa,
  RegraPontuacao,
} from "@/lib/types";
import { agoraISO, iso } from "@/lib/iso";
import { problemaDaSenha } from "@/lib/senha";
import { hoje, intervaloDeDias } from "@/lib/periodos";
import { CATALOGO_METRICAS, DEFINICAO_METRICA } from "@/lib/metricas";
import { calcularFechamento } from "@/lib/comissoes";
import { reordenarNiveis } from "@/lib/dominio/equipe";
import { podeConfigurar, podeGerirEquipe } from "@/lib/permissoes";
import { auth } from "@/lib/servidor/auth";
import { db } from "@/lib/servidor/db";
import * as t from "@/lib/servidor/schema";
import { carregarEquipe, type DadosEquipe } from "@/lib/servidor/dados";
import { carregarPedidos } from "@/lib/servidor/repositorio/pedidos";
import { registrarAtividades } from "@/lib/servidor/atividades";
import {
  atualizarSaldoENivel,
  avaliarJanelasFechadas,
  lancarPontos,
  quitarRecompensas,
  type ResultadoAvaliacao,
} from "@/lib/servidor/pontos";
import {
  ErroDeAcao,
  executar,
  exigir,
  exigirUsuario,
  type ContextoSessao,
  type Resultado,
} from "@/lib/servidor/sessao";
import { bps, centavos, competencia, dia, schemaId, textoLivre } from "./validacao";

/** As métricas do catálogo, para o Zod recusar qualquer outra. */
const METRICAS = CATALOGO_METRICAS.map((m) => m.chave) as [Metrica, ...Metrica[]];

/**
 * Equipe: colaboradores e o acesso deles, metas, níveis, conquistas, bônus e
 * fechamentos. Toda ação devolve a equipe inteira já recortada para quem pediu
 * — a tela troca o estado de uma vez e nunca fica meio atualizada.
 */

async function admin(): Promise<ContextoSessao> {
  const ctx = await exigirUsuario();
  exigir(podeGerirEquipe(ctx.colaborador), "Só o Admin gerencia a equipe.");
  return ctx;
}

function autor(ctx: ContextoSessao) {
  return { usuarioId: ctx.colaborador.id, papel: ctx.colaborador.perfil };
}

async function comEquipe<T>(ctx: ContextoSessao, extra: T): Promise<{ equipe: DadosEquipe; extra: T }> {
  return { equipe: await carregarEquipe(ctx.colaborador), extra };
}

/* ================================================================
   Colaboradores e acesso
   ================================================================ */

const schemaColaborador = z.object({
  id: schemaId.optional(),
  nome: z.string().trim().min(3, "Informe o nome.").max(160),
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido. É o login."),
  telefone: z.string().transform((v) => v.replace(/\D/g, "")).pipe(z.string().max(11)),
  setor: z.enum(["vendas", "financeiro"]),
  avatarUrl: z.string().max(200).nullable(),
  ativo: z.boolean(),
  vendedoresAtribuidos: z.array(schemaId),
  salarioFixo: centavos,
  diaPagamento: z.number().int().min(1).max(28),
  chavePix: z.string().trim().max(140).nullable().transform((v) => v || null),
  comissaoBps: bps.max(10_000),
  frustradoBps: bps.max(9_999).nullable(),
});

export type EntradaColaborador = z.input<typeof schemaColaborador>;

const perfilDoSetor = (setor: "vendas" | "financeiro") => (setor === "financeiro" ? "cobrador" : "vendedor");

/**
 * Cria ou edita um colaborador. Criar também cria o login, com a senha
 * provisória informada pelo Admin; o primeiro acesso obriga a trocá-la.
 */
export async function salvarColaborador(
  entrada: EntradaColaborador,
  senhaProvisoria: string | null,
): Promise<Resultado<{ equipe: DadosEquipe; extra: Colaborador }>> {
  return executar(async () => {
    const ctx = await admin();
    const dados = schemaColaborador.parse(entrada);
    const perfil = perfilDoSetor(dados.setor);

    const [mesmoEmail] = await db.select().from(t.user).where(eq(t.user.email, dados.email)).limit(1);
    if (mesmoEmail && mesmoEmail.id !== dados.id) throw new ErroDeAcao("Este e-mail já é login de outra pessoa.");

    // Cobrador só recebe vendedores que existem e são de vendas.
    const vendedores = dados.setor === "financeiro" && dados.vendedoresAtribuidos.length > 0
      ? await db.select({ id: t.colaboradores.id }).from(t.colaboradores).where(
          and(inArray(t.colaboradores.id, dados.vendedoresAtribuidos), eq(t.colaboradores.setor, "vendas")),
        )
      : [];

    const campos: Omit<typeof t.colaboradores.$inferInsert, "id" | "entrouEm"> & { perfil: Colaborador["perfil"]; ativo: boolean; nome: string; email: string } = {
      nome: dados.nome,
      apelido: dados.nome.split(/\s+/)[0] ?? dados.nome,
      email: dados.email,
      telefone: dados.telefone,
      setor: dados.setor,
      perfil,
      avatarUrl: dados.avatarUrl,
      ativo: dados.ativo,
      vendedoresAtribuidos: vendedores.map((v) => v.id),
      salarioFixo: dados.salarioFixo,
      diaPagamento: dados.diaPagamento,
      chavePix: dados.chavePix,
      comissaoBps: dados.comissaoBps,
      frustradoBps: dados.setor === "vendas" ? (dados.frustradoBps ?? 0) : null,
    };

    if (!dados.id) {
      const senha = z.string().parse(senhaProvisoria ?? "");
      const problema = problemaDaSenha(senha, dados.email);
      if (problema) throw new ErroDeAcao(`Senha provisória: ${problema}`);

      const { user } = await auth.api.createUser({
        headers: await headers(),
        // O plugin só tipa os papéis padrão; o papel real é gravado logo abaixo.
        body: { email: dados.email, password: senha, name: dados.nome, role: "user" },
      });
      try {
        await db.transaction(async (tx) => {
          const [primeiro] = await tx.select().from(t.niveis).orderBy(t.niveis.ordem).limit(1);
          await tx.update(t.user).set({ trocarSenha: true, role: perfil }).where(eq(t.user.id, user.id));
          await tx.insert(t.colaboradores).values({
            ...campos,
            id: user.id,
            entrouEm: agoraISO(),
            nivelId: primeiro?.id ?? null,
          });
          await registrarAtividades(
            [
              {
                ...autor(ctx),
                acao: "criacao",
                entidade: "colaborador",
                entidadeId: user.id,
                titulo: `Colaborador ${dados.nome} criado`,
                depois: { nome: dados.nome, email: dados.email, perfil },
              },
            ],
            tx,
          );
        });
      } catch (erro) {
        // Sem cadastro de colaborador, o login não pode ficar órfão.
        await db.delete(t.user).where(eq(t.user.id, user.id));
        throw erro;
      }
      const [criado] = await db.select().from(t.colaboradores).where(eq(t.colaboradores.id, user.id));
      return comEquipe(ctx, criado);
    }

    const [antes] = await db.select().from(t.colaboradores).where(eq(t.colaboradores.id, dados.id)).limit(1);
    if (!antes) throw new ErroDeAcao("Colaborador não encontrado.");
    // O Admin continua Admin e ativo: ninguém se tranca para fora do sistema.
    if (antes.perfil === "admin") {
      Object.assign(campos, { perfil: "admin", setor: "administracao", ativo: true, vendedoresAtribuidos: [], frustradoBps: null });
    }

    await db.transaction(async (tx) => {
      await tx.update(t.colaboradores).set(campos).where(eq(t.colaboradores.id, dados.id!));
      await tx
        .update(t.user)
        .set({ name: campos.nome, email: campos.email, role: campos.perfil, banned: !campos.ativo, updatedAt: new Date() })
        .where(eq(t.user.id, dados.id!));
      if (antes.ativo && !campos.ativo) {
        await tx.delete(t.session).where(eq(t.session.userId, dados.id!));
      }
      const mudou = Object.fromEntries(
        Object.entries(campos).filter(([k, v]) => JSON.stringify(antes[k as keyof typeof antes]) !== JSON.stringify(v)),
      );
      await registrarAtividades(
        [
          {
            ...autor(ctx),
            acao: antes.ativo !== dados.ativo ? (dados.ativo ? "reativacao" : "desativacao") : "edicao",
            entidade: "colaborador",
            entidadeId: dados.id,
            titulo:
              antes.ativo !== dados.ativo
                ? `${dados.nome} ${dados.ativo ? "reativado" : "desativado"}`
                : `Cadastro de ${dados.nome} editado`,
            antes: Object.fromEntries(Object.keys(mudou).map((k) => [k, antes[k as keyof typeof antes]])),
            depois: mudou,
          },
        ],
        tx,
      );
    });
    const [salvo] = await db.select().from(t.colaboradores).where(eq(t.colaboradores.id, dados.id));
    return comEquipe(ctx, salvo);
  });
}

/** Troca a senha por uma provisória e derruba as sessões abertas. */
export async function redefinirSenha(colaboradorId: string, senhaProvisoria: string): Promise<Resultado<null>> {
  return executar(async () => {
    const ctx = await admin();
    const id = schemaId.parse(colaboradorId);
    const [conta] = await db.select().from(t.user).where(eq(t.user.id, id)).limit(1);
    if (!conta) throw new ErroDeAcao("Usuário não encontrado.");
    const problema = problemaDaSenha(senhaProvisoria, conta.email);
    if (problema) throw new ErroDeAcao(`Senha provisória: ${problema}`);

    await auth.api.setUserPassword({ headers: await headers(), body: { userId: id, newPassword: senhaProvisoria } });
    await db.transaction(async (tx) => {
      await tx.update(t.user).set({ trocarSenha: true, falhasLogin: 0, bloqueadoAte: null }).where(eq(t.user.id, id));
      await tx.delete(t.session).where(eq(t.session.userId, id));
      await registrarAtividades(
        [{ ...autor(ctx), acao: "redefinicao_senha", entidade: "colaborador", entidadeId: id, titulo: "Senha redefinida pelo Admin" }],
        tx,
      );
    });
    return null;
  });
}

/** Encerra todas as sessões de um usuário, em todos os aparelhos. */
export async function encerrarSessoes(colaboradorId: string): Promise<Resultado<number>> {
  return executar(async () => {
    const ctx = await exigirUsuario();
    const id = schemaId.parse(colaboradorId);
    // Qualquer um encerra as próprias sessões; as dos outros, só o Admin.
    exigir(id === ctx.colaborador.id || podeGerirEquipe(ctx.colaborador));
    const removidas = await db.delete(t.session).where(eq(t.session.userId, id)).returning({ id: t.session.id });
    await registrarAtividades([
      {
        ...autor(ctx),
        acao: "encerramento_sessoes",
        entidade: "colaborador",
        entidadeId: id,
        titulo: `${removidas.length} sessão(ões) encerrada(s)`,
      },
    ]);
    return removidas.length;
  });
}

/** Desliga o 2FA de quem perdeu o aparelho. Admin precisa reconfigurar no próximo acesso. */
export async function redefinirDoisFatores(colaboradorId: string): Promise<Resultado<null>> {
  return executar(async () => {
    const ctx = await admin();
    const id = schemaId.parse(colaboradorId);
    await db.transaction(async (tx) => {
      await tx.delete(t.twoFactor).where(eq(t.twoFactor.userId, id));
      await tx.update(t.user).set({ twoFactorEnabled: false }).where(eq(t.user.id, id));
      await tx.delete(t.session).where(eq(t.session.userId, id));
      await registrarAtividades(
        [{ ...autor(ctx), acao: "redefinicao_2fa", entidade: "colaborador", entidadeId: id, titulo: "Verificação em duas etapas redefinida" }],
        tx,
      );
    });
    return null;
  });
}

/* ================================================================
   Pontuação, metas, níveis, conquistas e recompensas
   ================================================================ */

/** A regra só passa a valer de hoje em diante: o passado não é recalculado. */
const vigenciaFutura = dia.refine((d) => d >= hoje(), "A vigência começa hoje ou depois.");

const schemaRegra = z.object({
  setor: z.enum(["vendas", "financeiro"]),
  vigenteDesde: vigenciaFutura,
  pontosFixos: z.number().int().min(0).max(100_000),
  adicional: z.enum(["nenhum", "faixa_valor", "kit"]),
  faixasValor: z
    .array(z.object({ minimo: centavos, pontos: z.number().int().min(0).max(100_000) }))
    .max(10),
  pontosPorKit: z
    .array(z.object({ kitId: schemaId, pontos: z.number().int().min(0).max(100_000) }))
    .max(50),
  penalidadeBps: bps.max(10_000),
  quedaNivelBps: bps.max(10_000),
});

/**
 * Grava uma versão da regra de pontuação. Salvar duas vezes com a mesma
 * vigência troca aquela versão; as anteriores ficam, porque os lançamentos
 * já feitos apontam para elas.
 */
export async function salvarRegraPontuacao(
  entrada: z.input<typeof schemaRegra>,
): Promise<Resultado<{ equipe: DadosEquipe; extra: RegraPontuacao }>> {
  return executar(async () => {
    const ctx = await exigirUsuario();
    exigir(podeConfigurar(ctx.colaborador), "Só o Admin configura a pontuação.");
    const dados = schemaRegra.parse(entrada);

    const regra = await db.transaction(async (tx) => {
      const [antes] = await tx
        .select()
        .from(t.regrasPontuacao)
        .where(
          and(
            eq(t.regrasPontuacao.setor, dados.setor),
            eq(t.regrasPontuacao.vigenteDesde, dados.vigenteDesde),
          ),
        )
        .limit(1);
      const linha: RegraPontuacao = {
        ...dados,
        id: antes?.id ?? crypto.randomUUID(),
        criadoPor: ctx.colaborador.id,
        criadoEm: agoraISO(),
      };
      await tx
        .insert(t.regrasPontuacao)
        .values(linha)
        .onConflictDoUpdate({ target: t.regrasPontuacao.id, set: linha });
      await registrarAtividades(
        [
          {
            ...autor(ctx),
            acao: antes ? "edicao" : "criacao",
            entidade: "regra_pontuacao",
            entidadeId: linha.id,
            titulo: `Pontuação de ${linha.setor === "vendas" ? "vendas" : "financeiro"} a partir de ${linha.vigenteDesde}`,
            antes: antes ?? null,
            depois: linha,
          },
        ],
        tx,
      );
      // A tolerância de queda pode ter mudado: reavalia a trilha de todo mundo.
      const pontuaveis = await tx.select({ id: t.colaboradores.id }).from(t.colaboradores);
      await atualizarSaldoENivel(tx, pontuaveis.map((c) => c.id), autor(ctx));
      return linha;
    });
    return comEquipe(ctx, regra);
  });
}

/** Apaga uma versão ainda não vigente. O que já valeu fica no histórico. */
export async function excluirRegraPontuacao(
  id: string,
): Promise<Resultado<{ equipe: DadosEquipe; extra: null }>> {
  return executar(async () => {
    const ctx = await exigirUsuario();
    exigir(podeConfigurar(ctx.colaborador));
    const [antes] = await db
      .select()
      .from(t.regrasPontuacao)
      .where(eq(t.regrasPontuacao.id, schemaId.parse(id)))
      .limit(1);
    if (!antes) throw new ErroDeAcao("Regra não encontrada.");
    if (antes.vigenteDesde <= hoje()) throw new ErroDeAcao("Essa regra já está valendo e não pode ser apagada.");
    await db.transaction(async (tx) => {
      await tx.delete(t.regrasPontuacao).where(eq(t.regrasPontuacao.id, antes.id));
      await registrarAtividades(
        [
          {
            ...autor(ctx),
            acao: "exclusao",
            entidade: "regra_pontuacao",
            entidadeId: antes.id,
            titulo: `Pontuação agendada para ${antes.vigenteDesde} cancelada`,
            antes,
          },
        ],
        tx,
      );
    });
    return comEquipe(ctx, null);
  });
}

/* ---------------- metas ---------------- */

const schemaMeta = z
  .object({
    id: schemaId.optional(),
    nome: z.string().trim().min(1, "Dê um nome à meta.").max(120),
    metrica: z.enum(METRICAS),
    alvo: z.number().int().min(0).max(1_000_000_000),
    periodo: z.enum(["diaria", "semanal", "mensal"]),
    setor: z.enum(["vendas", "financeiro"]).nullable(),
    colaboradorId: schemaId.nullable(),
    vigenteDesde: dia,
    vigenteAte: dia.nullable(),
    ativa: z.boolean(),
  })
  .refine((m) => (m.colaboradorId === null) !== (m.setor === null), {
    message: "A meta é de um setor ou de uma pessoa.",
    path: ["setor"],
  })
  .refine((m) => DEFINICAO_METRICA[m.metrica].usavelEmMeta, {
    message: "Essa métrica não pode virar meta.",
    path: ["metrica"],
  })
  .refine((m) => m.vigenteAte === null || m.vigenteAte >= m.vigenteDesde, {
    message: "O fim da vigência vem depois do começo.",
    path: ["vigenteAte"],
  });

export async function salvarMeta(
  entrada: z.input<typeof schemaMeta>,
): Promise<Resultado<{ equipe: DadosEquipe; extra: Meta }>> {
  return executar(async () => {
    const ctx = await exigirUsuario();
    exigir(podeConfigurar(ctx.colaborador));
    const dados = schemaMeta.parse(entrada);
    const meta: Meta = { ...dados, id: dados.id ?? crypto.randomUUID() };
    const [antes] = await db.select().from(t.metas).where(eq(t.metas.id, meta.id)).limit(1);
    await db.transaction(async (tx) => {
      await tx.insert(t.metas).values(meta).onConflictDoUpdate({ target: t.metas.id, set: meta });
      await registrarAtividades(
        [
          {
            ...autor(ctx),
            acao: antes ? "edicao" : "criacao",
            entidade: "meta",
            entidadeId: meta.id,
            titulo: `Meta ${meta.nome}`,
            antes: antes ?? null,
            depois: meta,
          },
        ],
        tx,
      );
    });
    return comEquipe(ctx, meta);
  });
}

export async function excluirMeta(id: string): Promise<Resultado<{ equipe: DadosEquipe; extra: null }>> {
  return executar(async () => {
    const ctx = await exigirUsuario();
    exigir(podeConfigurar(ctx.colaborador));
    const [antes] = await db.select().from(t.metas).where(eq(t.metas.id, schemaId.parse(id))).limit(1);
    if (!antes) throw new ErroDeAcao("Meta não encontrada.");
    const usada = await db
      .select({ id: t.recompensas.id })
      .from(t.recompensas)
      .where(sql`${t.recompensas.condicao}->>'metaId' = ${antes.id}`)
      .limit(1);
    if (usada.length > 0) throw new ErroDeAcao("Uma recompensa depende desta meta. Troque a condição dela antes.");
    await db.transaction(async (tx) => {
      await tx.delete(t.metas).where(eq(t.metas.id, antes.id));
      await registrarAtividades(
        [{ ...autor(ctx), acao: "exclusao", entidade: "meta", entidadeId: antes.id, titulo: `Meta ${antes.nome} excluída`, antes }],
        tx,
      );
    });
    return comEquipe(ctx, null);
  });
}

/* ---------------- níveis ---------------- */

const schemaNivel = z.object({
  id: schemaId.optional(),
  nome: z.string().trim().min(1, "Dê um nome ao nível.").max(60),
  ordem: z.number().int(),
  pontosNecessarios: z.number().int().min(0),
  bonus: centavos,
  icone: z.string().trim().min(1).max(40),
  cor: z.string().trim().max(40).nullable(),
  beneficio: textoLivre(200),
});

export async function salvarNivel(
  entrada: z.input<typeof schemaNivel>,
): Promise<Resultado<{ equipe: DadosEquipe; extra: BonusNivel[] }>> {
  return executar(async () => {
    const ctx = await exigirUsuario();
    exigir(podeConfigurar(ctx.colaborador));
    const dados = schemaNivel.parse(entrada);
    const nivel: Nivel = { ...dados, id: dados.id ?? crypto.randomUUID() };

    const liberados = await db.transaction(async (tx) => {
      const atuais = await tx.select().from(t.niveis);
      if (atuais.some((n) => n.id !== nivel.id && n.pontosNecessarios === nivel.pontosNecessarios)) {
        throw new ErroDeAcao("Outro nível já começa nessa pontuação.");
      }
      const antes = atuais.find((n) => n.id === nivel.id) ?? null;
      const novos = reordenarNiveis(antes ? atuais.map((n) => (n.id === nivel.id ? nivel : n)) : [...atuais, nivel]);
      for (const n of novos) {
        await tx.insert(t.niveis).values(n).onConflictDoUpdate({ target: t.niveis.id, set: n });
      }
      await registrarAtividades(
        [
          {
            ...autor(ctx),
            acao: antes ? "edicao" : "criacao",
            entidade: "nivel",
            entidadeId: nivel.id,
            titulo: `Nível ${nivel.nome}`,
            antes,
            depois: nivel,
          },
        ],
        tx,
      );
      const todos = await tx.select({ id: t.colaboradores.id }).from(t.colaboradores);
      return atualizarSaldoENivel(tx, todos.map((c) => c.id), autor(ctx));
    });
    return comEquipe(ctx, liberados);
  });
}

export async function excluirNivel(id: string): Promise<Resultado<{ equipe: DadosEquipe; extra: null }>> {
  return executar(async () => {
    const ctx = await exigirUsuario();
    exigir(podeConfigurar(ctx.colaborador));
    const alvo = schemaId.parse(id);
    const [antes] = await db.select().from(t.niveis).where(eq(t.niveis.id, alvo)).limit(1);
    if (!antes) throw new ErroDeAcao("Nível não encontrado.");
    const comBonus = await db
      .select({ id: t.bonusNivel.id })
      .from(t.bonusNivel)
      .where(eq(t.bonusNivel.nivelId, alvo))
      .limit(1);
    if (comBonus.length > 0) throw new ErroDeAcao("Esse nível já liberou bônus e não pode ser apagado.");
    await db.transaction(async (tx) => {
      await tx.update(t.colaboradores).set({ nivelId: null }).where(eq(t.colaboradores.nivelId, alvo));
      await tx.delete(t.niveis).where(eq(t.niveis.id, alvo));
      const restantes = reordenarNiveis(await tx.select().from(t.niveis));
      for (const n of restantes) {
        await tx.update(t.niveis).set({ ordem: n.ordem }).where(eq(t.niveis.id, n.id));
      }
      await registrarAtividades(
        [{ ...autor(ctx), acao: "exclusao", entidade: "nivel", entidadeId: alvo, titulo: `Nível ${antes.nome} excluído`, antes }],
        tx,
      );
      const todos = await tx.select({ id: t.colaboradores.id }).from(t.colaboradores);
      await atualizarSaldoENivel(tx, todos.map((c) => c.id), autor(ctx));
    });
    return comEquipe(ctx, null);
  });
}

/* ---------------- conquistas ---------------- */

const schemaConquista = z.object({
  id: schemaId.optional(),
  nome: z.string().trim().min(1, "Dê um nome à conquista.").max(80),
  descricao: textoLivre(300),
  icone: z.string().trim().min(1).max(40),
  metrica: z.enum(METRICAS),
  operador: z.enum(["maior_igual", "menor_igual"]),
  valor: z.number().int().min(0).max(1_000_000_000),
  periodo: z.enum(["diaria", "semanal", "mensal"]),
  setor: z.enum(["vendas", "financeiro"]).nullable(),
  pontos: z.number().int().min(0).max(100_000),
  repetivel: z.boolean(),
  ativa: z.boolean(),
});

export async function salvarConquista(
  entrada: z.input<typeof schemaConquista>,
): Promise<Resultado<{ equipe: DadosEquipe; extra: Conquista }>> {
  return executar(async () => {
    const ctx = await exigirUsuario();
    exigir(podeConfigurar(ctx.colaborador));
    const dados = schemaConquista.parse(entrada);
    const conquista: Conquista = { ...dados, id: dados.id ?? crypto.randomUUID() };
    const [antes] = await db.select().from(t.conquistas).where(eq(t.conquistas.id, conquista.id)).limit(1);
    await db.transaction(async (tx) => {
      await tx.insert(t.conquistas).values(conquista).onConflictDoUpdate({ target: t.conquistas.id, set: conquista });
      await registrarAtividades(
        [
          {
            ...autor(ctx),
            acao: antes ? "edicao" : "criacao",
            entidade: "conquista",
            entidadeId: conquista.id,
            titulo: `Conquista ${conquista.nome}`,
            antes: antes ?? null,
            depois: conquista,
          },
        ],
        tx,
      );
    });
    return comEquipe(ctx, conquista);
  });
}

export async function excluirConquista(
  id: string,
): Promise<Resultado<{ equipe: DadosEquipe; extra: null }>> {
  return executar(async () => {
    const ctx = await exigirUsuario();
    exigir(podeConfigurar(ctx.colaborador));
    const alvo = schemaId.parse(id);
    const [antes] = await db.select().from(t.conquistas).where(eq(t.conquistas.id, alvo)).limit(1);
    if (!antes) throw new ErroDeAcao("Conquista não encontrada.");
    const ja = await db
      .select({ id: t.conquistasDesbloqueadas.id })
      .from(t.conquistasDesbloqueadas)
      .where(eq(t.conquistasDesbloqueadas.conquistaId, alvo))
      .limit(1);
    if (ja.length > 0) throw new ErroDeAcao("Alguém já ganhou essa conquista. Desative em vez de apagar.");
    await db.transaction(async (tx) => {
      await tx.delete(t.conquistas).where(eq(t.conquistas.id, alvo));
      await registrarAtividades(
        [{ ...autor(ctx), acao: "exclusao", entidade: "conquista", entidadeId: alvo, titulo: `Conquista ${antes.nome} excluída`, antes }],
        tx,
      );
    });
    return comEquipe(ctx, null);
  });
}

/** Concede uma conquista à mão. Os pontos entram no extrato como qualquer outro. */
export async function registrarConquista(
  colaboradorId: string,
  conquistaId: string,
): Promise<Resultado<{ equipe: DadosEquipe; extra: BonusNivel[] }>> {
  return executar(async () => {
    const ctx = await admin();
    const liberados = await db.transaction(async (tx) => {
      const [conquista] = await tx
        .select()
        .from(t.conquistas)
        .where(eq(t.conquistas.id, schemaId.parse(conquistaId)))
        .limit(1);
      if (!conquista || !conquista.ativa) throw new ErroDeAcao("Conquista indisponível.");
      const [alvo] = await tx
        .select()
        .from(t.colaboradores)
        .where(eq(t.colaboradores.id, schemaId.parse(colaboradorId)))
        .limit(1);
      if (!alvo) throw new ErroDeAcao("Colaborador não encontrado.");
      if (alvo.setor === "administracao") throw new ErroDeAcao("Administração não pontua.");
      if (!conquista.repetivel) {
        const ja = await tx
          .select({ id: t.conquistasDesbloqueadas.id })
          .from(t.conquistasDesbloqueadas)
          .where(
            and(
              eq(t.conquistasDesbloqueadas.colaboradorId, alvo.id),
              eq(t.conquistasDesbloqueadas.conquistaId, conquista.id),
            ),
          )
          .limit(1);
        if (ja.length > 0) throw new ErroDeAcao("Essa conquista não se repete e já foi registrada.");
      }
      const agora = agoraISO();
      await tx.insert(t.conquistasDesbloqueadas).values({
        conquistaId: conquista.id,
        colaboradorId: alvo.id,
        janela: `manual-${agora}`,
        pontos: conquista.pontos,
        desbloqueadaEm: agora,
      });
      await registrarAtividades(
        [
          {
            ...autor(ctx),
            acao: "conquista",
            entidade: "colaborador",
            entidadeId: alvo.id,
            titulo: `Conquista ${conquista.nome}`,
            descricao: `+${conquista.pontos} pontos, registrada pelo Admin.`,
            depois: { conquistaId: conquista.id, pontos: conquista.pontos },
          },
        ],
        tx,
      );
      await lancarPontos(
        tx,
        {
          colaboradorId: alvo.id,
          setor: alvo.setor as "vendas" | "financeiro",
          pedidoId: null,
          pedidoCodigo: null,
          evento: "conquista",
          pontos: conquista.pontos,
          descricao: `Conquista ${conquista.nome}`,
          regraId: null,
        },
        autor(ctx),
      );
      const [bonus] = await Promise.all([
        tx
          .select()
          .from(t.bonusNivel)
          .where(and(eq(t.bonusNivel.colaboradorId, alvo.id), eq(t.bonusNivel.status, "liberado"))),
      ]);
      return bonus;
    });
    return comEquipe(ctx, liberados);
  });
}

/* ---------------- recompensas ---------------- */

const schemaRecompensa = z
  .object({
    id: schemaId.optional(),
    nome: z.string().trim().min(1, "Dê um nome à recompensa.").max(80),
    valor: centavos,
    condicao: z.discriminatedUnion("tipo", [
      z.object({ tipo: z.literal("meta"), metaId: schemaId }),
      z.object({
        tipo: z.literal("metrica"),
        metrica: z.enum(METRICAS),
        operador: z.enum(["maior_igual", "menor_igual"]),
        valor: z.number().int().min(0).max(1_000_000_000),
      }),
    ]),
    periodo: z.enum(["diaria", "semanal", "mensal"]),
    setor: z.enum(["vendas", "financeiro"]).nullable(),
    colaboradorId: schemaId.nullable(),
    vigenteDesde: dia,
    vigenteAte: dia.nullable(),
    ativa: z.boolean(),
  })
  .refine((r) => r.valor > 0, { message: "A recompensa precisa de um valor.", path: ["valor"] })
  .refine((r) => r.vigenteAte === null || r.vigenteAte >= r.vigenteDesde, {
    message: "O fim da vigência vem depois do começo.",
    path: ["vigenteAte"],
  });

export async function salvarRecompensa(
  entrada: z.input<typeof schemaRecompensa>,
): Promise<Resultado<{ equipe: DadosEquipe; extra: Recompensa }>> {
  return executar(async () => {
    const ctx = await exigirUsuario();
    exigir(podeConfigurar(ctx.colaborador));
    const dados = schemaRecompensa.parse(entrada);
    let periodo = dados.periodo;
    if (dados.condicao.tipo === "meta") {
      const [meta] = await db.select().from(t.metas).where(eq(t.metas.id, dados.condicao.metaId)).limit(1);
      if (!meta) throw new ErroDeAcao("Meta não encontrada.");
      // A janela acompanha a meta: recompensa de meta semanal só fecha na semana.
      periodo = meta.periodo;
    }
    const recompensa: Recompensa = { ...dados, periodo, id: dados.id ?? crypto.randomUUID() };
    const [antes] = await db.select().from(t.recompensas).where(eq(t.recompensas.id, recompensa.id)).limit(1);
    await db.transaction(async (tx) => {
      await tx
        .insert(t.recompensas)
        .values(recompensa)
        .onConflictDoUpdate({ target: t.recompensas.id, set: recompensa });
      await registrarAtividades(
        [
          {
            ...autor(ctx),
            acao: antes ? "edicao" : "criacao",
            entidade: "recompensa",
            entidadeId: recompensa.id,
            titulo: `Recompensa ${recompensa.nome}`,
            antes: antes ?? null,
            depois: recompensa,
          },
        ],
        tx,
      );
    });
    return comEquipe(ctx, recompensa);
  });
}

export async function excluirRecompensa(
  id: string,
): Promise<Resultado<{ equipe: DadosEquipe; extra: null }>> {
  return executar(async () => {
    const ctx = await exigirUsuario();
    exigir(podeConfigurar(ctx.colaborador));
    const alvo = schemaId.parse(id);
    const [antes] = await db.select().from(t.recompensas).where(eq(t.recompensas.id, alvo)).limit(1);
    if (!antes) throw new ErroDeAcao("Recompensa não encontrada.");
    const ja = await db
      .select({ id: t.recompensasLiberadas.id })
      .from(t.recompensasLiberadas)
      .where(eq(t.recompensasLiberadas.recompensaId, alvo))
      .limit(1);
    if (ja.length > 0) throw new ErroDeAcao("Essa recompensa já foi liberada para alguém. Desative em vez de apagar.");
    await db.transaction(async (tx) => {
      await tx.delete(t.recompensas).where(eq(t.recompensas.id, alvo));
      await registrarAtividades(
        [{ ...autor(ctx), acao: "exclusao", entidade: "recompensa", entidadeId: alvo, titulo: `Recompensa ${antes.nome} excluída`, antes }],
        tx,
      );
    });
    return comEquipe(ctx, null);
  });
}

/* ---------------- extrato e fechamento das janelas ---------------- */

/** Extrato de pontos de um período. O próprio colaborador ou o Admin. */
export async function extratoDePontos(
  colaboradorId: string,
  de: string,
  ate: string,
): Promise<Resultado<LancamentoPontos[]>> {
  return executar(async () => {
    const ctx = await exigirUsuario();
    const id = schemaId.parse(colaboradorId);
    exigir(id === ctx.colaborador.id || podeGerirEquipe(ctx.colaborador), "Extrato de outra pessoa é do Admin.");
    const periodo = z.object({ de: dia, ate: dia }).parse({ de, ate });
    const intervalo = intervaloDeDias(periodo.de, periodo.ate);
    const linhas = await db
      .select()
      .from(t.lancamentosPontos)
      .where(
        and(
          eq(t.lancamentosPontos.colaboradorId, id),
          gte(t.lancamentosPontos.ocorridoEm, iso(intervalo.inicio)),
          intervalo.fim ? lt(t.lancamentosPontos.ocorridoEm, iso(intervalo.fim)) : undefined,
        ),
      )
      .orderBy(desc(t.lancamentosPontos.ocorridoEm));
    return linhas;
  });
}

/**
 * Fecha as janelas que já terminaram. A rotina diária faz isso sozinha; o
 * botão existe para conferir na hora, sem esperar a madrugada.
 */
export async function avaliarJanelas(): Promise<Resultado<{ equipe: DadosEquipe; extra: ResultadoAvaliacao }>> {
  return executar(async () => {
    const ctx = await admin();
    const resultado = await avaliarJanelasFechadas(autor(ctx));
    return comEquipe(ctx, resultado);
  });
}

export async function confirmarBonus(bonusId: string): Promise<Resultado<{ equipe: DadosEquipe; extra: null }>> {
  return executar(async () => {
    const ctx = await admin();
    const id = schemaId.parse(bonusId);
    await db.transaction(async (tx) => {
      const [bonus] = await tx.select().from(t.bonusNivel).where(eq(t.bonusNivel.id, id)).limit(1);
      if (!bonus || bonus.status === "pago") throw new ErroDeAcao("Esse bônus já foi pago.");
      await tx.update(t.bonusNivel).set({ status: "pago", pagoEm: agoraISO() }).where(eq(t.bonusNivel.id, id));
      await registrarAtividades(
        [{ ...autor(ctx), acao: "pagamento", entidade: "colaborador", entidadeId: bonus.colaboradorId, titulo: "Bônus de nível pago", depois: { valor: bonus.valor } }],
        tx,
      );
    });
    return comEquipe(ctx, null);
  });
}

/**
 * Marca fechamentos como pagos. O valor não vem da tela: o servidor recalcula
 * o fechamento da competência e congela o que calculou.
 */
export async function marcarComoPago(
  itens: Array<{ colaboradorId: string; competencia: string }>,
): Promise<Resultado<{ equipe: DadosEquipe; extra: null }>> {
  return executar(async () => {
    const ctx = await admin();
    const lista = z.array(z.object({ colaboradorId: schemaId, competencia })).min(1).parse(itens);
    const [colaboradores, niveis, bonusNivel, recompensasLiberadas, pedidos] = await Promise.all([
      db.select().from(t.colaboradores),
      db.select().from(t.niveis),
      db.select().from(t.bonusNivel),
      db.select().from(t.recompensasLiberadas),
      carregarPedidos(),
    ]);
    const pagoEm = agoraISO();
    await db.transaction(async (tx) => {
      for (const item of lista) {
        const colaborador = colaboradores.find((c) => c.id === item.colaboradorId);
        if (!colaborador) throw new ErroDeAcao("Colaborador não encontrado.");
        const fechamento = calcularFechamento(colaborador, item.competencia, pedidos, {
          niveis,
          bonusNivel,
          recompensasLiberadas,
        });
        const pago = { ...fechamento, status: "pago" as const, pagoEm };
        await tx
          .insert(t.pagamentosColaborador)
          .values(pago)
          .onConflictDoNothing({ target: [t.pagamentosColaborador.colaboradorId, t.pagamentosColaborador.competencia] });
        if (fechamento.bonusNivelIds.length > 0) {
          await tx
            .update(t.bonusNivel)
            .set({ status: "pago", pagoEm })
            .where(and(inArray(t.bonusNivel.id, fechamento.bonusNivelIds), eq(t.bonusNivel.status, "liberado")));
        }
        await quitarRecompensas(tx, fechamento.recompensaIds, pagoEm);
        await registrarAtividades(
          [
            {
              ...autor(ctx),
              acao: "pagamento",
              entidade: "colaborador",
              entidadeId: colaborador.id,
              titulo: `Fechamento ${item.competencia} pago`,
              depois: { total: fechamento.total, competencia: item.competencia },
            },
          ],
          tx,
        );
      }
    });
    return comEquipe(ctx, null);
  });
}
