import type {
  AliquotaMensal,
  BancoPlataforma,
  Despesa,
  Divida,
  FaturaFornecedor,
  PagamentoFornecedor,
} from "@/lib/types";
import { HOJE, iso, maisDias } from "./base";
import { competenciaAtras } from "./equipe";

export const BANCOS_PLATAFORMAS: BancoPlataforma[] = [
  {
    id: "bnc_0001",
    nome: "Banco Inter PJ",
    tipo: "banco",
    identificador: "Ag. 0001 / CC 48213-9",
    saldo: 4187540,
    taxaBps: 0,
    cor: "#f97316",
    ativo: true,
    fonte: "manual",
    atualizadoEm: iso(maisDias(HOJE, -0.2)),
  },
  {
    id: "bnc_0002",
    nome: "Cora",
    tipo: "banco",
    identificador: "Ag. 0001 / CC 10233-4",
    saldo: 1962310,
    taxaBps: 0,
    cor: "#e11d48",
    ativo: true,
    fonte: "manual",
    atualizadoEm: iso(maisDias(HOJE, -0.5)),
  },
  {
    id: "bnc_0003",
    nome: "Nubank PJ",
    tipo: "banco",
    identificador: "Ag. 0001 / CC 77410-2",
    saldo: 733890,
    taxaBps: 0,
    cor: "#7c3aed",
    ativo: true,
    fonte: "manual",
    atualizadoEm: iso(maisDias(HOJE, -1.1)),
  },
  {
    id: "plt_0001",
    nome: "VendLiber",
    tipo: "plataforma",
    identificador: "Lojista 44812",
    saldo: 2841600,
    taxaBps: 490,
    cor: "#0ea5e9",
    ativo: true,
    fonte: "manual",
    atualizadoEm: iso(maisDias(HOJE, -0.3)),
  },
];

export const BANCO_POR_ID = new Map(BANCOS_PLATAFORMAS.map((b) => [b.id, b]));

export const FATURAS_FORNECEDOR: FaturaFornecedor[] = [
  {
    id: "fat_0001",
    fornecedor: "NutriLab Manipulação",
    numero: "NF 14882",
    competencia: competenciaAtras(3),
    emitidaEm: iso(maisDias(HOJE, -104)),
    venceEm: iso(maisDias(HOJE, -74)),
    valor: 1116000,
    quantidadePotes: 400,
    status: "quitada",
    valorPago: 1116000,
    anexos: [],
  },
  {
    id: "fat_0002",
    fornecedor: "NutriLab Manipulação",
    numero: "NF 15037",
    competencia: competenciaAtras(2),
    emitidaEm: iso(maisDias(HOJE, -72)),
    venceEm: iso(maisDias(HOJE, -42)),
    valor: 1395000,
    quantidadePotes: 500,
    status: "quitada",
    valorPago: 1395000,
    anexos: [],
  },
  {
    id: "fat_0003",
    fornecedor: "NutriLab Manipulação",
    numero: "NF 15210",
    competencia: competenciaAtras(1),
    emitidaEm: iso(maisDias(HOJE, -41)),
    venceEm: iso(maisDias(HOJE, -11)),
    valor: 1674000,
    quantidadePotes: 600,
    status: "parcial",
    valorPago: 900000,
    anexos: [],
  },
  {
    id: "fat_0004",
    fornecedor: "Embalagens Vale Verde",
    numero: "NF 2299",
    competencia: competenciaAtras(1),
    emitidaEm: iso(maisDias(HOJE, -38)),
    venceEm: iso(maisDias(HOJE, -8)),
    valor: 218400,
    quantidadePotes: 0,
    status: "vencida",
    valorPago: 0,
    anexos: [],
  },
  {
    id: "fat_0005",
    fornecedor: "NutriLab Manipulação",
    numero: "NF 15388",
    competencia: competenciaAtras(0),
    emitidaEm: iso(maisDias(HOJE, -9)),
    venceEm: iso(maisDias(HOJE, 21)),
    valor: 1953000,
    quantidadePotes: 700,
    status: "aberta",
    valorPago: 0,
    anexos: [],
  },
];

