"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Kit, Produto } from "@/lib/types";
import { formatBRL, formatNumero } from "@/lib/format";
import { useCadastros } from "@/lib/providers/cadastros";
import { potesDoKit } from "@/lib/mock/catalogo";
import { Icone } from "@/components/icone";
import { Botao } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Interruptor } from "@/components/ui/switch";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { EstadoVazio } from "@/components/shared/estado-vazio";
import { Miniatura } from "@/components/shared/envio-imagem";
import { SeloTom } from "@/components/shared/selo-status";
import { ModalKit, ModalProduto } from "@/components/config/modais-catalogo";

type Edicao =
  | { tipo: "produto"; produto: Produto | null }
  | { tipo: "kit"; produto: Produto; kit: Kit | null }
  | null;

export default function PaginaConfiguracoesProdutos() {
  const { produtos, kits, alternarAtivo } = useCadastros();
  const [edicao, setEdicao] = useState<Edicao>(null);

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Produtos e kits"
        descricao="O que se vende, quanto custa o pote e o preço de cada kit."
        acao={
          <Botao variante="principal" onClick={() => setEdicao({ tipo: "produto", produto: null })}>
            <Icone nome="adicionar" size={16} />
            Novo produto
          </Botao>
        }
      />

      {produtos.length === 0 ? (
        <EstadoVazio
          icone="produtos"
          titulo="Nenhum produto cadastrado"
          descricao="Cadastre o produto e o custo do pote. Os kits vêm depois, dentro dele."
          acao={
            <Botao variante="principal" onClick={() => setEdicao({ tipo: "produto", produto: null })}>
              Cadastrar produto
            </Botao>
          }
        />
      ) : (
        produtos.map((produto) => {
          const doProduto = kits.filter((k) => k.itens.some((i) => i.produtoId === produto.id));
          return (
            <Card key={produto.id} className={cn(!produto.ativo && "opacity-70")}>
              <div className="flex flex-wrap items-center gap-4 p-5">
                <Miniatura nome={produto.nome} url={produto.fotoUrl} tamanho={56} />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-lg font-medium tracking-tight">{produto.nome}</h2>
                    {!produto.ativo && (
                      <SeloTom tom="cinza" ponto={false}>
                        Inativo
                      </SeloTom>
                    )}
                  </div>
                  <p className="text-[13px] text-muted-fg">
                    {[produto.sabor, produto.gramas ? `${produto.gramas} g` : null]
                      .filter(Boolean)
                      .join(" · ") || "Sem sabor ou peso informados"}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <span className="tabular text-lg font-medium">
                    {formatBRL(produto.custoUnitario)}
                  </span>
                  <span className="text-xs text-muted-fg">custo do pote</span>
                </div>
                <div className="flex items-center gap-2">
                  <Interruptor
                    checked={produto.ativo}
                    onCheckedChange={() => alternarAtivo("produto", produto.id)}
                    aria-label={produto.ativo ? `Desativar ${produto.nome}` : `Ativar ${produto.nome}`}
                  />
                  <Botao
                    variante="secundaria"
                    tamanho="sm"
                    onClick={() => setEdicao({ tipo: "produto", produto })}
                  >
                    <Icone nome="editar" size={14} />
                    Editar
                  </Botao>
                </div>
              </div>

              <div className="border-t border-border">
                <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-2">
                  <p className="text-[13px] font-medium text-muted-fg">
                    Kits · {doProduto.length}
                  </p>
                  <Botao
                    variante="destaqueSuave"
                    tamanho="sm"
                    onClick={() => setEdicao({ tipo: "kit", produto, kit: null })}
                  >
                    <Icone nome="adicionar" size={14} />
                    Novo kit
                  </Botao>
                </div>

                {doProduto.length === 0 ? (
                  <p className="px-5 pb-5 text-[13px] text-muted-fg">
                    Nenhum kit ainda. Sem kit ativo, o produto não aparece no formulário de pedido.
                  </p>
                ) : (
                  <div className="overflow-x-auto px-2 pb-2">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="text-left text-xs text-muted-fg">
                          <th className="px-3 py-2 font-medium">Kit</th>
                          <th className="px-3 py-2 text-right font-medium">Potes</th>
                          <th className="px-3 py-2 text-right font-medium">Preço</th>
                          <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">
                            Piso
                          </th>
                          <th className="hidden px-3 py-2 text-right font-medium md:table-cell">
                            Custo dos potes
                          </th>
                          <th className="px-3 py-2 text-right font-medium">Ativo</th>
                          <th className="w-10 px-3 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {doProduto.map((kit) => (
                          <tr
                            key={kit.id}
                            className={cn(
                              "border-t border-border",
                              !kit.ativo && "text-muted-fg",
                            )}
                          >
                            <td className="px-3 py-3">
                              <div className="flex flex-col">
                                <span className="font-medium">{kit.nome}</span>
                                {kit.descricao && (
                                  <span className="text-xs text-muted-fg">{kit.descricao}</span>
                                )}
                              </div>
                            </td>
                            <td className="tabular px-3 py-3 text-right">
                              {formatNumero(potesDoKit(kit.id, kits))}
                            </td>
                            <td className="tabular px-3 py-3 text-right font-medium">
                              {formatBRL(kit.precoTabela)}
                            </td>
                            <td className="tabular hidden px-3 py-3 text-right text-muted-fg sm:table-cell">
                              {formatBRL(kit.precoMinimo)}
                            </td>
                            <td className="tabular hidden px-3 py-3 text-right text-muted-fg md:table-cell">
                              {formatBRL(potesDoKit(kit.id, kits) * produto.custoUnitario)}
                            </td>
                            <td className="px-3 py-3 text-right">
                              <Interruptor
                                checked={kit.ativo}
                                onCheckedChange={() => alternarAtivo("kit", kit.id)}
                                aria-label={kit.ativo ? `Desativar ${kit.nome}` : `Ativar ${kit.nome}`}
                              />
                            </td>
                            <td className="px-3 py-3 text-right">
                              <Botao
                                variante="fantasma"
                                tamanho="iconeSm"
                                aria-label={`Editar ${kit.nome}`}
                                onClick={() => setEdicao({ tipo: "kit", produto, kit })}
                              >
                                <Icone nome="editar" size={14} />
                              </Botao>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </Card>
          );
        })
      )}

      <p className="text-xs text-muted-fg">
        Cada pedido leva um kit. A estrutura já aceita mais de um produto; o cadastro de kits
        combinando produtos entra quando a operação precisar.
      </p>

      <ModalProduto
        aberto={edicao?.tipo === "produto"}
        produto={edicao?.tipo === "produto" ? edicao.produto : null}
        aoFechar={() => setEdicao(null)}
      />
      <ModalKit
        aberto={edicao?.tipo === "kit"}
        produto={edicao?.tipo === "kit" ? edicao.produto : null}
        kit={edicao?.tipo === "kit" ? edicao.kit : null}
        aoFechar={() => setEdicao(null)}
      />
    </div>
  );
}
