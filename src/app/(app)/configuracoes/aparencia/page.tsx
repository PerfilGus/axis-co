"use client";

import Link from "next/link";
import { useSessao } from "@/lib/providers/sessao";
import { HREF_DESIGN } from "@/lib/nav";
import { Icone } from "@/components/icone";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { Card, CardConteudo, CardDescricao, CardTitulo } from "@/components/ui/card";
import { Botao } from "@/components/ui/button";
import { CardPremiacao } from "@/components/shared/card-premiacao";
import { LinhaIndicadores } from "@/components/shared/indicadores";
import { SeloStatusPedido } from "@/components/shared/selo-status";
import { AvatarAnel } from "@/components/shared/avatar-anel";
import { toast } from "@/components/ui/toast";
import { SeletorDestaque, SeletorTema } from "@/components/shared/seletores-aparencia";

export default function PaginaAparencia() {
  const { usuario, perfil } = useSessao();

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Aparência"
        descricao="Sua escolha vale só para você, na web e no aplicativo."
        extras={
          perfil === "admin" ? (
            <Botao variante="secundaria" asChild>
              <Link href={HREF_DESIGN}>
                <Icone nome="aparencia" size={16} />
                Paleta e componentes
              </Link>
            </Botao>
          ) : undefined
        }
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
            <SeletorTema />
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
            <SeletorDestaque className="sm:grid-cols-8 lg:grid-cols-4" />
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