export const PAGAMENTOS_FORNECEDOR: PagamentoFornecedor[] = [
  { id: "pfor_0001", faturaId: "fat_0001", valor: 558000, pagoEm: iso(maisDias(HOJE, -96)), bancoId: "bnc_0001", comprovanteAnexoId: null, observacoes: "Entrada de 50%." },
  { id: "pfor_0002", faturaId: "fat_0001", valor: 558000, pagoEm: iso(maisDias(HOJE, -75)), bancoId: "bnc_0001", comprovanteAnexoId: null, observacoes: null },
  { id: "pfor_0003", faturaId: "fat_0002", valor: 697500, pagoEm: iso(maisDias(HOJE, -64)), bancoId: "bnc_0002", comprovanteAnexoId: null, observacoes: null },
  { id: "pfor_0004", faturaId: "fat_0002", valor: 697500, pagoEm: iso(maisDias(HOJE, -43)), bancoId: "bnc_0002", comprovanteAnexoId: null, observacoes: null },
  { id: "pfor_0005", faturaId: "fat_0003", valor: 900000, pagoEm: iso(maisDias(HOJE, -30)), bancoId: "bnc_0001", comprovanteAnexoId: null, observacoes: "Restante negociado para o dia 25." },
];

export const ALIQUOTAS: AliquotaMensal[] = [
  { id: "ali_0001", competencia: competenciaAtras(5), aliquotaBps: 1450, faturamento: 18420000, imposto: 2670900, situacao: "confirmada", confirmadaEm: iso(maisDias(HOJE, -135)), observacoes: null },
  { id: "ali_0002", competencia: competenciaAtras(4), aliquotaBps: 1512, faturamento: 21180000, imposto: 3202416, situacao: "confirmada", confirmadaEm: iso(maisDias(HOJE, -104)), observacoes: null },
  { id: "ali_0003", competencia: competenciaAtras(3), aliquotaBps: 1570, faturamento: 23940000, imposto: 3758580, situacao: "confirmada", confirmadaEm: iso(maisDias(HOJE, -73)), observacoes: "Faixa mudou no Simples." },
  { id: "ali_0004", competencia: competenciaAtras(2), aliquotaBps: 1570, faturamento: 25610000, imposto: 4020770, situacao: "confirmada", confirmadaEm: iso(maisDias(HOJE, -42)), observacoes: null },
  { id: "ali_0005", competencia: competenciaAtras(1), aliquotaBps: 1610, faturamento: 27480000, imposto: 4424280, situacao: "estimada", confirmadaEm: null, observacoes: "Aguardando fechamento do contador." },
  { id: "ali_0006", competencia: competenciaAtras(0), aliquotaBps: 1610, faturamento: 13920000, imposto: 2241120, situacao: "estimada", confirmadaEm: null, observacoes: "Competência em curso." },
];

