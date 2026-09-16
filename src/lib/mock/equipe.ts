import type {
  Colaborador,
  Conquista,
  ConquistaDesbloqueada,
  Meta,
  Nivel,
  PagamentoColaborador,
  RegraComissao,
} from "@/lib/types";
import { competencia, iso, maisDias, HOJE } from "./base";

export const NIVEIS: Nivel[] = [
  { id: "niv_0001", nome: "Bronze", ordem: 1, pontosNecessarios: 0, icone: "medalha" },
  { id: "niv_0002", nome: "Prata", ordem: 2, pontosNecessarios: 500, icone: "medalha" },
  { id: "niv_0003", nome: "Ouro", ordem: 3, pontosNecessarios: 1500, icone: "ranking" },
  { id: "niv_0004", nome: "Platina", ordem: 4, pontosNecessarios: 3500, icone: "ranking" },
  { id: "niv_0005", nome: "Diamante", ordem: 5, pontosNecessarios: 7000, icone: "aparencia" },
];

export const COLABORADORES: Colaborador[] = [
  {
    id: "col_0001",
    nome: "Rafael Prado",
    apelido: "Rafa",
    email: "rafael@axis.com.br",
    telefone: "11987450012",
    perfil: "admin",
    setor: "administracao",
    avatarUrl: null,
    ativo: true,
    entrouEm: iso(maisDias(HOJE, -640)),
    vendedoresAtribuidos: [],
    nivelId: "niv_0005",
    pontos: 8420,
  },
  {
    id: "col_0002",
    nome: "Camila Duarte",
    apelido: "Camila",
    email: "camila@axis.com.br",
    telefone: "11991230045",
    perfil: "vendedor",
    setor: "vendas",
    avatarUrl: null,
    ativo: true,
    entrouEm: iso(maisDias(HOJE, -380)),
    vendedoresAtribuidos: [],
    nivelId: "niv_0004",
    pontos: 4180,
  },
  {
    id: "col_0003",
    nome: "Diego Nunes",
    apelido: "Diego",
    email: "diego@axis.com.br",
    telefone: "11994560078",
    perfil: "vendedor",
    setor: "vendas",
    avatarUrl: null,
    ativo: true,
    entrouEm: iso(maisDias(HOJE, -210)),
    vendedoresAtribuidos: [],
    nivelId: "niv_0003",
    pontos: 2240,
  },
  {
    id: "col_0004",
    nome: "Leticia Moraes",
    apelido: "Lele",
    email: "leticia@axis.com.br",
    telefone: "11996780090",
    perfil: "vendedor",
    setor: "vendas",
    avatarUrl: null,
    ativo: true,
    entrouEm: iso(maisDias(HOJE, -95)),
    vendedoresAtribuidos: [],
    nivelId: "niv_0002",
    pontos: 780,
  },
  {
    id: "col_0005",
    nome: "Wagner Batista",
    apelido: "Wagner",
    email: "wagner@axis.com.br",
    telefone: "11993450067",
    perfil: "financeiro",
    setor: "financeiro",
    avatarUrl: null,
    ativo: true,
    entrouEm: iso(maisDias(HOJE, -300)),
    vendedoresAtribuidos: ["col_0002", "col_0003", "col_0004"],
    nivelId: "niv_0003",
    pontos: 2960,
  },
];

export const VENDEDORES = COLABORADORES.filter((c) => c.perfil === "vendedor");
export const COLABORADOR_POR_ID = new Map(COLABORADORES.map((c) => [c.id, c]));
export const NIVEL_POR_ID = new Map(NIVEIS.map((n) => [n.id, n]));

export function nomeColaborador(id: string | null): string {
  if (!id) return "—";
  return COLABORADOR_POR_ID.get(id)?.nome ?? "—";
}

/** Usuário da sessão simulada para cada perfil do seletor de desenvolvimento. */
export const USUARIO_POR_PERFIL = {
  admin: COLABORADORES[0],
  vendedor: COLABORADORES[1],
  financeiro: COLABORADORES[4],
} as const;

