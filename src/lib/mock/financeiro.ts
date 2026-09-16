import type {
  AliquotaMensal,
  BancoPlataforma,
  DespesaFixa,
  Divida,
} from "@/lib/types";
import { SEM_TAXA } from "@/lib/types/financeiro";
import { HOJE, iso, maisDias } from "./base";
import { competenciaAtras } from "./equipe";

/**
 * Contas e plataformas da operação. As taxas são as do cadastro, conferidas
 * com o extrato — não vêm de API. Banco recebe boleto e Pix; plataforma só
 * oferece link de cartão.
 */
export const BANCOS_PLATAFORMAS: BancoPlataforma[] = [
  {
    id: "bnc_0001",
    nome: "Banco Inter PJ",
    tipo: "banco",
    identificador: "Ag. 0001 / CC 48213-9",
    saldo: 4187540,
    iconeUrl: null,
    cor: "#f97316",
    ativo: true,
    fonte: "manual",
    atualizadoEm: iso(maisDias(HOJE, -0.2)),
    boleto: { ativa: true, bps: 0, fixa: 349 },
    franquiaBoleto: { quantidade: 100, periodo: "mensal" },
    pix: { ativa: true, bps: 0, fixa: 0 },
    cartao: SEM_TAXA,
  },
  {
    id: "bnc_0002",
    nome: "Cora",
    tipo: "banco",
    identificador: "Ag. 0001 / CC 10233-4",
    saldo: 1962310,
    iconeUrl: null,
    cor: "#e11d48",
    ativo: true,
    fonte: "manual",
    atualizadoEm: iso(maisDias(HOJE, -0.5)),
    boleto: { ativa: true, bps: 0, fixa: 290 },
    franquiaBoleto: { quantidade: 100, periodo: "mensal" },
    pix: { ativa: true, bps: 0, fixa: 0 },
    cartao: SEM_TAXA,
  },
  {
    id: "bnc_0003",
    nome: "Nubank PJ",
    tipo: "banco",
    identificador: "Ag. 0001 / CC 77410-2",
    saldo: 733890,
    iconeUrl: null,
    cor: "#7c3aed",
    ativo: true,
    fonte: "manual",
    atualizadoEm: iso(maisDias(HOJE, -1.1)),
    boleto: { ativa: true, bps: 0, fixa: 390 },
    franquiaBoleto: { quantidade: 0, periodo: "mensal" },
    pix: { ativa: true, bps: 0, fixa: 0 },
    cartao: SEM_TAXA,
  },
  {
    id: "plt_0001",
    nome: "VendLiber",
    tipo: "plataforma",
    identificador: "Lojista 44812",
    saldo: 2841600,
    iconeUrl: null,
    cor: "#0ea5e9",
    ativo: true,
    fonte: "manual",
    atualizadoEm: iso(maisDias(HOJE, -0.3)),
    boleto: SEM_TAXA,
    franquiaBoleto: { quantidade: 0, periodo: "mensal" },
    pix: SEM_TAXA,
    cartao: { ativa: true, bps: 490, fixa: 99 },
  },
  {
    id: "plt_0002",
    nome: "Mercado Pago",
    tipo: "plataforma",
    identificador: "Lojista 2288140",
    saldo: 418200,
    iconeUrl: null,
    cor: "#22c55e",
    ativo: true,
    fonte: "manual",
    atualizadoEm: iso(maisDias(HOJE, -0.8)),
    boleto: SEM_TAXA,
    franquiaBoleto: { quantidade: 0, periodo: "mensal" },
    pix: SEM_TAXA,
    cartao: { ativa: true, bps: 449, fixa: 39 },
  },
];

export const BANCO_POR_ID = new Map(BANCOS_PLATAFORMAS.map((b) => [b.id, b]));

/**
 * Alíquotas confirmadas pelo contador. Agosto e setembro ainda não fecharam:
 * a tela usa a de julho e marca como estimada.
 */
