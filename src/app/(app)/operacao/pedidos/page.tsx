"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Pedido, StatusPedido } from "@/lib/types";
import { formatBRL, formatData } from "@/lib/format";
import { STATUS_PEDIDO } from "@/lib/status";
import { useSessao } from "@/lib/providers/sessao";
import { usePedidos } from "@/lib/providers/pedidos";
import { useEquipe } from "@/lib/providers/equipe";
import { useCadastros } from "@/lib/providers/cadastros";
import { rotuloCriativo } from "@/lib/criativos";
import type { Colaborador, Criativo, Kit, LinhaWhatsApp } from "@/lib/types";
import { Icone } from "@/components/icone";
import { Botao } from "@/components/ui/button";
import { Contador } from "@/components/ui/badge";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { LinhaIndicadores } from "@/components/shared/indicadores";
import { SeloStatusPedido, SeloTom } from "@/components/shared/selo-status";
import { Tabela, type ColunaTabela, type FiltroTabela } from "@/components/shared/tabela";
import { EstadoVazio } from "@/components/shared/estado-vazio";
import { GavetaPedido } from "@/components/pedido/gaveta-pedido";
import {
  FilaSolicitacoes,
  solicitacoesPendentes,
} from "@/components/pedido/fila-solicitacoes";

/** Janelas de tempo do filtro de período, em dias. */
const PERIODOS: Array<{ valor: string; rotulo: string; dias: number }> = [
  { valor: "hoje", rotulo: "Hoje", dias: 1 },
  { valor: "7", rotulo: "Últimos 7 dias", dias: 7 },
  { valor: "30", rotulo: "Últimos 30 dias", dias: 30 },
  { valor: "90", rotulo: "Últimos 90 dias", dias: 90 },
];

/** Colunas e filtros leem os cadastros vivos: renomear um kit muda o filtro. */
interface Cadastros {
  nomeDe: (id: string | null) => string;
  vendedores: Colaborador[];
  kits: Kit[];
  criativos: Criativo[];
  linhas: LinhaWhatsApp[];
}

const montarColunas = ({ nomeDe, criativos, linhas }: Cadastros): Array<ColunaTabela<Pedido>> => [
  {
    chave: "codigo",
    titulo: "Pedido",
    ordenarPor: (p) => p.codigo,
    render: (p) => (
      <div className="flex flex-col gap-1">
        <span className="tabular font-medium whitespace-nowrap">{p.codigo}</span>
        {p.ajustes.some((a) => a.status === "pendente") && (
          <SeloTom tom="bronze" ponto={false} className="px-2 py-0 text-[10px]">
            Ajuste pendente
          </SeloTom>
        )}
      </div>
    ),
  },
  {
    chave: "cliente",
    titulo: "Cliente",
    ordenarPor: (p) => p.cliente.nome,
    render: (p) => (
      <div className="flex flex-col">
        <span className="truncate">{p.cliente.nome}</span>
        <span className="text-[11px] text-muted-fg">
          {p.cliente.endereco.cidade}/{p.cliente.endereco.uf}
        </span>
      </div>
    ),
  },
  {
    chave: "kit",
    titulo: "Kit",
    escondeEm: "md",
    ordenarPor: (p) => p.itens[0]?.kitNome ?? "",
    render: (p) => <span className="text-muted-fg">{p.itens[0]?.kitNome ?? "—"}</span>,
  },
  {
    chave: "criativo",
    titulo: "Criativo",
    escondeEm: "lg",
    ordenarPor: (p) => rotuloCriativo(p.criativoId, criativos, linhas),
    render: (p) => (
      <span className="tabular text-[13px] text-muted-fg">
        {rotuloCriativo(p.criativoId, criativos, linhas)}
      </span>
    ),
  },
  {
    chave: "vendedor",
    titulo: "Vendedor",
    escondeEm: "lg",
    ordenarPor: (p) => nomeDe(p.vendedorId),
    render: (p) => (
      <span className="text-muted-fg">{nomeDe(p.vendedorId)}</span>
    ),
  },
  {
    chave: "status",
    titulo: "Status",
    ordenarPor: (p) => STATUS_PEDIDO[p.status].ordem,
    render: (p) => <SeloStatusPedido status={p.status} />,
  },
  {
    chave: "criadoEm",
    titulo: "Criado",
    escondeEm: "sm",
    alinhamento: "direita",
    ordenarPor: (p) => p.criadoEm,
    render: (p) => <span className="text-muted-fg">{formatData(p.criadoEm)}</span>,
  },
  {
    chave: "valor",
    titulo: "Valor",
    alinhamento: "direita",
    ordenarPor: (p) => p.valorTotal,
    render: (p) => <span className="font-medium">{formatBRL(p.valorTotal)}</span>,
  },
];

const montarFiltros = ({ vendedores, kits, criativos, linhas }: Cadastros): Array<FiltroTabela<Pedido>> => [
  {
    chave: "status",
    rotulo: "Status",
    opcoes: Object.values(STATUS_PEDIDO)
      .sort((a, b) => a.ordem - b.ordem)
      .map((s) => ({ valor: s.chave, rotulo: s.rotulo })),
    aplicar: (p, valor) => p.status === (valor as StatusPedido),
  },
  {
    chave: "vendedor",
    rotulo: "Vendedor",
    opcoes: vendedores.map((v) => ({ valor: v.id, rotulo: v.nome })),
    aplicar: (p, valor) => p.vendedorId === valor,
  },
  {
    chave: "periodo",
    rotulo: "Período",
    opcoes: PERIODOS.map(({ valor, rotulo }) => ({ valor, rotulo })),
    aplicar: (p, valor) => {
      const periodo = PERIODOS.find((x) => x.valor === valor);
      if (!periodo) return true;
      const limite = Date.now() - periodo.dias * 86_400_000;
      return new Date(p.criadoEm).getTime() >= limite;
    },
  },
  {
    chave: "kit",
    rotulo: "Kit",
    opcoes: kits.map((k) => ({ valor: k.id, rotulo: k.nome })),
    aplicar: (p, valor) => p.itens.some((i) => i.kitId === valor),
  },
  {
    chave: "criativo",
    rotulo: "Criativo",
    opcoes: [
      ...criativos.filter((c) => c.ativo).map((c) => ({
        valor: c.id,
        rotulo: rotuloCriativo(c.id, criativos, linhas),
      })),
      { valor: "sem_criativo", rotulo: "Não identificado" },
    ],
    aplicar: (p, valor) =>
      valor === "sem_criativo" ? p.criativoId === null : p.criativoId === valor,
  },
];

