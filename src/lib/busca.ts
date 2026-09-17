import type {
  FaturaFornecedor,
  ID,
  PagamentoFornecedor,
  ParametrosFornecedor,
  Pedido,
  Perfil,
} from "@/lib/types";
import type { NomeIcone } from "@/components/icone";
import { formatBRL, formatData } from "@/lib/format";
import { STATUS_PEDIDO } from "@/lib/status";

/**
 * Busca global (a lupa e o Cmd/Ctrl+K).
 *
 * Roda sobre o que a sessão já carregou, recortado por perfil no servidor. Só
 * telefone e CPF completos ficam de fora da lista — chegam mascarados —, e por
 * isso os dígitos também vão ao servidor, que devolve apenas ids
 * (`buscarPedidosPorDocumento`).
 */

export type GrupoBusca = "pedidos" | "clientes" | "rastreios" | "fornecedor";

export const ROTULO_GRUPO_BUSCA: Record<GrupoBusca, string> = {
  pedidos: "Pedidos",
  clientes: "Clientes",
  rastreios: "Rastreios",
  fornecedor: "Fornecedor",
};

export const ORDEM_GRUPOS: GrupoBusca[] = ["pedidos", "clientes", "rastreios", "fornecedor"];

/** Abaixo disso não há busca: uma letra acharia tudo. */
export const MINIMO_CARACTERES = 2;
/** Abaixo disso os dígitos da máscara já bastam e o servidor não é chamado. */
export const MINIMO_DIGITOS_DOCUMENTO = 6;
/** Por grupo, para a lista caber na tela; o resto fica no "Ver mais". */
export const LIMITE_POR_GRUPO = 6;

export interface ResultadoBusca {
  chave: string;
  grupo: GrupoBusca;
  icone: NomeIcone;
  titulo: string;
  detalhe: string;
  href: string;
}

export interface FontesBusca {
  pedidos: Pedido[];
  nomeDe: (id: ID | null) => string;
  parametros: ParametrosFornecedor;
  pagamentosFornecedor: PagamentoFornecedor[];
  faturas: FaturaFornecedor[];
}

export interface AlcanceBusca {
  perfil: Perfil;
  /** `null` = todos os pedidos. */
  escopoVendedores: string[] | null;
  verRastreios: boolean;
  verFornecedor: boolean;
}

/** Sem acento, minúsculo e sem espaço sobrando. */
export const normalizar = (texto: string) =>
  texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

/** Sem pontuação de máscara: `AX-1001`, `01310-100` e `123.456` casam digitados de qualquer jeito. */
const compactar = (texto: string) => normalizar(texto).replace(/[\s.\-()/]/g, "");

function casa(termo: string, campos: Array<string | null | undefined>): boolean {
  const normal = normalizar(termo);
  const compacto = compactar(termo);
  return campos.some((campo) => {
    if (!campo) return false;
    return normalizar(campo).includes(normal) || (compacto.length > 0 && compactar(campo).includes(compacto));
  });
}

/** Onde o pedido abre para cada perfil: o cobrador não tem a lista de Pedidos. */
export function hrefDoPedido(perfil: Perfil, pedidoId: ID): string {
  const base = perfil === "cobrador" ? "/operacao/cobranca" : "/operacao/pedidos";
  return `${base}?pedido=${encodeURIComponent(pedidoId)}`;
}

function camposDoCliente(p: Pedido) {
  const e = p.cliente.endereco;
  return [
    p.cliente.nome,
    p.cliente.telefone,
    p.cliente.cpf,
    e.cep,
    e.logradouro,
    e.numero,
    e.bairro,
    e.cidade,
    e.uf,
    e.complemento,
    e.referencia,
    p.cliente.observacoes,
  ];
}

function camposDoPedido(p: Pedido, nomeDe: FontesBusca["nomeDe"]) {
  return [
    p.codigo,
    p.codigo.replace(/\D/g, ""),
    STATUS_PEDIDO[p.status].rotulo,
    ...p.itens.map((i) => i.kitNome),
    formatBRL(p.valorTotal),
    formatData(p.criadoEm),
    nomeDe(p.vendedorId),
    p.observacoes,
    p.motivoCancelamento,
    p.rastreio?.codigo,
    ...camposDoCliente(p),
  ];
}