export const REGRAS_COMISSAO: RegraComissao[] = [
  {
    id: "rc_0001",
    nome: "Vendas, por pedido agendado",
    setor: "vendas",
    base: "por_pedido",
    valor: 1200,
    minimoMensal: 40,
    vigenteDesde: iso(maisDias(HOJE, -365)),
    ativa: true,
  },
  {
    id: "rc_0002",
    nome: "Vendas, bônus sobre o valor pago",
    setor: "vendas",
    base: "percentual_valor",
    valor: 150,
    minimoMensal: 0,
    vigenteDesde: iso(maisDias(HOJE, -180)),
    ativa: true,
  },
  {
    id: "rc_0003",
    nome: "Cobrança, por pedido pago",
    setor: "financeiro",
    base: "por_pedido",
    valor: 600,
    minimoMensal: 30,
    vigenteDesde: iso(maisDias(HOJE, -300)),
    ativa: true,
  },
  {
    id: "rc_0004",
    nome: "Administração, fixo mensal",
    setor: "administracao",
    base: "fixo_mensal",
    valor: 450000,
    minimoMensal: 0,
    vigenteDesde: iso(maisDias(HOJE, -640)),
    ativa: true,
  },
];

export const METAS: Meta[] = [
  {
    id: "meta_0001",
    nome: "Meta diária de vendas",
    setor: "vendas",
    periodo: "diaria",
    alvo: 12,
    baseContagem: "agendados_menos_cancelados",
    premioDescricao: "Bônus do dia",
    premioValor: 5000,
    ativa: true,
  },
  {
    id: "meta_0002",
    nome: "Meta semanal de vendas",
    setor: "vendas",
    periodo: "semanal",
    alvo: 60,
    baseContagem: "agendados_menos_cancelados",
    premioDescricao: "Folga na segunda",
    premioValor: null,
    ativa: true,
  },
  {
    id: "meta_0003",
    nome: "Meta mensal de vendas",
    setor: "vendas",
    periodo: "mensal",
    alvo: 240,
    baseContagem: "agendados_menos_cancelados",
    premioDescricao: "Bônus de R$ 800,00",
    premioValor: 80000,
    ativa: true,
  },
  {
    id: "meta_0004",
    nome: "Meta diária de cobrança",
    setor: "financeiro",
    periodo: "diaria",
    alvo: 10,
    baseContagem: "pagos_atribuidos",
    premioDescricao: "Bônus do dia",
    premioValor: 4000,
    ativa: true,
  },
  {
    id: "meta_0005",
    nome: "Meta mensal de cobrança",
    setor: "financeiro",
    periodo: "mensal",
    alvo: 200,
    baseContagem: "pagos_atribuidos",
    premioDescricao: "Bônus de R$ 600,00",
    premioValor: 60000,
    ativa: true,
  },
];

export const CONQUISTAS: Conquista[] = [
  {
    id: "conq_0001",
    nome: "Primeiro pedido",
    descricao: "Você tirou seu primeiro pedido.",
    icone: "aparencia",
    pontos: 50,
    criterio: "1 pedido agendado",
  },
  {
    id: "conq_0002",
    nome: "Semana cheia",
    descricao: "Bateu a meta diária cinco dias seguidos.",
    icone: "tendencia",
    pontos: 200,
    criterio: "5 metas diárias consecutivas",
  },
  {
    id: "conq_0003",
    nome: "Centena",
    descricao: "100 pedidos agendados no total.",
    icone: "ranking",
    pontos: 300,
    criterio: "100 pedidos agendados",
  },
  {
    id: "conq_0004",
    nome: "Fechador",
    descricao: "Dez pedidos de Kit Resultado num mês.",
    icone: "metas",
    pontos: 250,
    criterio: "10 Kit Resultado na competência",
  },
  {
    id: "conq_0005",
    nome: "Zero frustrado",
    descricao: "Um mês inteiro sem cancelamento.",
    icone: "autorizar",
    pontos: 400,
    criterio: "0 cancelados na competência",
  },
  {
    id: "conq_0006",
    nome: "Cobrador de ferro",
    descricao: "50 pedidos pagos num mês.",
    icone: "dinheiro",
    pontos: 300,
    criterio: "50 pedidos pagos na competência",
  },
  {
    id: "conq_0007",
    nome: "Recuperador",
    descricao: "Trouxe de volta dez pedidos que iam virar inadimplência.",
    icone: "devolver",
    pontos: 350,
    criterio: "10 recuperações após a terceira tentativa",
  },
  {
    id: "conq_0008",
    nome: "Mês redondo",
    descricao: "Bateu a meta mensal do seu setor.",
    icone: "medalha",
    pontos: 500,
    criterio: "Meta mensal batida",
  },
];

