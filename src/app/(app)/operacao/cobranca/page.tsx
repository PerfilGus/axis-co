"use client";

import { useMemo, useState } from "react";
import type { Pedido } from "@/lib/types";
import { formatBRL, formatData, formatPercentual, formatTelefone } from "@/lib/format";
import { inicioDoMes } from "@/lib/datas";
import { ROTULO_FORMA } from "@/lib/taxas";
import { useSessao } from "@/lib/providers/sessao";
import { usePedidos } from "@/lib/providers/pedidos";
import { nomeColaborador } from "@/lib/mock/equipe";
import { BANCO_POR_ID } from "@/lib/mock/financeiro";
import { Icone } from "@/components/icone";
import { Botao } from "@/components/ui/button";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { ControleSegmentado } from "@/components/shared/controles";
import { LinhaIndicadores } from "@/components/shared/indicadores";
import { SeloStatusPedido } from "@/components/shared/selo-status";
import { Tabela, type ColunaTabela } from "@/components/shared/tabela";
import { EstadoVazio } from "@/components/shared/estado-vazio";
import { GavetaPedido } from "@/components/pedido/gaveta-pedido";
import { ModalPagamento } from "@/components/pedido/modal-pagamento";
import { toast } from "@/components/ui/toast";

type Aba = "aguardando" | "pagos" | "inadimplentes";

const FRUSTRADOS = ["cancelado", "reembolsado", "inadimplente"];

