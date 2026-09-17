"use server";

import { headers } from "next/headers";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { BonusNivel, Colaborador, Conquista, Meta, Nivel } from "@/lib/types";
import { agoraISO } from "@/lib/iso";
import { problemaDaSenha } from "@/lib/senha";
import { calcularFechamento } from "@/lib/comissoes";
import { promover, reordenarNiveis } from "@/lib/dominio/equipe";
import { podeConfigurar, podeGerirEquipe } from "@/lib/permissoes";
import { auth } from "@/lib/servidor/auth";
import { db, type Transacao } from "@/lib/servidor/db";
import * as t from "@/lib/servidor/schema";
import { carregarEquipe, type DadosEquipe } from "@/lib/servidor/dados";
import { carregarPedidos } from "@/lib/servidor/repositorio/pedidos";
import { registrarAtividades } from "@/lib/servidor/atividades";
import {
  ErroDeAcao,
  executar,
  exigir,
  exigirUsuario,
  type ContextoSessao,
  type Resultado,
} from "@/lib/servidor/sessao";
import { bps, centavos, competencia, schemaId } from "./validacao";

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

/** Grava a promoção de nível e os bônus liberados dentro da transação. */
async function aplicarPromocao(
  tx: Transacao,
  ctx: ContextoSessao,
  colaboradores: Colaborador[],
  niveis: Nivel[],
): Promise<BonusNivel[]> {
  const bonus = await tx.select().from(t.bonusNivel);
  const resultado = promover(colaboradores, niveis, bonus, {
    agora: agoraISO(),
    novoId: () => crypto.randomUUID(),
  });
  for (const c of resultado.colaboradores) {
    const antes = colaboradores.find((x) => x.id === c.id);
    if (antes && antes.nivelId !== c.nivelId) {
      await tx.update(t.colaboradores).set({ nivelId: c.nivelId }).where(eq(t.colaboradores.id, c.id));
    }
  }
  if (resultado.liberados.length > 0) {
    await tx.insert(t.bonusNivel).values(resultado.liberados);
    await registrarAtividades(
      resultado.liberados.map((b) => ({
        ...autor(ctx),
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
   Metas, níveis e conquistas
   ================================================================ */

const schemaMeta = z.object({
  id: schemaId.optional(),
  colaboradorId: schemaId,
  nome: z.string().trim().min(1, "Dê um nome à meta.").max(120),
  tipo: z.enum(["pedidos", "faturamento"]),
  periodo: z.enum(["diaria", "semanal", "mensal"]),
  faixas: z
    .array(
      z.object({
        id: schemaId,
        alvo: z.number().int().positive(),
        recompensa: z.enum(["percentual", "bonus"]),
        valor: z.number().int().min(0),
      }),
    )
    .min(1, "Cadastre pelo menos uma faixa."),
  ativa: z.boolean(),
});

export async function salvarMeta(entrada: z.input<typeof schemaMeta>): Promise<Resultado<{ equipe: DadosEquipe; extra: Meta }>> {
  return executar(async () => {
    const ctx = await exigirUsuario();
    exigir(podeConfigurar(ctx.colaborador));
    const dados = schemaMeta.parse(entrada);
    const meta: Meta = { ...dados, id: dados.id ?? crypto.randomUUID() };
    const [antes] = await db.select().from(t.metas).where(eq(t.metas.id, meta.id)).limit(1);
    await db.transaction(async (tx) => {
      await tx.insert(t.metas).values(meta).onConflictDoUpdate({ target: t.metas.id, set: meta });
      await registrarAtividades(
        [{ ...autor(ctx), acao: antes ? "edicao" : "criacao", entidade: "meta", entidadeId: meta.id, titulo: `Meta ${meta.nome}`, antes: antes ?? null, depois: meta }],
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

const schemaNivel = z.object({
  id: schemaId.optional(),
  nome: z.string().trim().min(1, "Dê um nome ao nível.").max(60),
  ordem: z.number().int(),
  pontosNecessarios: z.number().int().min(0),
  bonus: centavos,
  icone: z.string().trim().min(1).max(40),
});

export async function salvarNivel(entrada: z.input<typeof schemaNivel>): Promise<Resultado<{ equipe: DadosEquipe; extra: BonusNivel[] }>> {
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
      const colaboradores = await tx.select().from(t.colaboradores);
      // Quem estava sem nível entra no primeiro degrau.
      const primeiro = novos[0];
      const ajustados = colaboradores.map((c) => (c.nivelId || !primeiro ? c : { ...c, nivelId: primeiro.id }));
      for (const c of ajustados) {
        if (!colaboradores.find((x) => x.id === c.id)?.nivelId && c.nivelId) {
          await tx.update(t.colaboradores).set({ nivelId: c.nivelId }).where(eq(t.colaboradores.id, c.id));
        }
      }
      await registrarAtividades(
        [{ ...autor(ctx), acao: antes ? "edicao" : "criacao", entidade: "nivel", entidadeId: nivel.id, titulo: `Nível ${nivel.nome}`, antes, depois: nivel }],
        tx,
      );
      return aplicarPromocao(tx, ctx, ajustados, novos);
    });
    return comEquipe(ctx, liberados);
  });
}

const schemaConquista = z.object({
  id: schemaId.optional(),
  nome: z.string().trim().min(1, "Dê um nome à conquista.").max(80),
  descricao: z.string().trim().max(300),
  icone: z.string().trim().min(1).max(40),
  pontos: z.number().int().min(0).max(100_000),
  gatilho: z.enum(["meta_diaria", "meta_semanal", "meta_mensal", "domingo_feriado", "dias_trabalhados", "marco"]),
  repetivel: z.boolean(),
  criterio: z.string().trim().max(300),
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
        [{ ...autor(ctx), acao: antes ? "edicao" : "criacao", entidade: "conquista", entidadeId: conquista.id, titulo: `Conquista ${conquista.nome}`, antes: antes ?? null, depois: conquista }],
        tx,
      );
    });
    return comEquipe(ctx, conquista);
  });
}

/** Soma os pontos da conquista e devolve os bônus de nível liberados. */
export async function registrarConquista(
  colaboradorId: string,
  conquistaId: string,
): Promise<Resultado<{ equipe: DadosEquipe; extra: BonusNivel[] }>> {
  return executar(async () => {
    const ctx = await admin();
    const liberados = await db.transaction(async (tx) => {
      const [conquista] = await tx.select().from(t.conquistas).where(eq(t.conquistas.id, schemaId.parse(conquistaId))).limit(1);
      if (!conquista || !conquista.ativa) throw new ErroDeAcao("Conquista indisponível.");
      const colaboradores = await tx.select().from(t.colaboradores);
      const alvo = colaboradores.find((c) => c.id === colaboradorId);
      if (!alvo) throw new ErroDeAcao("Colaborador não encontrado.");
      if (!conquista.repetivel) {
        const ja = await tx
          .select({ id: t.conquistasDesbloqueadas.id })
          .from(t.conquistasDesbloqueadas)
          .where(and(eq(t.conquistasDesbloqueadas.colaboradorId, alvo.id), eq(t.conquistasDesbloqueadas.conquistaId, conquista.id)))
          .limit(1);
        if (ja.length > 0) throw new ErroDeAcao("Essa conquista não se repete e já foi registrada.");
      }
      const pontos = alvo.pontos + conquista.pontos;
      await tx.update(t.colaboradores).set({ pontos }).where(eq(t.colaboradores.id, alvo.id));
      await tx.insert(t.conquistasDesbloqueadas).values({ conquistaId: conquista.id, colaboradorId: alvo.id, desbloqueadaEm: agoraISO() });
      await registrarAtividades(
        [{ ...autor(ctx), acao: "conquista", entidade: "colaborador", entidadeId: alvo.id, titulo: `Conquista ${conquista.nome}`, antes: { pontos: alvo.pontos }, depois: { pontos } }],
        tx,
      );
      const niveis = await tx.select().from(t.niveis);
      return aplicarPromocao(tx, ctx, colaboradores.map((c) => (c.id === alvo.id ? { ...c, pontos } : c)), niveis);
    });
    return comEquipe(ctx, liberados);
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
    const [colaboradores, metas, niveis, bonusNivel, pedidos] = await Promise.all([
      db.select().from(t.colaboradores),
      db.select().from(t.metas),
      db.select().from(t.niveis),
      db.select().from(t.bonusNivel),
      carregarPedidos(),
    ]);
    const pagoEm = agoraISO();
    await db.transaction(async (tx) => {
      for (const item of lista) {
        const colaborador = colaboradores.find((c) => c.id === item.colaboradorId);
        if (!colaborador) throw new ErroDeAcao("Colaborador não encontrado.");
        const fechamento = calcularFechamento(colaborador, item.competencia, pedidos, { metas, niveis, bonusNivel });
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
