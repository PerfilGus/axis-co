"use client";

import { useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Icone } from "@/components/icone";
import { Botao } from "@/components/ui/button";
import {
  Selecao,
  SelecaoConteudo,
  SelecaoGatilho,
  SelecaoItem,
  SelecaoValor,
} from "@/components/ui/select";
import { CampoBusca } from "./campo-busca";
import { EstadoVazio } from "./estado-vazio";

export interface ColunaTabela<T> {
  chave: string;
  titulo: string;
  render: (linha: T) => ReactNode;
  /** Valores monetários e numéricos alinham à direita. */
  alinhamento?: "esquerda" | "direita" | "centro";
  ordenarPor?: (linha: T) => string | number;
  classe?: string;
  /** Some em telas estreitas para a tabela caber. */
  escondeEm?: "sm" | "md" | "lg";
}

export interface FiltroTabela<T> {
  chave: string;
  rotulo: string;
  opcoes: Array<{ valor: string; rotulo: string }>;
  aplicar: (linha: T, valor: string) => boolean;
}

const CLASSE_ESCONDE = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
} as const;

/**
 * Tabela com busca e filtros. Ordenação e filtragem vivem no cliente, sobre o
 * que o servidor carregou; a assinatura já aceita a troca por paginação de
 * servidor sem mudar as telas.
 *
 * Desenha as primeiras `porPagina` linhas e oferece mostrar mais: o histórico
 * de pedidos passa de mil registros.
 */