export default function PaginaCobranca() {
  const { usuario, escopoVendedores, podeOperarCobranca } = useSessao();
  const { pedidos: todos, marcarInadimplente } = usePedidos();

  const [aba, setAba] = useState<Aba>("aguardando");
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [cobrandoId, setCobrandoId] = useState<string | null>(null);

  /** A carteira do cobrador: só os vendedores atribuídos a ele pelo Admin. */
  const carteira = useMemo(
    () =>
      escopoVendedores
        ? todos.filter((p) => escopoVendedores.includes(p.vendedorId))
        : todos,
    [todos, escopoVendedores],
  );

  const aguardando = carteira.filter((p) => p.status === "entregue");
  const pagos = carteira.filter((p) => p.status === "pago");
  const inadimplentes = carteira.filter((p) => p.status === "inadimplente");

  const aReceber = aguardando.reduce((s, p) => s + p.valorTotal + p.frete, 0);

  const inicioMes = useMemo(() => inicioDoMes(), []);
  const recebidoNoMes = pagos
    .filter((p) => p.cobranca.pagoEm && new Date(p.cobranca.pagoEm) >= inicioMes)
    .reduce((s, p) => s + (p.cobranca.valorRecebido ?? p.valorTotal + p.frete), 0);

  // Frustração real: tudo que saiu do trilho, sobre o total da carteira.
  const frustrados = carteira.filter((p) => FRUSTRADOS.includes(p.status)).length;
  const taxaFrustracao = carteira.length > 0 ? frustrados / carteira.length : 0;

  const listas: Record<Aba, Pedido[]> = {
    aguardando,
    pagos,
    inadimplentes,
  };
  const lista = listas[aba];

  const pedidoAberto = abertoId
    ? (todos.find((p) => p.id === abertoId) ?? null)
    : null;
  const pedidoCobrando = cobrandoId
    ? (todos.find((p) => p.id === cobrandoId) ?? null)
    : null;

  const colunas: Array<ColunaTabela<Pedido>> = useMemo(() => {
    const base: Array<ColunaTabela<Pedido>> = [
      {
        chave: "codigo",
        titulo: "Pedido",
        ordenarPor: (p) => p.codigo,
        render: (p) => (
          <span className="tabular font-medium whitespace-nowrap">{p.codigo}</span>
        ),
      },
      {
        chave: "cliente",
        titulo: "Cliente",
        ordenarPor: (p) => p.cliente.nome,
        render: (p) => (
          <div className="flex flex-col">
            <span className="truncate">{p.cliente.nome}</span>
            <span className="tabular text-[11px] text-muted-fg">
              {formatTelefone(p.cliente.telefone)}
            </span>
          </div>
        ),
      },
      {
        chave: "vendedor",
        titulo: "Vendedor",
        escondeEm: "lg",
        ordenarPor: (p) => nomeColaborador(p.vendedorId),
        render: (p) => (
          <span className="text-muted-fg">{nomeColaborador(p.vendedorId)}</span>
        ),
      },
    ];

    if (aba === "pagos") {
      return [
        ...base,
        {
          chave: "forma",
          titulo: "Forma",
          escondeEm: "sm",
          render: (p) => (
            <div className="flex flex-col">
              <span>{ROTULO_FORMA[p.cobranca.formaPagamento]}</span>
              <span className="text-[11px] text-muted-fg">
                {p.cobranca.bancoId
                  ? (BANCO_POR_ID.get(p.cobranca.bancoId)?.nome ?? "—")
                  : "—"}
              </span>
            </div>
          ),
        },
        {
          chave: "pagoEm",
          titulo: "Pago em",
          escondeEm: "sm",
          alinhamento: "direita",
          ordenarPor: (p) => p.cobranca.pagoEm ?? "",
          render: (p) => (
            <span className="text-muted-fg">{formatData(p.cobranca.pagoEm)}</span>
          ),
        },
        {
          chave: "taxa",
          titulo: "Taxa",
          alinhamento: "direita",
          ordenarPor: (p) => p.cobranca.taxaAplicada ?? 0,
          render: (p) => (
            <span style={{ color: "var(--st-vermelho-fg)" }}>
              {p.cobranca.taxaAplicada
                ? `− ${formatBRL(p.cobranca.taxaAplicada)}`
                : "—"}
            </span>
          ),
        },
        {
          chave: "recebido",
          titulo: "Recebido",
          alinhamento: "direita",
          ordenarPor: (p) => p.cobranca.valorRecebido ?? 0,
          render: (p) => (
            <span className="font-medium">
              {formatBRL(p.cobranca.valorRecebido ?? p.valorTotal + p.frete)}
            </span>
          ),
        },
      ];
    }

    return [
      ...base,
      {
        chave: "tentativas",
        titulo: "Tentativas",
        escondeEm: "sm",
        alinhamento: "centro",
        ordenarPor: (p) => p.cobranca.tentativas,
        render: (p) => <span className="tabular">{p.cobranca.tentativas}</span>,
      },
      {
        chave: "entregue",
        titulo: "Entregue em",
        escondeEm: "md",
        alinhamento: "direita",
        ordenarPor: (p) => p.rastreio?.entregueEm ?? "",
        render: (p) => (
          <span className="text-muted-fg">
            {formatData(p.rastreio?.entregueEm ?? null)}
          </span>
        ),
      },
      {
        chave: "status",
        titulo: "Status",
        render: (p) => <SeloStatusPedido status={p.status} />,
      },
      {
        chave: "valor",
        titulo: "A receber",
        alinhamento: "direita",
        ordenarPor: (p) => p.valorTotal + p.frete,
        render: (p) => (
          <span className="font-medium">{formatBRL(p.valorTotal + p.frete)}</span>
        ),
      },
      {
        chave: "acao",
        titulo: "",
        render: (p) => (
          <div className="flex justify-end gap-1">
            <Botao
              variante="destaqueSuave"
              tamanho="sm"
              onClick={(e) => {
                e.stopPropagation();
                setCobrandoId(p.id);
              }}
            >
              <Icone nome="dinheiro" size={14} />
              Registrar
            </Botao>
            {p.status === "entregue" && (
              <Botao
                variante="fantasma"
                tamanho="iconeSm"
                aria-label="Marcar como inadimplente"
                title="Marcar como inadimplente"
                onClick={(e) => {
                  e.stopPropagation();
                  marcarInadimplente(p.id, usuario.id);
                  toast("Pedido marcado como inadimplente", {
                    description: `${p.codigo} passou a gerar custo de frete e de pote.`,
                  });
                }}
              >
                <Icone nome="alerta" size={14} />
              </Botao>
            )}
          </div>
        ),
      },
    ];
  }, [aba, marcarInadimplente, usuario.id]);

  if (!podeOperarCobranca) {
    return (
      <div className="flex flex-col gap-6">
        <CabecalhoPagina
          titulo="Cobrança"
          descricao="Pedidos entregues à espera de pagamento."
        />
        <EstadoVazio
          icone="proibido"
          titulo="Esta tela é do cobrador"
          descricao="Quem opera a cobrança é o Financeiro, nos vendedores atribuídos a ele pelo Admin."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Cobrança"
        descricao={
          escopoVendedores
            ? `Sua carteira: ${escopoVendedores.map(nomeColaborador).join(", ")}.`
            : "Todos os pedidos entregues, pagos e inadimplentes."
        }
      />

      <LinhaIndicadores
        itens={[
          {
            icone: "dinheiro",
            valor: formatBRL(aReceber),
            rotulo: "Valor a receber",
          },
          {
            icone: "tendencia",
            valor: formatBRL(recebidoNoMes),
            rotulo: "Recebido no mês",
          },
          {
            icone: "alerta",
            valor: formatPercentual(taxaFrustracao),
            rotulo: "Frustração da carteira",
          },
          {
            icone: "pedidos",
            valor: String(carteira.length),
            rotulo: "Pedidos na carteira",
          },
        ]}
      />

      <ControleSegmentado
        valor={aba}
        aoMudar={setAba}
        opcoes={[
          {
            valor: "aguardando",
            rotulo: "Aguardando pagamento",
            icone: "relogio",
            contador: aguardando.length,
          },
          {
            valor: "pagos",
            rotulo: "Pagos",
            icone: "checkCircle",
            contador: pagos.length,
          },
          {
            valor: "inadimplentes",
            rotulo: "Inadimplentes",
            icone: "alerta",
            contador: inadimplentes.length,
          },
        ]}
      />

      <Tabela
        dados={lista}
        colunas={colunas}
        buscarEm={(p) => [p.codigo, p.cliente.nome, p.cliente.telefone]}
        placeholderBusca="Buscar por nome, telefone ou código"
        aoClicarLinha={(p) => setAbertoId(p.id)}
        vazio={
          <EstadoVazio
            icone={aba === "pagos" ? "checkCircle" : "dinheiro"}
            titulo={
              aba === "aguardando"
                ? "Nada aguardando pagamento"
                : aba === "pagos"
                  ? "Nenhum pagamento registrado"
                  : "Nenhum inadimplente"
            }
            descricao={
              aba === "aguardando"
                ? "Assim que um pedido for entregue, ele entra nesta fila."
                : aba === "pagos"
                  ? "Os pagamentos que você registrar aparecem aqui."
                  : "Sua carteira está em dia."
            }
          />
        }
      />

      <GavetaPedido
        pedido={pedidoAberto}
        aberto={pedidoAberto !== null}
        aoFechar={() => setAbertoId(null)}
      />

      <ModalPagamento
        pedido={pedidoCobrando}
        aberto={pedidoCobrando !== null}
        aoFechar={() => setCobrandoId(null)}
      />
    </div>
  );
}
