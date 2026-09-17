"use server";

import { z } from "zod";
import { agoraISO } from "@/lib/iso";
import { DEFINICAO_NOTIFICACAO, ehTipoNotificacao, preferenciaDe, type EstadoNotificacoes } from "@/lib/notificacoes";
import { db } from "@/lib/servidor/db";
import * as t from "@/lib/servidor/schema";
import { registrarAtividades } from "@/lib/servidor/atividades";
import { carregarNotificacoes, preferenciasDe } from "@/lib/servidor/notificacoes";
import { ErroDeAcao, executar, exigirUsuario, type Resultado } from "@/lib/servidor/sessao";
import { schemaId } from "./validacao";

/**
 * Leitura e preferências de notificação. Marcar como lida é estado de tela de
 * cada um, não evento do negócio: não grava atividade. Mudar preferência grava.
 */

export async function marcarNotificacoesLidas(ids: string[]): Promise<Resultado<EstadoNotificacoes>> {
  return executar(async () => {
    const ctx = await exigirUsuario();
    const lista = z.array(schemaId).min(1).max(200).parse(ids);
    const agora = agoraISO();
    await db
      .insert(t.notificacoesLidas)
      .values(lista.map((atividadeId) => ({ usuarioId: ctx.colaborador.id, atividadeId, lidaEm: agora })))
      .onConflictDoNothing();
    return carregarNotificacoes(ctx.colaborador);
  });
}

/**
 * Marca como lido tudo o que foi registrado até `ate` — a notificação mais nova
 * que a tela mostrava. O que chegou depois continua não lido.
 */
export async function marcarTodasLidas(ate: string): Promise<Resultado<EstadoNotificacoes>> {
  return executar(async () => {
    const ctx = await exigirUsuario();
    const instante = new Date(z.string().max(40).parse(ate));
    if (Number.isNaN(instante.getTime())) throw new ErroDeAcao("Data inválida.");
    const agora = agoraISO();
    const lidasAte = instante.getTime() > Date.now() ? agora : ate;
    await db
      .insert(t.notificacoesEstado)
      .values({ usuarioId: ctx.colaborador.id, lidasAte })
      .onConflictDoUpdate({ target: t.notificacoesEstado.usuarioId, set: { lidasAte } });
    return carregarNotificacoes(ctx.colaborador);
  });
}

const schemaPreferencia = z.object({
  tipo: z.string().refine(ehTipoNotificacao, "Tipo de notificação desconhecido."),
  noApp: z.boolean(),
  push: z.boolean(),
});

export async function salvarPreferenciaNotificacao(
  entrada: z.input<typeof schemaPreferencia>,
): Promise<Resultado<EstadoNotificacoes>> {
  return executar(async () => {
    const ctx = await exigirUsuario();
    const dados = schemaPreferencia.parse(entrada);
    const tipo = dados.tipo as keyof typeof DEFINICAO_NOTIFICACAO;
    if (!DEFINICAO_NOTIFICACAO[tipo].perfis.includes(ctx.colaborador.perfil)) {
      throw new ErroDeAcao("Esse aviso não existe para o seu perfil.");
    }
    // Push sem aviso no app não faz sentido: desligar o app desliga o push.
    const nova = { noApp: dados.noApp, push: dados.noApp && dados.push };
    const antes = preferenciaDe(await preferenciasDe(ctx.colaborador.id), tipo);
    const agora = agoraISO();

    await db.transaction(async (tx) => {
      await tx
        .insert(t.preferenciasNotificacao)
        .values({ usuarioId: ctx.colaborador.id, tipo, ...nova, atualizadoEm: agora })
        .onConflictDoUpdate({
          target: [t.preferenciasNotificacao.usuarioId, t.preferenciasNotificacao.tipo],
          set: { ...nova, atualizadoEm: agora },
        });
      await registrarAtividades(
        [
          {
            usuarioId: ctx.colaborador.id,
            papel: ctx.colaborador.perfil,
            acao: "edicao",
            entidade: "preferencia_notificacao",
            entidadeId: tipo,
            titulo: `Preferência de aviso: ${DEFINICAO_NOTIFICACAO[tipo].rotulo}`,
            antes: { noApp: antes.noApp, push: antes.push },
            depois: nova,
          },
        ],
        tx,
      );
    });
    return carregarNotificacoes(ctx.colaborador);
  });
}