export const ALIQUOTAS: AliquotaMensal[] = [
  { competencia: competenciaAtras(6), aliquotaBps: 528, lancadaEm: iso(maisDias(HOJE, -170)) },
  { competencia: competenciaAtras(5), aliquotaBps: 540, lancadaEm: iso(maisDias(HOJE, -140)) },
  { competencia: competenciaAtras(4), aliquotaBps: 547, lancadaEm: iso(maisDias(HOJE, -110)) },
  { competencia: competenciaAtras(3), aliquotaBps: 547, lancadaEm: iso(maisDias(HOJE, -79)) },
  { competencia: competenciaAtras(2), aliquotaBps: 561, lancadaEm: iso(maisDias(HOJE, -48)) },
];

/** Despesas fixas mensais. Pró-labore mora aqui e sai em linha própria no relatório. */
export const DESPESAS_FIXAS: DespesaFixa[] = [
  { id: "dsp_0001", descricao: "Assinatura VendLiber", categoria: "ferramentas", valor: 49900, diaVencimento: 5, desde: competenciaAtras(6), ate: null },
  { id: "dsp_0002", descricao: "Chatbot de WhatsApp", categoria: "ferramentas", valor: 18900, diaVencimento: 12, desde: competenciaAtras(6), ate: null },
  { id: "dsp_0003", descricao: "Ferramenta de disparo em massa", categoria: "ferramentas", valor: 29700, diaVencimento: 12, desde: competenciaAtras(6), ate: competenciaAtras(3) },
  { id: "dsp_0004", descricao: "Chips e planos das linhas", categoria: "telefonia", valor: 32000, diaVencimento: 8, desde: competenciaAtras(6), ate: null },
  { id: "dsp_0005", descricao: "Telefonia fixa (ramais)", categoria: "telefonia", valor: 11990, diaVencimento: 8, desde: competenciaAtras(6), ate: null },
  { id: "dsp_0006", descricao: "Internet fibra 500 Mb", categoria: "internet", valor: 14990, diaVencimento: 15, desde: competenciaAtras(6), ate: null },
  { id: "dsp_0007", descricao: "Sala comercial", categoria: "aluguel", valor: 180000, diaVencimento: 10, desde: competenciaAtras(6), ate: null },
  { id: "dsp_0008", descricao: "Energia elétrica", categoria: "energia", valor: 24000, diaVencimento: 20, desde: competenciaAtras(6), ate: null },
  { id: "dsp_0009", descricao: "Escritório de contabilidade", categoria: "contabilidade", valor: 89000, diaVencimento: 10, desde: competenciaAtras(6), ate: null },
  { id: "dsp_0010", descricao: "Pró-labore Rafael", categoria: "pro_labore", valor: 250000, diaVencimento: 5, desde: competenciaAtras(6), ate: null },
];

function parcelas(quantidade: number, valor: number, primeiroVencimentoDias: number) {
  return Array.from({ length: quantidade }, (_, i) => {
    const vence = primeiroVencimentoDias + i * 30;
    return {
      numero: i + 1,
      valor,
      venceEm: iso(maisDias(HOJE, vence)),
      // Pagas na véspera, até a última que já venceu.
      pagaEm: vence < 0 ? iso(maisDias(HOJE, vence - 1)) : null,
    };
  });
}

export const DIVIDAS: Divida[] = [
  {
    id: "div_0001",
    credor: "Banco Inter PJ",
    descricao: "Capital de giro para compra de estoque",
    valorOriginal: 1200000,
    jurosBps: 189,
    parcelas: parcelas(12, 118000, -200),
    contratadaEm: iso(maisDias(HOJE, -230)),
  },
  {
    id: "div_0002",
    credor: "Mercado Pago",
    descricao: "Empréstimo para campanha de julho",
    valorOriginal: 300000,
    jurosBps: 290,
    parcelas: parcelas(6, 57500, -58),
    contratadaEm: iso(maisDias(HOJE, -88)),
  },
];
