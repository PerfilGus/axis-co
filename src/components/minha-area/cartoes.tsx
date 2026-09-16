import Link from "next/link";
import type { BonusNivel, Colaborador, Nivel } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatBRL, formatNumero } from "@/lib/format";
import type { EtapaConquista } from "@/lib/minha-area";
import type { PosicaoRanking } from "@/lib/ranking";
import { Icone, ICONES, type NomeIcone } from "@/components/icone";
import { Card } from "@/components/ui/card";
import { AvatarAnel } from "@/components/shared/avatar-anel";

const AVATARES_VISIVEIS = 4;

function TituloCard({ icone, children }: { icone: NomeIcone; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-base font-medium tracking-tight">
      <span className="flex size-8 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
        <Icone nome={icone} size={16} />
      </span>
      {children}
    </h2>
  );
}

/** Avatares sobrepostos da equipe e a posição no ranking do mês. Leva ao Ranking. */
export function CardEquipe({
  posicoes,
  usuarioId,
  criterio,
}: {
  posicoes: PosicaoRanking[];
  usuarioId: string;
  /** `agendados` ou `pagos`. */
  criterio: string;
}) {
  const indice = posicoes.findIndex((p) => p.colaborador.id === usuarioId);
  const visiveis = posicoes.slice(0, AVATARES_VISIVEIS);
  const resto = posicoes.length - visiveis.length;

  return (
    <Link
      href="/equipe/ranking"
      className="group block rounded-[var(--radius-card)]"
      aria-label={
        indice >= 0
          ? `Equipe: você está em ${indice + 1}º de ${posicoes.length}. Abrir o ranking`
          : "Equipe: abrir o ranking"
      }
    >
      <Card className="flex flex-col gap-4 p-5 transition-colors group-hover:border-border-strong">
        <div className="flex items-center justify-between gap-3">
          <TituloCard icone="equipe">Equipe</TituloCard>
          <Icone
            nome="expandir"
            size={16}
            className="text-muted-fg transition-colors group-hover:text-fg"
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center" aria-hidden>
            {visiveis.map((p, i) => (
              <span
                key={p.colaborador.id}
                className={cn("rounded-full ring-2 ring-surface-1", i > 0 && "-ml-3")}
                style={{ zIndex: visiveis.length - i }}
              >
                <AvatarAnel
                  nome={p.colaborador.nome}
                  imagemUrl={p.colaborador.avatarUrl}
                  tamanho={40}
                  mostrarAnel={false}
                />
              </span>
            ))}
            {resto > 0 && (
              <span className="-ml-3 flex size-10 items-center justify-center rounded-full bg-surface-3 text-xs font-medium ring-2 ring-surface-1">
                +{resto}
              </span>
            )}
          </div>
          {indice >= 0 ? (
            <div className="flex flex-col items-end">
              <span className="tabular text-2xl leading-none font-medium">
                {indice + 1}º
                <span className="text-sm font-normal text-muted-fg"> de {posicoes.length}</span>
              </span>
              <span className="mt-1 text-[11px] text-muted-fg">no mês, por {criterio}</span>
            </div>
          ) : (
            <span className="text-[13px] text-muted-fg">Fora do ranking</span>
          )}
        </div>
        {posicoes.length === 1 && indice === 0 && (
          <p className="text-[13px] text-muted-fg">
            Você é o único do setor por enquanto. O ranking ganha graça com mais gente.
          </p>
        )}
      </Card>
    </Link>
  );
}

function iconeDaConquista(icone: string): NomeIcone {
  return icone in ICONES ? (icone as NomeIcone) : "medalha";
}

