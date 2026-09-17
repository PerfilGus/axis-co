import "server-only";
import { asc, eq } from "drizzle-orm";
import type {
  AliquotaMensal,
  BancoPlataforma,
  BonusNivel,
  Colaborador,
  Conquista,
  ConquistaDesbloqueada,
  Criativo,
  DespesaFixa,
  DiaMetaAds,
  Divida,
  FaturaFornecedor,
  Kit,
  LancamentoMetaAds,
  LinhaWhatsApp,
  Meta,
  Nivel,
  PagamentoColaborador,
  PagamentoFornecedor,
  ParametrosFornecedor,
  Pedido,
  Produto,
} from "@/lib/types";
import { ocultarCPF, ocultarTelefone } from "@/lib/format";
import { podeVerFinanceiro, podeVerMarketing, ehAdmin } from "@/lib/permissoes";
import { db } from "./db";
import * as t from "./schema";
import { carregarPedidos, urlDoAnexo } from "./repositorio/pedidos";
import type { ContextoSessao } from "./sessao";

/**
 * O que a interface recebe ao abrir o sistema.
 *
 * Tudo sai daqui já recortado para quem pediu: remuneração só a própria,
 * financeiro e marketing só para o admin, e CPF e telefone de cliente sempre
 * mascarados — o dado completo só vem pelo detalhe, com registro.
 */

export interface DadosEquipe {
  colaboradores: Colaborador[];
  metas: Meta[];
  niveis: Nivel[];
  conquistas: Conquista[];
  desbloqueadas: ConquistaDesbloqueada[];
  bonusNivel: BonusNivel[];
  pagamentos: PagamentoColaborador[];
}

export interface DadosCadastros {
  produtos: Produto[];
  kits: Kit[];
  linhas: LinhaWhatsApp[];
  criativos: Criativo[];
  bancos: BancoPlataforma[];
}

export interface DadosFinanceiro {
  parametros: ParametrosFornecedor;
  pagamentosFornecedor: PagamentoFornecedor[];
  faturas: FaturaFornecedor[];
  aliquotas: AliquotaMensal[];
  despesas: DespesaFixa[];
  dividas: Divida[];
}

export interface DadosMarketing {
  lancamentos: LancamentoMetaAds[];
  diasManuais: DiaMetaAds[];
}

export interface DadosIniciais {
  usuario: Colaborador;
  email: string;
  doisFatores: boolean;
  equipe: DadosEquipe;
  cadastros: DadosCadastros;
  pedidos: Pedido[];
  financeiro: DadosFinanceiro;
  marketing: DadosMarketing;
}

export const PARAMETROS_VAZIOS: ParametrosFornecedor = {
  fornecedor: "",
  custoPote: 0,
  freteEnvio: 0,
  atualizadoEm: "",
};

/** CPF e telefone mascarados, para qualquer listagem. */
export function mascararPedido(pedido: Pedido): Pedido {
  return {
    ...pedido,
    cliente: {
      ...pedido.cliente,
      telefone: ocultarTelefone(pedido.cliente.telefone),
      cpf: ocultarCPF(pedido.cliente.cpf),
    },
  };
}

/** Remuneração de outra pessoa não sai do servidor para quem não é admin. */
function recortarColaborador(c: Colaborador, quem: Colaborador): Colaborador {
  if (ehAdmin(quem) || c.id === quem.id) return c;
  return { ...c, salarioFixo: 0, chavePix: null, comissaoBps: 0, frustradoBps: null, diaPagamento: 0 };
}

export async function carregarEquipe(quem: Colaborador): Promise<DadosEquipe> {
  const [colaboradores, metas, niveis, conquistas, desbloqueadas, bonus, pagamentos] =
    await Promise.all([
      db.select().from(t.colaboradores).orderBy(asc(t.colaboradores.nome)),
      db.select().from(t.metas),
      db.select().from(t.niveis).orderBy(asc(t.niveis.ordem)),
      db.select().from(t.conquistas),
      db.select().from(t.conquistasDesbloqueadas),
      db.select().from(t.bonusNivel),
      db.select().from(t.pagamentosColaborador),
    ]);
  const admin = ehAdmin(quem);
  return {
    colaboradores: colaboradores.map((c) => recortarColaborador(c, quem)),
    metas: admin ? metas : metas.filter((m) => m.colaboradorId === quem.id),
    niveis,
    conquistas,
    desbloqueadas: desbloqueadas.map(({ conquistaId, colaboradorId, desbloqueadaEm }) => ({
      conquistaId,
      colaboradorId,
      desbloqueadaEm,
    })),
    bonusNivel: admin ? bonus : bonus.filter((b) => b.colaboradorId === quem.id),
    pagamentos: admin ? pagamentos : pagamentos.filter((p) => p.colaboradorId === quem.id),
  };
}