export const CONQUISTAS_DESBLOQUEADAS: ConquistaDesbloqueada[] = [
  { conquistaId: "conq_0001", colaboradorId: "col_0002", desbloqueadaEm: iso(maisDias(HOJE, -375)) },
  { conquistaId: "conq_0003", colaboradorId: "col_0002", desbloqueadaEm: iso(maisDias(HOJE, -240)) },
  { conquistaId: "conq_0008", colaboradorId: "col_0002", desbloqueadaEm: iso(maisDias(HOJE, -46)) },
  { conquistaId: "conq_0002", colaboradorId: "col_0002", desbloqueadaEm: iso(maisDias(HOJE, -12)) },
  { conquistaId: "conq_0001", colaboradorId: "col_0003", desbloqueadaEm: iso(maisDias(HOJE, -205)) },
  { conquistaId: "conq_0003", colaboradorId: "col_0003", desbloqueadaEm: iso(maisDias(HOJE, -58)) },
  { conquistaId: "conq_0001", colaboradorId: "col_0004", desbloqueadaEm: iso(maisDias(HOJE, -92)) },
  { conquistaId: "conq_0001", colaboradorId: "col_0005", desbloqueadaEm: iso(maisDias(HOJE, -296)) },
  { conquistaId: "conq_0006", colaboradorId: "col_0005", desbloqueadaEm: iso(maisDias(HOJE, -75)) },
  { conquistaId: "conq_0007", colaboradorId: "col_0005", desbloqueadaEm: iso(maisDias(HOJE, -20)) },
];

export function competenciaAtras(meses: number): string {
  const d = new Date(HOJE);
  d.setMonth(d.getMonth() - meses);
  return competencia(d);
}

export const PAGAMENTOS_COLABORADOR: PagamentoColaborador[] = [
  { id: "pcol_0001", colaboradorId: "col_0002", competencia: competenciaAtras(2), comissao: 312000, bonus: 80000, descontos: 0, total: 392000, status: "pago", pagoEm: iso(maisDias(HOJE, -48)), bancoId: "bnc_0001", observacoes: null },
  { id: "pcol_0002", colaboradorId: "col_0003", competencia: competenciaAtras(2), comissao: 224400, bonus: 0, descontos: 0, total: 224400, status: "pago", pagoEm: iso(maisDias(HOJE, -48)), bancoId: "bnc_0001", observacoes: null },
  { id: "pcol_0003", colaboradorId: "col_0005", competencia: competenciaAtras(2), comissao: 138000, bonus: 60000, descontos: 0, total: 198000, status: "pago", pagoEm: iso(maisDias(HOJE, -48)), bancoId: "bnc_0001", observacoes: null },
  { id: "pcol_0004", colaboradorId: "col_0002", competencia: competenciaAtras(1), comissao: 298800, bonus: 80000, descontos: 0, total: 378800, status: "pago", pagoEm: iso(maisDias(HOJE, -16)), bancoId: "bnc_0002", observacoes: null },
  { id: "pcol_0005", colaboradorId: "col_0003", competencia: competenciaAtras(1), comissao: 241200, bonus: 0, descontos: 4500, total: 236700, status: "pago", pagoEm: iso(maisDias(HOJE, -16)), bancoId: "bnc_0002", observacoes: "Desconto de vale adiantado." },
  { id: "pcol_0006", colaboradorId: "col_0004", competencia: competenciaAtras(1), comissao: 96000, bonus: 0, descontos: 0, total: 96000, status: "pago", pagoEm: iso(maisDias(HOJE, -16)), bancoId: "bnc_0002", observacoes: null },
  { id: "pcol_0007", colaboradorId: "col_0005", competencia: competenciaAtras(1), comissao: 151200, bonus: 60000, descontos: 0, total: 211200, status: "pago", pagoEm: iso(maisDias(HOJE, -16)), bancoId: "bnc_0002", observacoes: null },
  { id: "pcol_0008", colaboradorId: "col_0002", competencia: competenciaAtras(0), comissao: 168000, bonus: 0, descontos: 0, total: 168000, status: "previsto", pagoEm: null, bancoId: null, observacoes: "Competência ainda em aberto." },
  { id: "pcol_0009", colaboradorId: "col_0003", competencia: competenciaAtras(0), comissao: 132000, bonus: 0, descontos: 0, total: 132000, status: "previsto", pagoEm: null, bancoId: null, observacoes: null },
  { id: "pcol_0010", colaboradorId: "col_0004", competencia: competenciaAtras(0), comissao: 74400, bonus: 0, descontos: 0, total: 74400, status: "previsto", pagoEm: null, bancoId: null, observacoes: null },
  { id: "pcol_0011", colaboradorId: "col_0005", competencia: competenciaAtras(0), comissao: 88800, bonus: 0, descontos: 0, total: 88800, status: "aprovado", pagoEm: null, bancoId: null, observacoes: null },
];
