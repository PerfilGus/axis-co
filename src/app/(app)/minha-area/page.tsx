"use client";

import { useMemo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatNumero, formatPercentual } from "@/lib/format";
import { CONFIG_POR_PERFIL } from "@/lib/nav";
import { comissionavel, fechamentosDaCompetencia } from "@/lib/comissoes";
import {
  carteiraDe,
  desempenhoNo,
  diasComAtividade,
  taxaRecebimento,
} from "@/lib/desempenho";
import { metasDoColaborador } from "@/lib/metas";
import { conquistasNaJanela } from "@/lib/recompensas";
import { semanaDoColaborador, sequenciaDeDias } from "@/lib/minha-area";
import type { FontesMetricas } from "@/lib/metricas";
import {
  competenciaAtual,
  intervaloDoRanking,
  janelaCorrente,
  type Janela,
} from "@/lib/periodos";
import { classificarEquipe } from "@/lib/ranking";
import { useEquipe } from "@/lib/providers/equipe";
import { progressoNivel } from "@/lib/dominio/equipe";
import { usePedidos } from "@/lib/providers/pedidos";
import { useSessao } from "@/lib/providers/sessao";
import { Botao } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AvatarAnel } from "@/components/shared/avatar-anel";
import { EstadoVazio } from "@/components/shared/estado-vazio";
import { ExtratoPontos } from "@/components/shared/extrato-pontos";
import { TopoMinhaArea } from "@/components/minha-area/topo";
import { SemanaTrabalho } from "@/components/minha-area/semana";
import { MetaDoPeriodo } from "@/components/minha-area/meta-periodo";
import {
  CardConquistas,
  CardEquipe,
  CardNivel,
  CardRecompensas,
} from "@/components/minha-area/cartoes";

