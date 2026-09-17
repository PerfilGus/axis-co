"use client";

import { useMemo, useState } from "react";
import type { Colaborador, Setor } from "@/lib/types";
import { ROTULO_SETOR } from "@/lib/types";
import { formatBps, formatBRL, formatNumero } from "@/lib/format";
import { useEquipe } from "@/lib/providers/equipe";
import { progressoNivel } from "@/lib/dominio/equipe";
import { useSessao } from "@/lib/providers/sessao";
import { Icone } from "@/components/icone";
import { Botao } from "@/components/ui/button";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { AvatarAnel } from "@/components/shared/avatar-anel";
import { LinhaIndicadores } from "@/components/shared/indicadores";
import { SeloTom } from "@/components/shared/selo-status";
import { Tabela, type ColunaTabela, type FiltroTabela } from "@/components/shared/tabela";
import { ModalColaborador } from "@/components/equipe/modal-colaborador";
import { GavetaColaborador } from "@/components/equipe/gaveta-colaborador";

export default function PaginaEquipeColaboradores() {
  const { colaboradores, niveis, bonusNivel } = useEquipe();
  const { ehAdmin } = useSessao();
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [edicao, setEdicao] = useState<{ colaborador: Colaborador | null } | null>(null);

  // Administração não passa por este cadastro: não tem setor comissionado.
  const equipe = useMemo(
    () => colaboradores.filter((c) => c.setor !== "administracao"),
    [colaboradores],
  );

  const colunas: Array<ColunaTabela<Colaborador>> = useMemo(
    () => [
      {
        chave: "nome",
        titulo: "Colaborador",
        ordenarPor: (c) => c.nome,
        render: (c) => {
          const { progresso } = progressoNivel(niveis, c);
          return (
            <div className="flex items-center gap-3">
              <AvatarAnel nome={c.nome} imagemUrl={c.avatarUrl} progresso={progresso} tamanho={40} />
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{c.nome}</span>
                <span className="truncate text-[11px] text-muted-fg">{c.email}</span>
              </div>
            </div>
          );
        },
      },
      {
        chave: "setor",
        titulo: "Setor",
        ordenarPor: (c) => c.setor,
        render: (c) => (
          <div className="flex flex-col">
            <span>{ROTULO_SETOR[c.setor]}</span>
            <span className="text-[11px] text-muted-fg">
              {c.setor === "financeiro"
                ? `${c.vendedoresAtribuidos.length} ${c.vendedoresAtribuidos.length === 1 ? "vendedor" : "vendedores"}`
                : "Vendedor"}
            </span>
          </div>
        ),
      },
      {
        chave: "nivel",
        titulo: "Nível",
        ordenarPor: (c) => c.pontos,
        render: (c) => {
          const { atual } = progressoNivel(niveis, c);
          const pendente = bonusNivel.some((b) => b.colaboradorId === c.id && b.status === "liberado");
          return (
            <div className="flex flex-col gap-1">
              <span className="flex items-center gap-1.5">
                {atual?.nome ?? "—"}
                {pendente && (
                  <span
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: "var(--st-bronze-fg)" }}
                    title="Bônus de nível aguardando pagamento"
                  />
                )}
              </span>
              <span className="tabular text-[11px] text-muted-fg">{formatNumero(c.pontos)} pts</span>
            </div>
          );
        },
      },
      {
        chave: "remuneracao",
        titulo: "Remuneração",
        escondeEm: "md",
        alinhamento: "direita",
        ordenarPor: (c) => c.salarioFixo,
        render: (c) => (
          <div className="flex flex-col items-end">
            <span className="tabular">{formatBRL(c.salarioFixo)}</span>
            <span className="tabular text-[11px] text-muted-fg">
              {formatBps(c.comissaoBps)}
              {c.setor === "vendas" && c.frustradoBps !== null
                ? ` · frustrado ${formatBps(c.frustradoBps, 0)}`
                : " do recebido"}
            </span>
          </div>
        ),
      },
      {
        chave: "status",
        titulo: "Status",
        alinhamento: "direita",
        ordenarPor: (c) => (c.ativo ? 0 : 1),
        render: (c) =>
          c.ativo ? <SeloTom tom="verde">Ativo</SeloTom> : <SeloTom tom="cinza">Inativo</SeloTom>,
      },
    ],
    [niveis, bonusNivel],
  );

  const filtros: Array<FiltroTabela<Colaborador>> = useMemo(
    () => [
      {
        chave: "setor",
        rotulo: "Setor",
        opcoes: (["vendas", "financeiro"] as Setor[]).map((s) => ({ valor: s, rotulo: ROTULO_SETOR[s] })),
        aplicar: (c, v) => c.setor === v,
      },
      {
        chave: "status",
        rotulo: "Status",
        opcoes: [
          { valor: "ativo", rotulo: "Ativos" },
          { valor: "inativo", rotulo: "Inativos" },
        ],
        aplicar: (c, v) => (v === "ativo" ? c.ativo : !c.ativo),
      },
    ],
    [],
  );

  const aberto = equipe.find((c) => c.id === abertoId) ?? null;
  const ativos = equipe.filter((c) => c.ativo);
  const folha = ativos.reduce((s, c) => s + c.salarioFixo, 0);
  const bonusPendentes = bonusNivel.filter((b) => b.status === "liberado");

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Colaboradores"
        descricao="Quem é quem, quanto ganha e as regras de comissão de cada um."
        acao={
          ehAdmin ? (
            <Botao variante="principal" onClick={() => setEdicao({ colaborador: null })}>
              <Icone nome="adicionar" size={16} />
              Novo colaborador
            </Botao>
          ) : undefined
        }
      />

      <LinhaIndicadores
        itens={[
          { icone: "colaboradores", valor: String(ativos.length), rotulo: "Ativos" },
          {
            icone: "pedidos",
            valor: String(ativos.filter((c) => c.setor === "vendas").length),
            rotulo: "Vendedores",
          },
          {
            icone: "cobranca",
            valor: String(ativos.filter((c) => c.setor === "financeiro").length),
            rotulo: "Cobradores",
          },
          { icone: "dinheiro", valor: formatBRL(folha), rotulo: "Folha fixa mensal" },
          {
            icone: "medalha",
            valor: formatBRL(bonusPendentes.reduce((s, b) => s + b.valor, 0)),
            rotulo: "Bônus de nível a pagar",
          },
        ]}
      />

      <Tabela
        dados={equipe}
        colunas={colunas}
        filtros={filtros}
        buscarEm={(c) => [c.nome, c.email, c.apelido]}
        placeholderBusca="Buscar por nome ou e-mail"
        aoClicarLinha={(c) => setAbertoId(c.id)}
      />

      <GavetaColaborador
        colaborador={aberto}
        aberto={aberto !== null && edicao === null}
        aoFechar={() => setAbertoId(null)}
        aoEditar={() => aberto && setEdicao({ colaborador: aberto })}
      />

      <ModalColaborador
        aberto={edicao !== null}
        colaborador={edicao?.colaborador ?? null}
        aoFechar={() => setEdicao(null)}
      />
    </div>
  );
}