export default function PaginaPedidos() {
  const { escopoVendedores, podeCriarPedido, ehAdmin } = useSessao();
  const { pedidos: todos } = usePedidos();
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [filaAberta, setFilaAberta] = useState(false);

  const pedidos = useMemo(
    () =>
      escopoVendedores
        ? todos.filter((p) => escopoVendedores.includes(p.vendedorId))
        : todos,
    [todos, escopoVendedores],
  );

  // O vendedor só vê os próprios pedidos: coluna e filtro de vendedor seriam
  // sempre o mesmo nome.
  const { nomeDe, colaboradores } = useEquipe();
  const { kits, criativos, linhas } = useCadastros();
  const cadastros = useMemo<Cadastros>(
    () => ({
      nomeDe,
      vendedores: colaboradores.filter((c) => c.setor === "vendas"),
      kits,
      criativos,
      linhas,
    }),
    [nomeDe, colaboradores, kits, criativos, linhas],
  );
  const colunas = useMemo(() => {
    const todas = montarColunas(cadastros);
    return ehAdmin ? todas : todas.filter((c) => c.chave !== "vendedor");
  }, [ehAdmin, cadastros]);
  const filtros = useMemo(() => {
    const todos = montarFiltros(cadastros);
    return ehAdmin ? todos : todos.filter((f) => f.chave !== "vendedor");
  }, [ehAdmin, cadastros]);

  const fila = useMemo(
    () => solicitacoesPendentes(pedidos, escopoVendedores),
    [pedidos, escopoVendedores],
  );

  const emAberto = pedidos.filter(
    (p) => !["pago", "cancelado", "reembolsado", "inadimplente"].includes(p.status),
  );
  const pagos = pedidos.filter((p) => p.status === "pago");
  const frustrados = pedidos.filter((p) =>
    ["cancelado", "reembolsado", "inadimplente"].includes(p.status),
  );

  // Guarda o id, não o objeto: assim a gaveta acompanha o pedido depois de uma
  // aprovação de ajuste, e fecha sozinha se ele for excluído.
  const pedidoAberto = selecionadoId
    ? (todos.find((p) => p.id === selecionadoId) ?? null)
    : null;

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Pedidos"
        descricao={
          ehAdmin
            ? "Todos os pedidos, do agendamento ao pagamento."
            : "Os pedidos que você tirou, do agendamento ao pagamento."
        }
        extras={
          ehAdmin ? (
            <Botao variante="secundaria" onClick={() => setFilaAberta(true)}>
              <Icone nome="lista" size={15} />
              Solicitações
              {fila.length > 0 && <Contador valor={fila.length} />}
            </Botao>
          ) : undefined
        }
        acao={
          podeCriarPedido ? (
            <Botao variante="principal" asChild>
              <Link href="/operacao/pedidos/novo">
                <Icone nome="adicionar" size={16} />
                Novo pedido
              </Link>
            </Botao>
          ) : undefined
        }
      />

      <LinhaIndicadores
        itens={[
          {
            icone: "pedidos",
            valor: String(pedidos.length),
            rotulo: "Pedidos no total",
          },
          { icone: "rastreio", valor: String(emAberto.length), rotulo: "Em aberto" },
          {
            icone: "dinheiro",
            valor: formatBRL(pagos.reduce((s, p) => s + p.valorTotal, 0)),
            rotulo: "Recebido",
          },
          {
            icone: "alerta",
            valor: String(frustrados.length),
            rotulo: "Frustrados ou perdidos",
          },
        ]}
      />

      <Tabela
        dados={pedidos}
        colunas={colunas}
        filtros={filtros}
        buscarEm={(p) => [
          p.codigo,
          p.cliente.nome,
          p.cliente.telefone,
          p.cliente.endereco.cidade,
          p.rastreio?.codigo,
        ]}
        placeholderBusca="Buscar por nome, telefone ou código"
        aoClicarLinha={(p) => setSelecionadoId(p.id)}
        vazio={
          <EstadoVazio
            icone="pedidos"
            titulo="Nenhum pedido por aqui"
            descricao="Assim que o primeiro pedido for tirado, ele aparece nesta lista."
            acao={
              podeCriarPedido ? (
                <Botao variante="principal" asChild>
                  <Link href="/operacao/pedidos/novo">Criar o primeiro pedido</Link>
                </Botao>
              ) : null
            }
          />
        }
      />

      <GavetaPedido
        pedido={pedidoAberto}
        aberto={pedidoAberto !== null}
        aoFechar={() => setSelecionadoId(null)}
      />

      <FilaSolicitacoes
        aberto={filaAberta}
        aoFechar={() => setFilaAberta(false)}
        aoAbrirPedido={(pedido) => {
          setFilaAberta(false);
          setSelecionadoId(pedido.id);
        }}
      />
    </div>
  );
}