export const DESPESAS: Despesa[] = [
  { id: "des_0001", descricao: "Aluguel do galpão", categoria: "estrutura", recorrencia: "mensal", valor: 420000, competencia: competenciaAtras(0), venceEm: iso(maisDias(HOJE, 5)), pagaEm: null, bancoId: null, fonte: "manual" },
  { id: "des_0002", descricao: "Energia elétrica", categoria: "estrutura", recorrencia: "mensal", valor: 78400, competencia: competenciaAtras(0), venceEm: iso(maisDias(HOJE, 9)), pagaEm: null, bancoId: null, fonte: "manual" },
  { id: "des_0003", descricao: "Contrato Correios", categoria: "frete", recorrencia: "mensal", valor: 1284000, competencia: competenciaAtras(0), venceEm: iso(maisDias(HOJE, 12)), pagaEm: null, bancoId: null, fonte: "manual" },
  { id: "des_0004", descricao: "Investimento Meta Ads", categoria: "trafego", recorrencia: "mensal", valor: 4860000, competencia: competenciaAtras(0), venceEm: iso(maisDias(HOJE, 2)), pagaEm: null, bancoId: null, fonte: "manual" },
  { id: "des_0005", descricao: "Assinatura VendLiber", categoria: "ferramentas", recorrencia: "mensal", valor: 49900, competencia: competenciaAtras(0), venceEm: iso(maisDias(HOJE, -3)), pagaEm: iso(maisDias(HOJE, -3)), bancoId: "bnc_0002", fonte: "manual" },
  { id: "des_0006", descricao: "Chips e linhas de WhatsApp", categoria: "ferramentas", recorrencia: "mensal", valor: 32000, competencia: competenciaAtras(0), venceEm: iso(maisDias(HOJE, -6)), pagaEm: iso(maisDias(HOJE, -6)), bancoId: "bnc_0003", fonte: "manual" },
  { id: "des_0007", descricao: "Pró-labore", categoria: "equipe", recorrencia: "mensal", valor: 900000, competencia: competenciaAtras(0), venceEm: iso(maisDias(HOJE, 15)), pagaEm: null, bancoId: null, fonte: "manual" },
  { id: "des_0008", descricao: "Contador", categoria: "impostos", recorrencia: "mensal", valor: 128000, competencia: competenciaAtras(0), venceEm: iso(maisDias(HOJE, 10)), pagaEm: null, bancoId: null, fonte: "manual" },
  { id: "des_0009", descricao: "Compra de potes", categoria: "produto", recorrencia: "mensal", valor: 1953000, competencia: competenciaAtras(0), venceEm: iso(maisDias(HOJE, 21)), pagaEm: null, bancoId: null, fonte: "manual" },
  { id: "des_0010", descricao: "Manutenção do carro de coleta", categoria: "outros", recorrencia: "unica", valor: 142000, competencia: competenciaAtras(0), venceEm: iso(maisDias(HOJE, -11)), pagaEm: iso(maisDias(HOJE, -11)), bancoId: "bnc_0001", fonte: "manual" },
  { id: "des_0011", descricao: "Aluguel do galpão", categoria: "estrutura", recorrencia: "mensal", valor: 420000, competencia: competenciaAtras(1), venceEm: iso(maisDias(HOJE, -25)), pagaEm: iso(maisDias(HOJE, -25)), bancoId: "bnc_0001", fonte: "manual" },
  { id: "des_0012", descricao: "Contrato Correios", categoria: "frete", recorrencia: "mensal", valor: 1197000, competencia: competenciaAtras(1), venceEm: iso(maisDias(HOJE, -18)), pagaEm: iso(maisDias(HOJE, -18)), bancoId: "bnc_0001", fonte: "manual" },
  { id: "des_0013", descricao: "Investimento Meta Ads", categoria: "trafego", recorrencia: "mensal", valor: 5210000, competencia: competenciaAtras(1), venceEm: iso(maisDias(HOJE, -28)), pagaEm: iso(maisDias(HOJE, -28)), bancoId: "plt_0001", fonte: "manual" },
  { id: "des_0014", descricao: "Seguro do estoque", categoria: "outros", recorrencia: "anual", valor: 264000, competencia: competenciaAtras(4), venceEm: iso(maisDias(HOJE, -112)), pagaEm: iso(maisDias(HOJE, -112)), bancoId: "bnc_0002", fonte: "manual" },
];

function parcelas(quantidade: number, valor: number, primeiroVencimentoDias: number, pagasAte: number) {
  return Array.from({ length: quantidade }, (_, i) => ({
    numero: i + 1,
    valor,
    venceEm: iso(maisDias(HOJE, primeiroVencimentoDias + i * 30)),
    pagaEm: i < pagasAte ? iso(maisDias(HOJE, primeiroVencimentoDias + i * 30 - 1)) : null,
  }));
}

export const DIVIDAS: Divida[] = [
  {
    id: "div_0001",
    credor: "Banco Inter PJ",
    descricao: "Capital de giro para compra de estoque",
    valorOriginal: 3000000,
    jurosBps: 189,
    parcelas: parcelas(12, 281000, -210, 8),
    contratadaEm: iso(maisDias(HOJE, -240)),
    status: "em_dia",
  },
  {
    id: "div_0002",
    credor: "Embalagens Vale Verde",
    descricao: "Parcelamento de fatura vencida",
    valorOriginal: 218400,
    jurosBps: 250,
    parcelas: parcelas(3, 74600, -8, 0),
    contratadaEm: iso(maisDias(HOJE, -38)),
    status: "atrasada",
  },
];