function Indicadores({ itens }: { itens: Array<{ valor: string; rotulo: string; dica?: string }> }) {
  return (
    <dl className="grid grid-cols-3 rounded-[var(--radius-card)] bg-surface-2 py-4">
      {itens.map((item, i) => (
        <div
          key={item.rotulo}
          className={cn(
            "flex flex-col-reverse items-center justify-end gap-1 px-2 text-center",
            i > 0 && "border-l border-border",
          )}
          title={item.dica}
        >
          <dt className="text-[11px] leading-tight text-muted-fg">{item.rotulo}</dt>
          <dd className="tabular text-xl leading-none font-medium tracking-tight">{item.valor}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function PaginaMinhaArea() {
  const { usuario, perfil } = useSessao();
  const { pedidos } = usePedidos();
  const {
    colaboradores,
    metas,
    niveis,
    conquistas,
    desbloqueadas,
    recompensas,
    recompensasLiberadas,
    lancamentos,
    bonusNivel,
    pagamentos,
  } = useEquipe();

  const ehCobrador = usuario.setor === "financeiro";

  const dados = useMemo(() => {
    const mes = intervaloDoRanking("mes");
    const competencia = competenciaAtual();
    const atividade = diasComAtividade(usuario, pedidos);
    const fontes: FontesMetricas = { pedidos, lancamentos, metas };
    const minhasMetas = metasDoColaborador(metas, usuario);
    const fechamento = comissionavel(usuario)
      ? (fechamentosDaCompetencia(competencia, [usuario], pagamentos, pedidos, {
          niveis,
          bonusNivel,
          recompensasLiberadas,
        })[0] ?? null)
      : null;

    const taxa = ehCobrador
      ? taxaRecebimento(carteiraDe(usuario, pedidos), mes)
      : desempenhoNo(usuario, pedidos, mes).frustracao;

    // As conquistas ao alcance: as das três janelas, as mais curtas primeiro.
    const janelas: Janela[] = [
      janelaCorrente("diaria"),
      janelaCorrente("semanal"),
      janelaCorrente("mensal"),
    ];
    const etapas = janelas
      .flatMap((janela) => conquistasNaJanela(usuario, conquistas, desbloqueadas, janela, fontes))
      .sort((a, b) => Number(b.feita) - Number(a.feita));

    return {
      fontes,
      atividade,
      minhasMetas,
      fechamento,
      taxa,
      diasNoMes: [...atividade].filter((d) => d.startsWith(competencia)).length,
      semana: semanaDoColaborador(usuario, metas, fontes, atividade),
      sequencia: sequenciaDeDias(atividade),
      etapas,
      premiosDoMes: recompensasLiberadas.filter(
        (l) => l.colaboradorId === usuario.id && l.janelaFim.slice(0, 7) === competencia,
      ),
      posicoes:
        ehCobrador || usuario.setor === "vendas"
          ? classificarEquipe(
              colaboradores,
              niveis,
              pedidos,
              mes,
              ehCobrador ? "financeiro" : "vendas",
              lancamentos,
            )
          : [],
    };
  }, [
    usuario,
    pedidos,
    metas,
    niveis,
    conquistas,
    desbloqueadas,
    recompensasLiberadas,
    lancamentos,
    bonusNivel,
    pagamentos,
    colaboradores,
    ehCobrador,
  ]);

  if (usuario.setor === "administracao") {
    return (
      <EstadoVazio
        icone="minhaArea"
        titulo="A Minha área é de quem vende e cobra"
        descricao="Metas, níveis e comissão são de vendedores e cobradores. Acompanhe a equipe pelo Ranking."
        acao={
          <Botao variante="principal" asChild>
            <Link href="/equipe/ranking">Abrir o ranking</Link>
          </Botao>
        }
      />
    );
  }

  const nivel = progressoNivel(niveis, usuario);
  const bonusPendente = bonusNivel.filter(
    (b) => b.colaboradorId === usuario.id && b.status === "liberado",
  );

  const usuarioArroba = `@${usuario.email.split("@")[0]}`;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 lg:max-w-5xl">
      <TopoMinhaArea
        hrefAjustes={CONFIG_POR_PERFIL[perfil][0].href}
        fechamento={dados.fechamento}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start lg:gap-8">
        <div className="flex min-w-0 flex-col gap-6">
          <section className="flex flex-col items-center gap-3 pt-2 text-center">
            <AvatarAnel
              nome={usuario.nome}
              imagemUrl={usuario.avatarUrl}
              progresso={nivel.progresso}
              tamanho={112}
            />
            <div className="flex flex-col gap-0.5">
              <h1 className="text-[26px] leading-tight font-medium tracking-tight">{usuario.nome}</h1>
              <p className="text-[13px] text-muted-fg">{usuarioArroba}</p>
            </div>
          </section>

          <Indicadores
            itens={[
              ehCobrador
                ? {
                    valor: dados.taxa === null ? "—" : formatPercentual(dados.taxa),
                    rotulo: "Recebimento",
                    dica: "Dos pedidos entregues no mês, quantos já foram pagos.",
                  }
                : {
                    valor: dados.taxa === null ? "—" : formatPercentual(dados.taxa),
                    rotulo: "Frustração",
                    dica: "Cancelados, reembolsados e inadimplentes entre os pedidos do mês.",
                  },
              { valor: nivel.atual?.nome ?? "—", rotulo: "Nível" },
              {
                valor: formatNumero(dados.diasNoMes),
                rotulo: dados.diasNoMes === 1 ? "Dia trabalhado" : "Dias trabalhados",
                dica: "Dias do mês com alguma ação sua num pedido.",
              },
            ]}
          />

          <SemanaTrabalho dias={dados.semana} />

          <MetaDoPeriodo
            colaborador={usuario}
            metas={dados.minhasMetas}
            recompensas={recompensas}
            liberadas={recompensasLiberadas}
            fontes={dados.fontes}
          />

          <Card className="flex flex-col gap-4 p-5">
            <h2 className="text-base font-medium tracking-tight">Extrato de pontos</h2>
            <ExtratoPontos colaboradorId={usuario.id} />
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <CardEquipe
            posicoes={dados.posicoes}
            usuarioId={usuario.id}
            criterio={ehCobrador ? "pagos" : "agendados"}
          />
          <CardConquistas etapas={dados.etapas} sequencia={dados.sequencia} />
          <CardRecompensas liberadas={dados.premiosDoMes} />
          <CardNivel
            colaborador={usuario}
            atual={nivel.atual}
            proximo={nivel.proximo}
            progresso={nivel.progresso}
            bonusPendente={bonusPendente}
            niveis={niveis}
          />
        </div>
      </div>
    </div>
  );
}
