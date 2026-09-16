"use client";

import { cn } from "@/lib/utils";
import { DESTAQUES, useAparencia, type Tema } from "@/lib/providers/aparencia";
import { useSessao } from "@/lib/providers/sessao";
import { Icone } from "@/components/icone";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { Card, CardConteudo, CardDescricao, CardTitulo } from "@/components/ui/card";
import { Botao } from "@/components/ui/button";
import { CardPremiacao } from "@/components/shared/card-premiacao";
import { LinhaIndicadores } from "@/components/shared/indicadores";
import { SeloStatusPedido } from "@/components/shared/selo-status";
import { AvatarAnel } from "@/components/shared/avatar-anel";
import { toast } from "@/components/ui/toast";

const TEMAS: Array<{ chave: Tema; rotulo: string; icone: "lua" | "sol" }> = [
  { chave: "escuro", rotulo: "Escuro", icone: "lua" },
  { chave: "claro", rotulo: "Claro", icone: "sol" },
];

export default function PaginaAparencia() {
  const { tema, destaque, definirTema, definirDestaque } = useAparencia();
  const { usuario } = useSessao();

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Aparência"
        descricao="Sua escolha vale só para você, na web e no aplicativo."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardConteudo className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <CardTitulo>Tema</CardTitulo>
              <CardDescricao>
                O escuro é o padrão do sistema. O claro usa os mesmos tokens.
              </CardDescricao>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {TEMAS.map((opcao) => {
                const ativo = tema === opcao.chave;
                return (
                  <button
                    key={opcao.chave}
                    onClick={() => definirTema(opcao.chave)}
                    aria-pressed={ativo}
                    className={cn(
                      "flex flex-col gap-3 rounded-[var(--radius-card-sm)] border p-4 text-left transition-colors",
                      ativo
                        ? "border-[var(--accent)]"
                        : "border-border hover:border-border-strong",
                    )}
                  >
                    <span
                      className="flex h-16 items-end gap-1.5 rounded-[var(--radius-input)] border border-border p-2"
                      style={{
                        backgroundColor:
                          opcao.chave === "escuro" ? "#121212" : "#eaeaea",
                      }}
                      aria-hidden
                    >
                      <span
                        className="h-4 flex-1 rounded-full"
                        style={{
                          backgroundColor:
                            opcao.chave === "escuro" ? "#202020" : "#fbfbfa",
                        }}
                      />
                      <span
                        className="h-4 w-8 rounded-full"
                        style={{ backgroundColor: "var(--accent)" }}
                      />
                    </span>
                    <span className="flex items-center gap-2 text-[13px] font-medium">
                      <Icone nome={opcao.icone} size={15} />
                      {opcao.rotulo}
                      {ativo && (
                        <Icone
                          nome="checkCircle"
                          size={15}
                          className="ml-auto text-[var(--accent)]"
                        />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </CardConteudo>
        </Card>

        <Card>
          <CardConteudo className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <CardTitulo>Cor de destaque</CardTitulo>
              <CardDescricao>
                Oito opções. As cores de status nunca mudam com essa escolha.
              </CardDescricao>
            </div>
            <div className="grid grid-cols-4 justify-items-center gap-3 sm:grid-cols-8 lg:grid-cols-4">
              {DESTAQUES.map((opcao) => {
                const ativo = destaque === opcao.chave;
                return (
                  <button
                    key={opcao.chave}
                    onClick={() => definirDestaque(opcao.chave)}
                    aria-pressed={ativo}
                    title={opcao.rotulo}
                    className={cn(
                      "flex size-12 items-center justify-center rounded-full border-2 transition-colors",
                      ativo ? "border-fg" : "border-transparent hover:border-border-strong",
                    )}
                  >
                    <span
                      className="flex size-9 items-center justify-center rounded-full"
                      style={{ backgroundColor: opcao.cor }}
                    >
                      {ativo && (
                        <Icone nome="check" size={16} className="text-[#121212]" />
                      )}
                    </span>
                    <span className="sr-only">{opcao.rotulo}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-fg">
              Amarelo é o padrão da identidade.
            </p>
          </CardConteudo>
        </Card>
      </div>

      <Card>
        <CardConteudo className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <CardTitulo>Prévia</CardTitulo>
            <CardDescricao>
              Como os componentes ficam com a sua escolha.
            </CardDescricao>
          </div>

          <LinhaIndicadores
            comCard={false}
            itens={[
              { icone: "pedidos", valor: "62", rotulo: "Pedidos" },
              { icone: "dinheiro", valor: "R$ 18.420,00", rotulo: "Recebido" },
              { icone: "ranking", valor: "3º", rotulo: "Sua posição" },
            ]}
          />

          <div className="flex flex-wrap items-center gap-3">
            <Botao variante="principal">
              <Icone nome="adicionar" size={16} />
              Ação principal
            </Botao>
            <Botao variante="secundaria">
              <Icone nome="fechar" size={15} />
              Fechar
            </Botao>
            <Botao variante="contorno">Contorno</Botao>
            <Botao
              variante="destaqueSuave"
              onClick={() =>
                toast.success("É só isso mesmo", {
                  description: "Sua preferência já está salva neste navegador.",
                })
              }
            >
              Ver um aviso
            </Botao>
            <AvatarAnel nome={usuario.nome} progresso={0.62} tamanho={44} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <SeloStatusPedido status="agendado" />
            <SeloStatusPedido status="em_transito" />
            <SeloStatusPedido status="entregue" />
            <SeloStatusPedido status="pago" />
            <SeloStatusPedido status="inadimplente" />
          </div>

          <CardPremiacao
            icone="metas"
            titulo="Meta mensal de vendas"
            descricao="168 de 240 pedidos agendados."
            progresso={0.7}
            rodape="Faltam 72 pedidos para o bônus."
            className="max-w-md"
          />
        </CardConteudo>
      </Card>
    </div>
  );
}