export function buscarGlobal(
  termo: string,
  fontes: FontesBusca,
  alcance: AlcanceBusca,
  /** Ids que o servidor achou pelo telefone ou CPF completo. */
  idsPorDocumento: ReadonlySet<ID> = new Set(),
): Record<GrupoBusca, ResultadoBusca[]> {
  const vazio: Record<GrupoBusca, ResultadoBusca[]> = { pedidos: [], clientes: [], rastreios: [], fornecedor: [] };
  if (normalizar(termo).length < MINIMO_CARACTERES) return vazio;

  const { escopoVendedores: escopo } = alcance;
  const pedidos = escopo ? fontes.pedidos.filter((p) => escopo.includes(p.vendedorId)) : fontes.pedidos;

  for (const p of pedidos) {
    const porDocumento = idsPorDocumento.has(p.id);
    if (porDocumento || casa(termo, camposDoPedido(p, fontes.nomeDe))) {
      vazio.pedidos.push({
        chave: `pedido-${p.id}`,
        grupo: "pedidos",
        icone: "pedidos",
        titulo: `${p.codigo} · ${p.cliente.nome}`,
        detalhe: `${STATUS_PEDIDO[p.status].rotulo} · ${formatBRL(p.valorTotal)} · ${formatData(p.criadoEm)}`,
        href: hrefDoPedido(alcance.perfil, p.id),
      });
    }
  }

  // Cada pedido grava o próprio cliente: o mesmo nome com o mesmo telefone é a
  // mesma pessoa. A lista vem do mais novo, então o primeiro é o pedido recente.
  const clientes = new Map<string, { pedido: Pedido; total: number }>();
  for (const p of pedidos) {
    if (!idsPorDocumento.has(p.id) && !casa(termo, camposDoCliente(p))) continue;
    const chave = `${normalizar(p.cliente.nome)}|${p.cliente.telefone}`;
    const atual = clientes.get(chave);
    clientes.set(chave, atual ? { ...atual, total: atual.total + 1 } : { pedido: p, total: 1 });
  }
  for (const [chave, { pedido: p, total }] of clientes) {
    vazio.clientes.push({
      chave: `cliente-${chave}`,
      grupo: "clientes",
      icone: "usuario",
      titulo: p.cliente.nome,
      detalhe: `${p.cliente.telefone} · ${p.cliente.endereco.cidade}/${p.cliente.endereco.uf} · ${total} ${total === 1 ? "pedido" : "pedidos"}`,
      href: hrefDoPedido(alcance.perfil, p.id),
    });
  }

  if (alcance.verRastreios) {
    for (const p of pedidos) {
      if (!p.rastreio || p.rastreioRemovidoEm) continue;
      if (!casa(termo, [p.rastreio.codigo, p.codigo, p.cliente.nome]) && !idsPorDocumento.has(p.id)) continue;
      vazio.rastreios.push({
        chave: `rastreio-${p.id}`,
        grupo: "rastreios",
        icone: "rastreio",
        titulo: p.rastreio.codigo || `${p.codigo} sem código`,
        detalhe: `${p.codigo} · ${p.cliente.nome}${p.rastreio.arquivado ? " · Arquivado" : ""}`,
        href: `/operacao/rastreio?pedido=${encodeURIComponent(p.id)}`,
      });
    }
  }

  if (alcance.verFornecedor) {
    const nome = fontes.parametros.fornecedor || "Fornecedor";
    if (fontes.parametros.fornecedor && casa(termo, [fontes.parametros.fornecedor, "fornecedor"])) {
      vazio.fornecedor.push({
        chave: "fornecedor",
        grupo: "fornecedor",
        icone: "fornecedor",
        titulo: nome,
        detalhe: `Pote ${formatBRL(fontes.parametros.custoPote)} · frete ${formatBRL(fontes.parametros.freteEnvio)}`,
        href: "/financeiro/fornecedor",
      });
    }
    for (const pg of fontes.pagamentosFornecedor) {
      if (!casa(termo, [formatBRL(pg.valor), formatData(pg.pagoEm), pg.observacoes, pg.comprovante?.nome])) continue;
      vazio.fornecedor.push({
        chave: `pagamento-${pg.id}`,
        grupo: "fornecedor",
        icone: "dinheiro",
        titulo: `Pagamento de ${formatBRL(pg.valor)}`,
        detalhe: `${nome} · pago em ${formatData(pg.pagoEm)}${pg.observacoes ? ` · ${pg.observacoes}` : ""}`,
        href: "/financeiro/fornecedor?secao=pagamentos",
      });
    }
    for (const f of fontes.faturas) {
      const periodo = `${formatData(`${f.de}T12:00:00-03:00`)} a ${formatData(`${f.ate}T12:00:00-03:00`)}`;
      if (!casa(termo, [f.numero, formatBRL(f.valorCobrado), periodo, f.observacoes])) continue;
      vazio.fornecedor.push({
        chave: `fatura-${f.id}`,
        grupo: "fornecedor",
        icone: "documento",
        titulo: f.numero ? `Fatura ${f.numero}` : "Fatura sem número",
        detalhe: `${nome} · ${periodo} · ${formatBRL(f.valorCobrado)}`,
        href: "/financeiro/fornecedor?secao=conferencia",
      });
    }
  }

  return vazio;
}
