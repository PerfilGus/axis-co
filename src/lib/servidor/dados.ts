import "server-only";
import { asc, desc, eq, gte } from "drizzle-orm";
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
  LancamentoPontos,
  LinhaWhatsApp,
  Meta,
  Nivel,
  PagamentoColaborador,
  PagamentoFornecedor,
  ParametrosFornecedor,
  Pedido,
  Produto,
  Recompensa,
  RecompensaLiberada,
  RegraPontuacao,
} from "@/lib/types";
import { ocultarCPF, ocultarTelefone } from "@/lib/format";
import { iso } from "@/lib/iso";
import { competenciaAnterior, competenciaAtual, hoje, intervaloDeDias } from "@/lib/periodos";
import { podeVerFinanceiro, podeVerMarketing, ehAdmin } from "@/lib/permissoes";
import { db } from "./db";
import * as t from "./schema";
import { carregarPedidos, urlDoAnexo } from "./repositorio/pedidos";
import type { ContextoSessao } from "./sessao";
import type { EstadoNotificacoes } from "@/lib/notificacoes";
import { carregarNotificacoes } from "./notificacoes";

/**
 * O que a interface recebe ao abrir o sistema.
 *
 * Tudo sai daqui já recortado para quem pediu: remuneração só a própria,
 * financeiro e marketing só para o admin, e CPF e telefone de cliente sempre
 * mascarados — o dado completo só vem pelo detalhe, com registro.
 */

export interface DadosEquipe {
  colaboradores: Colaborador[];
  regras: RegraPontuacao[];
  metas: Meta[];
  niveis: Nivel[];
  conquistas: Conquista[];
  desbloqueadas: ConquistaDesbloqueada[];
  recompensas: Recompensa[];
  recompensasLiberadas: RecompensaLiberada[];
  bonusNivel: BonusNivel[];
  pagamentos: PagamentoColaborador[];
  /**
   * Extrato desde o começo do mês passado: é o que metas, ranking e Minha área
   * precisam medir. Período mais longo vem pela ação `extratoDePontos`.
   */
  lancamentos: LancamentoPontos[];
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
  notificacoes: EstadoNotificacoes;
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
  const desde = iso(intervaloDeDias(`${competenciaAnterior(competenciaAtual())}-01`, hoje()).inicio);
  const [
    colaboradores,
    regras,
    metas,
    niveis,
    conquistas,
    desbloqueadas,
    recompensas,
    liberadas,
    bonus,
    pagamentos,
    lancamentos,
  ] = await Promise.all([
    db.select().from(t.colaboradores).orderBy(asc(t.colaboradores.nome)),
    db.select().from(t.regrasPontuacao).orderBy(asc(t.regrasPontuacao.vigenteDesde)),
    db.select().from(t.metas),
    db.select().from(t.niveis).orderBy(asc(t.niveis.ordem)),
    db.select().from(t.conquistas),
    db.select().from(t.conquistasDesbloqueadas),
    db.select().from(t.recompensas),
    db.select().from(t.recompensasLiberadas),
    db.select().from(t.bonusNivel),
    db.select().from(t.pagamentosColaborador),
    db
      .select()
      .from(t.lancamentosPontos)
      .where(gte(t.lancamentosPontos.ocorridoEm, desde))
      .orderBy(desc(t.lancamentosPontos.ocorridoEm)),
  ]);
  const admin = ehAdmin(quem);
  const meuOuTodos = <T extends { colaboradorId: string }>(lista: T[]) =>
    admin ? lista : lista.filter((x) => x.colaboradorId === quem.id);
  return {
    colaboradores: colaboradores.map((c) => recortarColaborador(c, quem)),
    regras,
    metas,
    niveis,
    conquistas,
    desbloqueadas: desbloqueadas.map(({ conquistaId, colaboradorId, janela, pontos, desbloqueadaEm }) => ({
      conquistaId,
      colaboradorId,
      janela,
      pontos,
      desbloqueadaEm,
    })),
    recompensas: admin
      ? recompensas
      : recompensas.filter((r) => r.colaboradorId === null || r.colaboradorId === quem.id),
    recompensasLiberadas: meuOuTodos(liberadas),
    bonusNivel: meuOuTodos(bonus),
    pagamentos: meuOuTodos(pagamentos),
    // O extrato de todos alimenta o ranking por pontos; não tem dado de cliente.
    lancamentos,
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
              removidoEm: anexo.removidoEm,
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
  const [equipe, cadastros, pedidos, financeiro, marketing, notificacoes] = await Promise.all([
    carregarEquipe(quem),
    carregarCadastros(quem),
    carregarPedidos(),
    carregarFinanceiro(quem),
    carregarMarketing(quem),
    carregarNotificacoes(quem),
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
    notificacoes,
  };
}