/** Sequência atual e as conquistas ao alcance, com check nas já feitas. */
export function CardConquistas({
  etapas,
  sequencia,
}: {
  etapas: EtapaConquista[];
  sequencia: number;
}) {
  const feitas = etapas.filter((e) => e.feita).length;
  const emAberto = etapas.filter((e) => !e.feita).reduce((s, e) => s + e.conquista.pontos, 0);

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TituloCard icone="medalha">Próximas conquistas</TituloCard>
        <span
          className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-[13px] whitespace-nowrap"
          title="Dias seguidos com atividade"
        >
          <Icone nome="tendencia" size={14} className="text-[var(--accent)]" />
          <span className="tabular font-medium">{formatNumero(sequencia)}</span>
          <span className="text-muted-fg">{sequencia === 1 ? "dia seguido" : "dias seguidos"}</span>
        </span>
      </div>

      {etapas.length === 0 ? (
        <p className="text-[13px] text-muted-fg">
          Nenhuma conquista ao seu alcance agora. Quando o Admin ativar novas, elas aparecem aqui.
        </p>
      ) : (
        <>
          <ol className="scrollbar-none -mx-5 flex overflow-x-auto px-5 pb-1">
            {etapas.map((etapa, i) => {
              const ultima = i === etapas.length - 1;
              return (
                <li
                  key={etapa.conquista.id}
                  className="flex min-w-18 flex-1 items-start last:flex-none"
                  aria-label={`${etapa.conquista.nome}: ${etapa.feita ? "feita" : "a fazer"}, ${etapa.conquista.pontos} pontos. ${etapa.conquista.criterio}`}
                >
                  <div className="flex w-18 shrink-0 flex-col items-center gap-1.5 text-center">
                    <span
                      className={cn(
                        "flex size-9 items-center justify-center rounded-full",
                        etapa.feita
                          ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                          : "border border-dashed border-border-strong text-muted-fg",
                      )}
                      title={etapa.conquista.criterio}
                    >
                      {etapa.feita ? (
                        <Icone nome="check" size={16} weight="bold" />
                      ) : (
                        <Icone nome={iconeDaConquista(etapa.conquista.icone)} size={15} />
                      )}
                    </span>
                    <span
                      className={cn(
                        "line-clamp-2 text-[11px] leading-tight",
                        etapa.feita ? "text-fg" : "text-muted-fg",
                      )}
                    >
                      {etapa.conquista.nome}
                    </span>
                    <span className="tabular text-[10px] text-muted-fg">
                      +{formatNumero(etapa.conquista.pontos)} pts
                      {etapa.janela ? ` · ${etapa.janela}` : ""}
                    </span>
                  </div>
                  {!ultima && (
                    <span
                      className={cn(
                        "mt-[18px] h-px min-w-3 flex-1",
                        etapa.feita && etapas[i + 1]?.feita ? "bg-[var(--accent)]" : "bg-border",
                      )}
                      aria-hidden
                    />
                  )}
                </li>
              );
            })}
          </ol>
          <p className="text-[13px] text-muted-fg">
            <span className="tabular font-medium text-fg">
              {feitas} de {etapas.length}
            </span>{" "}
            feitas na janela de cada uma
            {emAberto > 0 && (
              <>
                {" "}
                · ainda dá para somar{" "}
                <span className="tabular font-medium text-fg">+{formatNumero(emAberto)} pts</span>
              </>
            )}
            .
          </p>
        </>
      )}
    </Card>
  );
}

/** Pontos, quanto falta para o próximo nível e o bônus que vem com ele. */
export function CardNivel({
  colaborador,
  atual,
  proximo,
  progresso,
  bonusPendente,
  niveis,
}: {
  colaborador: Colaborador;
  atual: Nivel | null;
  proximo: Nivel | null;
  progresso: number;
  bonusPendente: BonusNivel[];
  niveis: Nivel[];
}) {
  if (!atual) {
    return (
      <Card className="flex flex-col gap-2 p-5">
        <TituloCard icone="ranking">Nível</TituloCard>
        <p className="text-[13px] text-muted-fg">
          A trilha de níveis ainda não foi configurada. Peça ao Admin para cadastrar os níveis.
        </p>
      </Card>
    );
  }

  const faltam = proximo ? Math.max(proximo.pontosNecessarios - colaborador.pontos, 0) : 0;

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <TituloCard icone={iconeDaConquista(atual.icone)}>Nível {atual.nome}</TituloCard>
        <span className="tabular text-[13px] text-muted-fg">
          {atual.ordem} de {niveis.length}
        </span>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col">
          <span className="tabular text-[28px] leading-none font-medium tracking-tight">
            {formatNumero(colaborador.pontos)}
          </span>
          <span className="mt-1 text-[11px] text-muted-fg">pontos acumulados</span>
        </div>
        {proximo && (
          <div className="flex flex-col items-end text-right">
            <span className="tabular text-base leading-none font-medium">
              {formatNumero(faltam)}
            </span>
            <span className="mt-1 text-[11px] text-muted-fg">para {proximo.nome}</span>
          </div>
        )}
      </div>

      <div
        role="progressbar"
        aria-label={proximo ? `Progresso até ${proximo.nome}` : "Trilha concluída"}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progresso * 100)}
        className="h-2 w-full overflow-hidden rounded-full bg-surface-3"
      >
        <div
          className="h-full rounded-full bg-[var(--accent)]"
          style={{ width: `${progresso * 100}%` }}
        />
      </div>

      {proximo ? (
        <div className="flex items-center justify-between gap-3 rounded-[var(--radius-input)] bg-surface-2 px-4 py-3">
          <span className="text-[13px] text-muted-fg">Bônus ao chegar a {proximo.nome}</span>
          <span className="tabular text-sm font-medium">
            {proximo.bonus > 0 ? formatBRL(proximo.bonus) : "Sem bônus"}
          </span>
        </div>
      ) : (
        <p className="text-[13px] text-muted-fg">
          Você chegou ao topo da trilha. Os pontos seguem somando.
        </p>
      )}

      {bonusPendente.map((b) => (
        <div key={b.id} className="flex items-start gap-2 text-[13px]">
          <Icone nome="pix" size={14} className="mt-0.5 shrink-0 text-[var(--accent)]" />
          <p>
            Bônus de {niveis.find((n) => n.id === b.nivelId)?.nome ?? "nível"} liberado:{" "}
            <span className="tabular font-medium">{formatBRL(b.valor)}</span>{" "}
            <span className="text-muted-fg">· aguardando o Pix</span>
          </p>
        </div>
      ))}
    </Card>
  );
}