export function Tabela<T extends { id: string }>({
  dados,
  colunas,
  filtros = [],
  buscarEm,
  placeholderBusca = "Buscar",
  aoClicarLinha,
  vazio,
  acoes,
  className,
  densidade = "normal",
  porPagina = 50,
  rodape,
}: {
  dados: T[];
  colunas: Array<ColunaTabela<T>>;
  filtros?: Array<FiltroTabela<T>>;
  buscarEm?: (linha: T) => Array<string | null | undefined>;
  placeholderBusca?: string;
  aoClicarLinha?: (linha: T) => void;
  vazio?: ReactNode;
  acoes?: ReactNode;
  className?: string;
  densidade?: "normal" | "compacta";
  porPagina?: number;
  /** Linha de totais, desenhada no `tfoot` com as mesmas colunas. */
  rodape?: (visiveis: T[]) => Partial<Record<string, ReactNode>>;
}) {
  const [busca, setBusca] = useState("");
  const [selecionados, setSelecionados] = useState<Record<string, string>>({});
  const [ordem, setOrdem] = useState<{ chave: string; desc: boolean } | null>(null);
  // O limite volta ao início quando a busca, o filtro ou a ordem mudam.
  const assinatura = JSON.stringify([busca, selecionados, ordem, dados.length]);
  const [pagina, setPagina] = useState({ assinatura, limite: porPagina });
  const limite = pagina.assinatura === assinatura ? pagina.limite : porPagina;

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    let lista = dados;

    if (termo && buscarEm) {
      lista = lista.filter((linha) =>
        buscarEm(linha).some((campo) => campo?.toLowerCase().includes(termo)),
      );
    }

    for (const filtro of filtros) {
      const valor = selecionados[filtro.chave];
      if (valor && valor !== "todos") {
        lista = lista.filter((linha) => filtro.aplicar(linha, valor));
      }
    }

    if (ordem) {
      const coluna = colunas.find((c) => c.chave === ordem.chave);
      if (coluna?.ordenarPor) {
        const extrair = coluna.ordenarPor;
        lista = [...lista].sort((a, b) => {
          const va = extrair(a);
          const vb = extrair(b);
          const cmp =
            typeof va === "number" && typeof vb === "number"
              ? va - vb
              : String(va).localeCompare(String(vb), "pt-BR");
          return ordem.desc ? -cmp : cmp;
        });
      }
    }

    return lista;
  }, [dados, busca, buscarEm, filtros, selecionados, ordem, colunas]);

  const temFiltroAtivo =
    busca.trim().length > 0 ||
    Object.values(selecionados).some((v) => v && v !== "todos");

  function limpar() {
    setBusca("");
    setSelecionados({});
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {(buscarEm || filtros.length > 0 || acoes) && (
        <div className="flex flex-wrap items-center gap-2">
          {buscarEm && (
            <CampoBusca valor={busca} aoMudar={setBusca} placeholder={placeholderBusca} />
          )}

          {filtros.map((filtro) => (
            <Selecao
              key={filtro.chave}
              value={selecionados[filtro.chave] ?? "todos"}
              onValueChange={(valor) =>
                setSelecionados((atual) => ({ ...atual, [filtro.chave]: valor }))
              }
            >
              <SelecaoGatilho className="w-auto min-w-40 rounded-full">
                <SelecaoValor placeholder={filtro.rotulo} />
              </SelecaoGatilho>
              <SelecaoConteudo>
                <SelecaoItem value="todos">{filtro.rotulo}: todos</SelecaoItem>
                {filtro.opcoes.map((opcao) => (
                  <SelecaoItem key={opcao.valor} value={opcao.valor}>
                    {opcao.rotulo}
                  </SelecaoItem>
                ))}
              </SelecaoConteudo>
            </Selecao>
          ))}

          {temFiltroAtivo && (
            <Botao variante="fantasma" tamanho="sm" onClick={limpar}>
              <Icone nome="fechar" size={14} />
              Limpar
            </Botao>
          )}

          <div className="ml-auto flex items-center gap-2">
            <span className="tabular text-xs text-muted-fg">
              {filtrados.length} de {dados.length}
            </span>
            {acoes}
          </div>
        </div>
      )}

      {filtrados.length === 0 ? (
        vazio ?? (
          <EstadoVazio
            icone="busca"
            compacto
            titulo="Nada encontrado"
            descricao="Nenhum registro bate com a busca e os filtros atuais."
            acao={
              temFiltroAtivo ? (
                <Botao variante="secundaria" tamanho="sm" onClick={limpar}>
                  Limpar filtros
                </Botao>
              ) : null
            }
          />
        )
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border bg-surface-1">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border">
                {colunas.map((coluna) => {
                  const ordenavel = Boolean(coluna.ordenarPor);
                  const ativa = ordem?.chave === coluna.chave;
                  return (
                    <th
                      key={coluna.chave}
                      scope="col"
                      className={cn(
                        "px-4 py-3 text-[12px] font-medium text-muted-fg",
                        coluna.alinhamento === "direita" && "text-right",
                        coluna.alinhamento === "centro" && "text-center",
                        !coluna.alinhamento && "text-left",
                        coluna.escondeEm && CLASSE_ESCONDE[coluna.escondeEm],
                        coluna.classe,
                      )}
                    >
                      {ordenavel ? (
                        <button
                          onClick={() =>
                            setOrdem((atual) =>
                              atual?.chave === coluna.chave
                                ? { chave: coluna.chave, desc: !atual.desc }
                                : { chave: coluna.chave, desc: false },
                            )
                          }
                          className={cn(
                            "inline-flex items-center gap-1 transition-colors hover:text-fg",
                            ativa && "text-fg",
                          )}
                        >
                          {coluna.titulo}
                          <Icone
                            nome={ativa && ordem?.desc ? "desceu" : "subiu"}
                            size={11}
                            className={cn(!ativa && "opacity-35")}
                          />
                        </button>
                      ) : (
                        coluna.titulo
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filtrados.slice(0, limite).map((linha) => (
                <tr
                  key={linha.id}
                  onClick={aoClicarLinha ? () => aoClicarLinha(linha) : undefined}
                  className={cn(
                    "border-b border-border last:border-0",
                    aoClicarLinha && "cursor-pointer transition-colors hover:bg-surface-2",
                  )}
                >
                  {colunas.map((coluna) => (
                    <td
                      key={coluna.chave}
                      className={cn(
                        "px-4 align-middle",
                        densidade === "compacta" ? "py-2.5" : "py-3.5",
                        coluna.alinhamento === "direita" && "tabular text-right",
                        coluna.alinhamento === "centro" && "text-center",
                        coluna.escondeEm && CLASSE_ESCONDE[coluna.escondeEm],
                        coluna.classe,
                      )}
                    >
                      {coluna.render(linha)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {rodape && (
              <tfoot>
                <tr className="border-t border-border-strong bg-surface-2/60">
                  {colunas.map((coluna) => {
                    const conteudo = rodape(filtrados)[coluna.chave];
                    return (
                      <td
                        key={coluna.chave}
                        className={cn(
                          "px-4 py-3 align-middle text-[13px] font-medium",
                          coluna.alinhamento === "direita" && "tabular text-right",
                          coluna.alinhamento === "centro" && "text-center",
                          coluna.escondeEm && CLASSE_ESCONDE[coluna.escondeEm],
                          coluna.classe,
                        )}
                      >
                        {conteudo}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            )}
          </table>
          {filtrados.length > limite && (
            <div className="flex items-center justify-center gap-3 border-t border-border p-3">
              <span className="tabular text-xs text-muted-fg">
                Mostrando {limite} de {filtrados.length}
              </span>
              <Botao
                variante="secundaria"
                tamanho="sm"
                onClick={() => setPagina({ assinatura, limite: limite + porPagina })}
              >
                Mostrar mais {Math.min(porPagina, filtrados.length - limite)}
              </Botao>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