export async function carregarCadastros(quem: Colaborador): Promise<DadosCadastros> {
  const [produtos, kits, linhas, criativos, bancos] = await Promise.all([
    db.select().from(t.produtos).orderBy(asc(t.produtos.nome)),
    db.select().from(t.kits).orderBy(asc(t.kits.precoTabela)),
    db.select().from(t.linhasWhatsapp).orderBy(asc(t.linhasWhatsapp.nome)),
    db.select().from(t.criativos).orderBy(asc(t.criativos.codigo)),
    db.select().from(t.bancosPlataformas).orderBy(asc(t.bancosPlataformas.nome)),
  ]);
  return {
    produtos,
    kits,
    linhas,
    criativos,
    bancos: ehAdmin(quem) ? bancos : bancos.map((b) => ({ ...b, saldo: 0 })),
  };
}

export async function carregarFinanceiro(quem: Colaborador): Promise<DadosFinanceiro> {
  if (!podeVerFinanceiro(quem)) {
    return {
      parametros: PARAMETROS_VAZIOS,
      pagamentosFornecedor: [],
      faturas: [],
      aliquotas: [],
      despesas: [],
      dividas: [],
    };
  }
  const [parametros, pagamentos, anexosFornecedor, faturas, aliquotas, despesas, dividas] =
    await Promise.all([
      db.select().from(t.parametrosFornecedor).where(eq(t.parametrosFornecedor.id, "atual")).limit(1),
      db.select().from(t.pagamentosFornecedor).orderBy(asc(t.pagamentosFornecedor.pagoEm)),
      db.select().from(t.anexos).where(eq(t.anexos.entidade, "pagamento_fornecedor")),
      db.select().from(t.faturasFornecedor).orderBy(asc(t.faturasFornecedor.de)),
      db.select().from(t.aliquotas),
      db.select().from(t.despesasFixas),
      db.select().from(t.dividas).orderBy(asc(t.dividas.contratadaEm)),
    ]);
  const anexoPorId = new Map(anexosFornecedor.map((a) => [a.id, a]));
  const [p] = parametros;
  return {
    parametros: p
      ? { fornecedor: p.fornecedor, custoPote: p.custoPote, freteEnvio: p.freteEnvio, atualizadoEm: p.atualizadoEm }
      : PARAMETROS_VAZIOS,
    pagamentosFornecedor: pagamentos.map(({ comprovanteAnexoId, ...resto }) => {
      const anexo = comprovanteAnexoId ? anexoPorId.get(comprovanteAnexoId) : null;
      return {
        ...resto,
        comprovante: anexo
          ? {
              id: anexo.id,
              nome: anexo.nome,
              tipo: anexo.tipo,
              tamanhoBytes: anexo.tamanhoBytes,
              mime: anexo.mime,
              criadoEm: anexo.criadoEm,
              criadoPor: anexo.criadoPor,
              url: urlDoAnexo(anexo.id),
            }
          : null,
      };
    }),
    faturas,
    aliquotas,
    despesas,
    dividas,
  };
}

export async function carregarMarketing(quem: Colaborador): Promise<DadosMarketing> {
  if (!podeVerMarketing(quem)) return { lancamentos: [], diasManuais: [] };
  const [lancamentos, diasManuais] = await Promise.all([
    db.select().from(t.lancamentosMetaAds).orderBy(asc(t.lancamentosMetaAds.data)),
    db.select().from(t.diasMetaAds).orderBy(asc(t.diasMetaAds.data)),
  ]);
  return { lancamentos, diasManuais };
}

export async function carregarDadosIniciais(ctx: ContextoSessao): Promise<DadosIniciais> {
  const quem = ctx.colaborador;
  const [equipe, cadastros, pedidos, financeiro, marketing] = await Promise.all([
    carregarEquipe(quem),
    carregarCadastros(quem),
    carregarPedidos(),
    carregarFinanceiro(quem),
    carregarMarketing(quem),
  ]);
  return {
    usuario: quem,
    email: ctx.email,
    doisFatores: ctx.doisFatores,
    equipe,
    cadastros,
    pedidos: pedidos.map(mascararPedido),
    financeiro,
    marketing,
  };
}
