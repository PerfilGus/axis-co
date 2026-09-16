"use client";

import Link from "next/link";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { FormularioPedido } from "@/components/pedido/formulario-pedido";
import { EstadoVazio } from "@/components/shared/estado-vazio";
import { Botao } from "@/components/ui/button";
import { useSessao } from "@/lib/providers/sessao";

export default function PaginaNovoPedido() {
  const { podeCriarPedido } = useSessao();

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Novo pedido"
        descricao="Fechamento por telefone. O valor é o do kit; ajuste passa pelo Admin."
        voltar="/operacao/pedidos"
        comSubAbas={false}
      />
      {podeCriarPedido ? (
        <FormularioPedido />
      ) : (
        <EstadoVazio
          icone="proibido"
          titulo="Seu perfil não cria pedidos"
          descricao="Quem tira pedido é o vendedor. O Admin também pode, para casos de correção."
          acao={
            <Botao variante="principal" asChild>
              <Link href="/operacao/pedidos">Ver a lista de pedidos</Link>
            </Botao>
          }
        />
      )}
    </div>
  );
}
