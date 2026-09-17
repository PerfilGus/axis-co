"use client";

import { useMemo, useState } from "react";
import type { Pedido } from "@/lib/types";
import { formatBRL, formatData } from "@/lib/format";
import { podeAutorizar } from "@/lib/checklist";
import { diaUtilAnterior } from "@/lib/datas";
import { filaAutorizacao } from "@/lib/filas";
import { useSessao } from "@/lib/providers/sessao";
import { usePedidos } from "@/lib/providers/pedidos";
import { Icone } from "@/components/icone";
import { Botao } from "@/components/ui/button";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { ControleSegmentado } from "@/components/shared/controles";
import { LinhaIndicadores } from "@/components/shared/indicadores";
import { EstadoVazio } from "@/components/shared/estado-vazio";
import { CartaoAutorizacao } from "@/components/pedido/cartao-autorizacao";
import { GavetaPedido } from "@/components/pedido/gaveta-pedido";
import { ModalCancelamento } from "@/components/pedido/modal-cancelamento";
import { toast } from "@/components/ui/toast";

type Recorte = "corte" | "todos";

export default function PaginaAutorizar() {
  const { ehAdmin, escopoVendedores } = useSessao();
  const { pedidos: todos, autorizar } = usePedidos();

  const [recorte, setRecorte] = useState<Recorte>("corte");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState<Pedido[]>([]);

  const corte = useMemo(() => diaUtilAnterior(), []);

  const naFila = useMemo(
    () => filaAutorizacao(todos, escopoVendedores, false),
    [todos, escopoVendedores],
  );
  const ateOCorte = useMemo(
    () => filaAutorizacao(todos, escopoVendedores),
    [todos, escopoVendedores],
  );
  const visiveis = recorte === "corte" ? ateOCorte : naFila;

  const prontos = visiveis.filter(podeAutorizar);
  const travados = visiveis.filter((p) => !podeAutorizar(p));
  const selecionaveis = prontos.map((p) => p.id);
  const todosSelecionados =
    selecionaveis.length > 0 && selecionaveis.every((id) => selecionados.has(id));

  function alternarSelecao(id: string, marcado: boolean) {
    setSelecionados((atual) => {
      const proximo = new Set(atual);
      if (marcado) proximo.add(id);
      else proximo.delete(id);
      return proximo;
    });
  }

  function alternarTodos() {
    setSelecionados(todosSelecionados ? new Set() : new Set(selecionaveis));
  }

  async function autorizarIds(ids: string[]) {
    if (ids.length === 0) return;
    const resultado = await autorizar(ids);
    if (!resultado) return;
    const { autorizados, bloqueados } = resultado;

    if (autorizados.length > 0) {
      toast.success(
        autorizados.length === 1
          ? "Envio autorizado"
          : `${autorizados.length} envios autorizados`,
        {
          description: "O código de rastreio chega pela integração de logística.",
        },
      );
    }
    if (bloqueados.length > 0) {
      toast.error(
        bloqueados.length === 1
          ? "Um pedido não pôde ser autorizado"
          : `${bloqueados.length} pedidos não puderam ser autorizados`,
        { description: bloqueados[0].motivo },
      );
    }
    setSelecionados(new Set());
  }

  const pedidoAberto = abertoId
    ? (todos.find((p) => p.id === abertoId) ?? null)
    : null;

  if (!ehAdmin) {
    return (
      <div className="flex flex-col gap-6">
        <CabecalhoPagina
          titulo="Autorizar envios"
          descricao="Quem libera o envio é o Admin."
        />
        <EstadoVazio
          icone="proibido"
          titulo="Só o Admin autoriza envios"
          descricao="Seu perfil enxerga a fila, mas a liberação e o cancelamento ficam com o Admin."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Autorizar envios"
        descricao="Confira a prova, o endereço e o ajuste antes de liberar para os Correios."
        acao={
          <Botao
            variante="principal"
            disabled={selecionados.size === 0}
            onClick={() => autorizarIds([...selecionados])}
          >
            <Icone nome="autorizar" size={16} />
            Autorizar {selecionados.size > 0 ? `${selecionados.size} ` : ""}
            {selecionados.size === 1 ? "pedido" : "pedidos"}
          </Botao>
        }
        extras={
          selecionados.size > 0 ? (
            <Botao
              variante="secundaria"
              onClick={() =>
                setCancelando(visiveis.filter((p) => selecionados.has(p.id)))
              }
            >
              <Icone nome="proibido" size={15} />
              Cancelar selecionados
            </Botao>
          ) : undefined
        }
      />

      <LinhaIndicadores
        itens={[
          {
            icone: "checkCircle",
            valor: String(prontos.length),
            rotulo: "Prontos para autorizar",
          },
          {
            icone: "alerta",
            valor: String(travados.length),
            rotulo: "Com pendência",
          },
          {
            icone: "dinheiro",
            valor: formatBRL(visiveis.reduce((s, p) => s + p.valorTotal, 0)),
            rotulo: "Valor na fila",
          },
          {
            icone: "calendario",
            valor: formatData(corte.toISOString()),
            rotulo: "Corte do dia útil anterior",
          },
        ]}
      />

      <div className="flex flex-wrap items-center gap-3">
        <ControleSegmentado
          valor={recorte}
          aoMudar={setRecorte}
          opcoes={[
            {
              valor: "corte",
              rotulo: "Até o dia útil anterior",
              icone: "calendario",
              contador: ateOCorte.length,
            },
            {
              valor: "todos",
              rotulo: "Todos os pendentes",
              icone: "lista",
              contador: naFila.length,
            },
          ]}
        />
        {selecionaveis.length > 0 && (
          <Botao variante="contorno" tamanho="sm" onClick={alternarTodos}>
            <Icone nome={todosSelecionados ? "fechar" : "check"} size={14} />
            {todosSelecionados
              ? "Limpar seleção"
              : `Selecionar os ${selecionaveis.length} prontos`}
          </Botao>
        )}
        <span className="ml-auto text-xs text-muted-fg">
          {visiveis.length} na fila · {selecionados.size} selecionados
        </span>
      </div>

      {visiveis.length === 0 ? (
        <EstadoVazio
          icone="checkCircle"
          titulo={
            recorte === "corte"
              ? "Nada esperando desde o dia útil anterior"
              : "Fila de autorização vazia"
          }
          descricao={
            recorte === "corte"
              ? "O que foi agendado hoje ainda pode mudar. Veja todos os pendentes se quiser adiantar."
              : "Todo pedido agendado já foi autorizado ou cancelado."
          }
          acao={
            recorte === "corte" && naFila.length > 0 ? (
              <Botao variante="secundaria" onClick={() => setRecorte("todos")}>
                Ver os {naFila.length} pendentes
              </Botao>
            ) : null
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {visiveis.map((pedido) => (
            <CartaoAutorizacao
              key={pedido.id}
              pedido={pedido}
              selecionado={selecionados.has(pedido.id)}
              aoSelecionar={(marcado) => alternarSelecao(pedido.id, marcado)}
              aoAutorizar={() => autorizarIds([pedido.id])}
              aoCancelar={() => setCancelando([pedido])}
              aoAbrir={() => setAbertoId(pedido.id)}
            />
          ))}
        </div>
      )}

      <GavetaPedido
        pedido={pedidoAberto}
        aberto={pedidoAberto !== null}
        aoFechar={() => setAbertoId(null)}
      />

      <ModalCancelamento
        pedidos={cancelando}
        aberto={cancelando.length > 0}
        aoFechar={() => {
          setCancelando([]);
          setSelecionados(new Set());
        }}
      />
    </div>
  );
}
