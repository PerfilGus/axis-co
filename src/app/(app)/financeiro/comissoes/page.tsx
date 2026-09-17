"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { LinhaDetalhe, PagamentoColaborador } from "@/lib/types";
import { ROTULO_SETOR } from "@/lib/types";
import { formatBRL, formatCompetencia, formatData } from "@/lib/format";
import { STATUS_PAGAMENTO_COLABORADOR } from "@/lib/status";
import { comissionavel, fechamentosDaCompetencia } from "@/lib/comissoes";
import { competenciaAtual, ultimasCompetencias } from "@/lib/periodos";
import { useEquipe } from "@/lib/providers/equipe";
import { progressoNivel } from "@/lib/dominio/equipe";
import { usePedidos } from "@/lib/providers/pedidos";
import { useSessao } from "@/lib/providers/sessao";
import { Icone } from "@/components/icone";
import { Botao } from "@/components/ui/button";
import { Gaveta, GavetaCabecalho, GavetaConteudo, GavetaCorpo, GavetaRodape } from "@/components/ui/drawer";
import {
  Selecao,
  SelecaoConteudo,
  SelecaoGatilho,
  SelecaoItem,
  SelecaoValor,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { AvatarAnel } from "@/components/shared/avatar-anel";
import { LinhaIndicadores } from "@/components/shared/indicadores";
import { ModalConfirmacao } from "@/components/shared/modal-confirmacao";
import { SeloTom } from "@/components/shared/selo-status";
import { Tabela, type ColunaTabela, type FiltroTabela } from "@/components/shared/tabela";

const GRUPOS: Array<{ grupo: LinhaDetalhe["grupo"]; titulo: string; vazio: string }> = [
  { grupo: "fixo", titulo: "Fixo", vazio: "Sem salário fixo." },
  { grupo: "comissao", titulo: "Comissão calculada", vazio: "Sem comissão." },
  { grupo: "bonus_meta", titulo: "Recompensas", vazio: "Nenhuma recompensa liberada na competência." },
  { grupo: "bonus_nivel", titulo: "Bônus de nível", vazio: "Nenhum nível alcançado na competência." },
];

/** `setembro de 2026` → `Setembro de 2026`. */
function maiuscula(texto: string) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function Valor({ centavos }: { centavos: number }) {
  return (
    <span className={cn("tabular", centavos === 0 && "text-muted-fg/60")}>{formatBRL(centavos)}</span>
  );
}

function Detalhamento({
  fechamento,
  aoFechar,
  aoPagar,
}: {
  fechamento: PagamentoColaborador | null;
  aoFechar: () => void;
  aoPagar: (fechamento: PagamentoColaborador) => void;
}) {
  const { colaboradores, niveis } = useEquipe();
  const { ehAdmin } = useSessao();
  const colaborador = fechamento
    ? colaboradores.find((c) => c.id === fechamento.colaboradorId)
    : null;

  return (
    <Gaveta open={fechamento !== null} onOpenChange={(v) => !v && aoFechar()}>
      <GavetaConteudo larguraMaxima="sm:max-w-xl">
        {fechamento && colaborador && (
          <>
            <GavetaCabecalho
              titulo={
                <span className="flex items-center gap-3">
                  <AvatarAnel
                    nome={colaborador.nome}
                    imagemUrl={colaborador.avatarUrl}
                    progresso={progressoNivel(niveis, colaborador).progresso}
                    tamanho={40}
                  />
                  <span className="truncate">{colaborador.nome}</span>
                </span>
              }
              descricao={`${ROTULO_SETOR[colaborador.setor]} · competência de ${formatCompetencia(fechamento.competencia)}`}
            />
            <GavetaCorpo className="flex flex-col gap-6">
              <div className="flex items-end justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-[13px] text-muted-fg">Total</span>
                  <span className="tabular text-3xl font-medium tracking-tight">
                    {formatBRL(fechamento.total)}
                  </span>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <SeloTom tom={STATUS_PAGAMENTO_COLABORADOR[fechamento.status].tom}>
                    {STATUS_PAGAMENTO_COLABORADOR[fechamento.status].rotulo}
                  </SeloTom>
                  <span className="text-xs text-muted-fg">
                    {fechamento.status === "pago"
                      ? `Pago em ${formatData(fechamento.pagoEm)}`
                      : `Pagar em ${formatData(fechamento.pagarEm)}`}
                  </span>
                </div>
              </div>

              {fechamento.status === "pendente" && fechamento.competencia === competenciaAtual() && (
                <p className="flex items-start gap-2 rounded-[var(--radius-card-sm)] bg-surface-2 px-4 py-3 text-[13px] text-muted-fg">
                  <Icone nome="relogio" size={15} className="mt-0.5 shrink-0" />
                  Competência em aberto: os valores mudam a cada pedido enviado ou pago até o fim do mês.
                </p>
              )}
              {fechamento.status === "pago" && (
                <p className="flex items-start gap-2 rounded-[var(--radius-card-sm)] bg-surface-2 px-4 py-3 text-[13px] text-muted-fg">
                  <Icone nome="info" size={15} className="mt-0.5 shrink-0" />
                  Valores congelados quando o pagamento foi marcado. Mudar regras agora não altera este
                  fechamento.
                </p>
              )}

              {GRUPOS.map(({ grupo, titulo, vazio }) => {
                const linhas = fechamento.detalhamento.filter((l) => l.grupo === grupo);
                const soma = linhas.filter((l) => !l.informativa).reduce((s, l) => s + l.valor, 0);
                return (
                  <section key={grupo} className="flex flex-col gap-2">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="text-[13px] font-medium text-muted-fg">{titulo}</h3>
                      <span className="tabular text-sm font-medium">{formatBRL(soma)}</span>
                    </div>
                    {linhas.length === 0 ? (
                      <p className="text-[13px] text-muted-fg/80">{vazio}</p>
                    ) : (
                      <ul className="flex flex-col rounded-[var(--radius-card-sm)] border border-border">
                        {linhas.map((linha, i) => (
                          <li
                            key={`${linha.rotulo}-${i}`}
                            className={cn(
                              "flex items-start justify-between gap-4 px-4 py-2.5",
                              i > 0 && "border-t border-border",
                            )}
                          >
                            <div className="flex min-w-0 flex-col">
                              <span className="text-[13px]">{linha.rotulo}</span>
                              {linha.conta && (
                                <span className="tabular text-xs text-muted-fg">{linha.conta}</span>
                              )}
                            </div>
                            <span
                              className={cn(
                                "tabular shrink-0 text-[13px] font-medium",
                                linha.informativa && "text-muted-fg line-through",
                              )}
                            >
                              {formatBRL(linha.valor)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                );
              })}

              <div className="flex items-baseline justify-between border-t border-border pt-4">
                <span className="text-sm font-medium">Total</span>
                <span className="tabular text-lg font-medium">{formatBRL(fechamento.total)}</span>
              </div>
              <p className="text-xs text-muted-fg">
                Pix para {colaborador.chavePix ?? "chave não cadastrada"}.
              </p>
            </GavetaCorpo>
            {ehAdmin && fechamento.status === "pendente" && (
              <GavetaRodape>
                <Botao variante="principal" onClick={() => aoPagar(fechamento)}>
                  <Icone nome="check" size={15} />
                  Marcar como pago
                </Botao>
              </GavetaRodape>
            )}
          </>
        )}
      </GavetaConteudo>
    </Gaveta>
  );
}

export default function PaginaFinanceiroComissoes() {
  const equipe = useEquipe();
  const { colaboradores, pagamentos, niveis, marcarComoPago, nomeDe } = equipe;
  const { pedidos } = usePedidos();
  const { ehAdmin } = useSessao();

  const competencias = useMemo(() => ultimasCompetencias(3), []);
  const [competencia, setCompetencia] = useState(competencias[0]);
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [pagando, setPagando] = useState<PagamentoColaborador | null>(null);

  // Pago vem congelado do registro; pendente é recalculado dos pedidos.
  const fechamentos = useMemo<PagamentoColaborador[]>(
    () => fechamentosDaCompetencia(competencia, colaboradores, pagamentos, pedidos, equipe),
    [pagamentos, colaboradores, competencia, pedidos, equipe],
  );

  const colunas: Array<ColunaTabela<PagamentoColaborador>> = useMemo(
    () => [
      {
        chave: "colaborador",
        titulo: "Colaborador",
        ordenarPor: (f) => nomeDe(f.colaboradorId),
        render: (f) => {
          const c = colaboradores.find((x) => x.id === f.colaboradorId);
          return (
            <div className="flex items-center gap-3">
              <AvatarAnel
                nome={c?.nome ?? "?"}
                imagemUrl={c?.avatarUrl}
                progresso={c ? progressoNivel(niveis, c).progresso : 0}
                tamanho={36}
              />
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{c?.nome ?? "—"}</span>
                <span className="text-[11px] text-muted-fg">{c ? ROTULO_SETOR[c.setor] : ""}</span>
              </div>
            </div>
          );
        },
      },
      {
        chave: "fixo",
        titulo: "Fixo",
        alinhamento: "direita",
        escondeEm: "lg",
        ordenarPor: (f) => f.fixo,
        render: (f) => <Valor centavos={f.fixo} />,
      },
      {
        chave: "comissao",
        titulo: "Comissão",
        alinhamento: "direita",
        escondeEm: "md",
        ordenarPor: (f) => f.comissao,
        render: (f) => <Valor centavos={f.comissao} />,
      },
      {
        chave: "bonusMeta",
        titulo: "Recompensas",
        alinhamento: "direita",
        escondeEm: "lg",
        ordenarPor: (f) => f.bonusMeta,
        render: (f) => <Valor centavos={f.bonusMeta} />,
      },
      {
        chave: "bonusNivel",
        titulo: "Bônus de nível",
        alinhamento: "direita",
        escondeEm: "lg",
        ordenarPor: (f) => f.bonusNivel,
        render: (f) => <Valor centavos={f.bonusNivel} />,
      },
      {
        chave: "total",
        titulo: "Total",
        alinhamento: "direita",
        ordenarPor: (f) => f.total,
        render: (f) => <span className="tabular font-medium">{formatBRL(f.total)}</span>,
      },
      {
        chave: "data",
        titulo: "Pagamento",
        alinhamento: "direita",
        escondeEm: "sm",
        ordenarPor: (f) => f.pagoEm ?? f.pagarEm,
        render: (f) => (
          <span className="tabular text-muted-fg">{formatData(f.pagoEm ?? f.pagarEm)}</span>
        ),
      },
      {
        chave: "status",
        titulo: "Status",
        alinhamento: "direita",
        ordenarPor: (f) => f.status,
        render: (f) =>
          f.status === "pendente" && ehAdmin ? (
            <Botao
              variante="destaqueSuave"
              tamanho="sm"
              onClick={(e) => {
                e.stopPropagation();
                setPagando(f);
              }}
            >
              Marcar como pago
            </Botao>
          ) : (
            <SeloTom tom={STATUS_PAGAMENTO_COLABORADOR[f.status].tom}>
              {STATUS_PAGAMENTO_COLABORADOR[f.status].rotulo}
            </SeloTom>
          ),
      },
    ],
    [colaboradores, niveis, nomeDe, ehAdmin],
  );

  const filtros: Array<FiltroTabela<PagamentoColaborador>> = useMemo(
    () => [
      {
        chave: "colaborador",
        rotulo: "Colaborador",
        opcoes: colaboradores
          .filter(comissionavel)
          .map((c) => ({ valor: c.id, rotulo: c.nome })),
        aplicar: (f, v) => f.colaboradorId === v,
      },
      {
        chave: "status",
        rotulo: "Status",
        opcoes: [
          { valor: "pendente", rotulo: "Pendentes" },
          { valor: "pago", rotulo: "Pagos" },
        ],
        aplicar: (f, v) => f.status === v,
      },
    ],
    [colaboradores],
  );

  const total = fechamentos.reduce((s, f) => s + f.total, 0);
  const pendente = fechamentos.filter((f) => f.status === "pendente").reduce((s, f) => s + f.total, 0);
  const aberto = fechamentos.find((f) => f.id === abertoId) ?? null;
  const emAberto = competencia === competenciaAtual();

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Comissões e pagamentos"
        descricao="Fixo, comissão e bônus de cada colaborador, competência a competência."
        extras={
          <Selecao value={competencia} onValueChange={setCompetencia}>
            <SelecaoGatilho className="w-auto min-w-48 rounded-full">
              <SelecaoValor />
            </SelecaoGatilho>
            <SelecaoConteudo>
              {competencias.map((c, i) => (
                <SelecaoItem key={c} value={c}>
                  {maiuscula(formatCompetencia(c))}
                  {i === 0 ? " (em aberto)" : ""}
                </SelecaoItem>
              ))}
            </SelecaoConteudo>
          </Selecao>
        }
      />

      <LinhaIndicadores
        itens={[
          { icone: "comissoes", valor: formatBRL(total), rotulo: "Total da competência" },
          { icone: "relogio", valor: formatBRL(pendente), rotulo: "Pendente" },
          { icone: "checkCircle", valor: formatBRL(total - pendente), rotulo: "Pago" },
          {
            icone: "colaboradores",
            valor: `${fechamentos.filter((f) => f.status === "pago").length} de ${fechamentos.length}`,
            rotulo: "Fechamentos pagos",
          },
        ]}
      />

      {emAberto && (
        <p className="text-[13px] text-muted-fg">
          Competência em aberto: pendentes são recalculados a cada pedido enviado ou pago.
        </p>
      )}

      <Tabela
        dados={fechamentos}
        colunas={colunas}
        filtros={filtros}
        aoClicarLinha={(f) => setAbertoId(f.id)}
      />

      <Detalhamento
        fechamento={aberto}
        aoFechar={() => setAbertoId(null)}
        aoPagar={(f) => setPagando(f)}
      />

      <ModalConfirmacao
        aberto={pagando !== null}
        titulo="Marcar como pago?"
        mensagem={
          pagando?.competencia === competenciaAtual()
            ? "A competência ainda está em aberto. Pagar agora congela os valores de hoje."
            : "Confirme depois de o Pix ter saído. Os valores ficam congelados."
        }
        itens={
          pagando
            ? [
                nomeDe(pagando.colaboradorId),
                `Fixo ${formatBRL(pagando.fixo)} · comissão ${formatBRL(pagando.comissao)}`,
                `Recompensas ${formatBRL(pagando.bonusMeta)} · bônus de nível ${formatBRL(pagando.bonusNivel)}`,
                `Total: ${formatBRL(pagando.total)}`,
                `Pix: ${colaboradores.find((c) => c.id === pagando.colaboradorId)?.chavePix ?? "sem chave"}`,
              ]
            : []
        }
        icone="check"
        rotuloConfirmar="Marcar como pago"
        aoCancelar={() => setPagando(null)}
        aoConfirmar={async () => {
          if (!pagando) return;
          if (!(await marcarComoPago([{ colaboradorId: pagando.colaboradorId, competencia: pagando.competencia }]))) return;
          toast.success("Pagamento registrado", {
            description: `${formatBRL(pagando.total)} para ${nomeDe(pagando.colaboradorId)}${pagando.bonusNivelIds.length > 0 ? ", com o bônus de nível" : ""}.`,
          });
          setPagando(null);
        }}
      />
    </div>
  );
}
