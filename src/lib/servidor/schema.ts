import {
  bigint,
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { iso } from "@/lib/iso";
import type {
  BonusNivel,
  Cobranca,
  CustosPedido,
  Endereco,
  FaixaMeta,
  FranquiaBoleto,
  ItemKit,
  ItemPedido,
  LinhaDetalhe,
  ParcelaDivida,
  Rastreio,
  TaxaForma,
} from "@/lib/types";

/**
 * Schema do banco.
 *
 * As chaves ficam em camelCase, iguais aos contratos de `lib/types`; o Drizzle
 * grava em snake_case (`casing` em `db.ts` e `drizzle.config.ts`). Assim uma
 * linha lida já tem o formato do tipo, sem camada de conversão.
 *
 * Datas com hora são `timestamptz` e trafegam como ISO -03:00 (`dataISO`).
 * Dias e competências são `date`/texto `aaaa-mm-dd` e `aaaa-mm`.
 */

/** `timestamptz` lido e escrito como ISO de São Paulo. */
const dataISO = customType<{ data: string; driverData: string | Date }>({
  dataType: () => "timestamp with time zone",
  toDriver: (valor) => valor,
  fromDriver: (valor) => iso(valor instanceof Date ? valor : new Date(valor)),
});

/** `timestamptz` como `Date`, para as tabelas do Better Auth. */
const instante = customType<{ data: Date; driverData: string | Date }>({
  dataType: () => "timestamp with time zone",
  toDriver: (valor) => valor.toISOString(),
  fromDriver: (valor) => (valor instanceof Date ? valor : new Date(valor)),
});

/* ================================================================
   Autenticação (Better Auth)
   ================================================================ */

export const user = pgTable("user", {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean().notNull().default(false),
  image: text(),
  createdAt: instante().notNull(),
  updatedAt: instante().notNull(),
  /* admin */
  role: text(),
  banned: boolean().default(false),
  banReason: text(),
  banExpires: instante(),
  /* two-factor */
  twoFactorEnabled: boolean().default(false),
  /* regras do sistema */
  /** Senha provisória: o próximo acesso obriga a troca. */
  trocarSenha: boolean().notNull().default(true),
  /** Aceite do termo de confidencialidade. Nulo até o primeiro aceite. */
  termoAceitoEm: instante(),
  termoVersao: text(),
  /** Falhas de login seguidas; zera no acerto. */
  falhasLogin: integer().notNull().default(0),
  bloqueadoAte: instante(),
});

export const session = pgTable(
  "session",
  {
    id: text().primaryKey(),
    expiresAt: instante().notNull(),
    token: text().notNull().unique(),
    createdAt: instante().notNull(),
    updatedAt: instante().notNull(),
    ipAddress: text(),
    userAgent: text(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    impersonatedBy: text(),
  },
  (t) => [index().on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text().primaryKey(),
    accountId: text().notNull(),
    providerId: text().notNull(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: instante(),
    refreshTokenExpiresAt: instante(),
    scope: text(),
    password: text(),
    createdAt: instante().notNull(),
    updatedAt: instante().notNull(),
  },
  (t) => [index().on(t.userId)],
);

export const verification = pgTable("verification", {
  id: text().primaryKey(),
  identifier: text().notNull(),
  value: text().notNull(),
  expiresAt: instante().notNull(),
  createdAt: instante().notNull(),
  updatedAt: instante().notNull(),
});

export const twoFactor = pgTable(
  "two_factor",
  {
    id: text().primaryKey(),
    secret: text().notNull(),
    backupCodes: text().notNull(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    verified: boolean().default(true),
    failedVerificationCount: integer().default(0),
    lockedUntil: instante(),
  },
  (t) => [index().on(t.userId), index().on(t.secret)],
);

export const rateLimit = pgTable("rate_limit", {
  id: text().primaryKey(),
  key: text().notNull().unique(),
  count: integer().notNull(),
  lastRequest: bigint({ mode: "number" }).notNull(),
});

/* ================================================================
   Atividades — linha do tempo, notificações e auditoria (LGPD)
   ================================================================ */

export const atividades = pgTable(
  "atividades",
  {
    id: text().primaryKey(),
    /** Nulo quando o evento não tem autor humano (integração, sistema). */
    usuarioId: text(),
    papel: text(),
    /** Verbo do evento: `login`, `criacao`, `edicao`, `status`, `pagamento`… */
    acao: text().notNull(),
    /** `pedido`, `cliente`, `colaborador`, `produto`, `sessao`… */
    entidade: text().notNull(),
    entidadeId: text(),
    ocorridoEm: dataISO().notNull(),
    titulo: text(),
    descricao: text(),
    antes: jsonb(),
    depois: jsonb(),
    /** Campos da linha do tempo do pedido: tipo, status, valor e fonte. */
    dados: jsonb().$type<Record<string, unknown>>(),
    ip: text(),
    userAgent: text(),
  },
  (t) => [
    index().on(t.entidade, t.entidadeId, t.ocorridoEm),
    index().on(t.usuarioId, t.ocorridoEm),
    index().on(t.ocorridoEm),
  ],
);

/* ================================================================
   Equipe
   ================================================================ */

export const colaboradores = pgTable("colaboradores", {
  /** O mesmo id do usuário de login. */
  id: text()
    .primaryKey()
    .references(() => user.id, { onDelete: "restrict" }),
  nome: text().notNull(),
  apelido: text().notNull(),
  email: text().notNull(),
  telefone: text().notNull().default(""),
  perfil: text().$type<"admin" | "vendedor" | "cobrador">().notNull(),
  setor: text().$type<"vendas" | "financeiro" | "administracao">().notNull(),
  avatarUrl: text(),
  ativo: boolean().notNull().default(true),
  entrouEm: dataISO().notNull(),
  vendedoresAtribuidos: jsonb().$type<string[]>().notNull().default([]),
  nivelId: text(),
  pontos: integer().notNull().default(0),
  salarioFixo: integer().notNull().default(0),
  diaPagamento: integer().notNull().default(5),
  chavePix: text(),
  comissaoBps: integer().notNull().default(0),
  frustradoBps: integer(),
});

export const metas = pgTable("metas", {
  id: text().primaryKey(),
  colaboradorId: text()
    .notNull()
    .references(() => colaboradores.id),
  nome: text().notNull(),
  tipo: text().$type<"pedidos" | "faturamento">().notNull(),
  periodo: text().$type<"diaria" | "semanal" | "mensal">().notNull(),
  faixas: jsonb().$type<FaixaMeta[]>().notNull(),
  ativa: boolean().notNull().default(true),
});

export const niveis = pgTable("niveis", {
  id: text().primaryKey(),
  nome: text().notNull(),
  ordem: integer().notNull(),
  pontosNecessarios: integer().notNull(),
  bonus: integer().notNull().default(0),
  icone: text().notNull(),
});

export const conquistas = pgTable("conquistas", {
  id: text().primaryKey(),
  nome: text().notNull(),
  descricao: text().notNull(),
  icone: text().notNull(),
  pontos: integer().notNull(),
  gatilho: text()
    .$type<
      | "meta_diaria"
      | "meta_semanal"
      | "meta_mensal"
      | "domingo_feriado"
      | "dias_trabalhados"
      | "marco"
    >()
    .notNull(),
  repetivel: boolean().notNull().default(false),
  criterio: text().notNull(),
  ativa: boolean().notNull().default(true),
});

export const conquistasDesbloqueadas = pgTable(
  "conquistas_desbloqueadas",
  {
    id: serial().primaryKey(),
    conquistaId: text()
      .notNull()
      .references(() => conquistas.id),
    colaboradorId: text()
      .notNull()
      .references(() => colaboradores.id),
    desbloqueadaEm: dataISO().notNull(),
  },
  (t) => [index().on(t.colaboradorId)],
);

export const bonusNivel = pgTable("bonus_nivel", {
  id: text().primaryKey(),
  colaboradorId: text()
    .notNull()
    .references(() => colaboradores.id),
  nivelId: text()
    .notNull()
    .references(() => niveis.id),
  valor: integer().notNull(),
  liberadoEm: dataISO().notNull(),
  status: text().$type<BonusNivel["status"]>().notNull(),
  pagoEm: dataISO(),
});

export const pagamentosColaborador = pgTable(
  "pagamentos_colaborador",
  {
    id: text().primaryKey(),
    colaboradorId: text()
      .notNull()
      .references(() => colaboradores.id),
    competencia: text().notNull(),
    fixo: integer().notNull(),
    comissao: integer().notNull(),
    bonusMeta: integer().notNull(),
    bonusNivel: integer().notNull(),
    total: integer().notNull(),
    pagarEm: dataISO().notNull(),
    status: text().$type<"pendente" | "pago">().notNull(),
    pagoEm: dataISO(),
    detalhamento: jsonb().$type<LinhaDetalhe[]>().notNull(),
    bonusNivelIds: jsonb().$type<string[]>().notNull(),
  },
  (t) => [uniqueIndex().on(t.colaboradorId, t.competencia)],
);

/* ================================================================
   Cadastros
   ================================================================ */

export const produtos = pgTable("produtos", {
  id: text().primaryKey(),
  nome: text().notNull(),
  sabor: text(),
  gramas: integer().notNull(),
  custoUnitario: integer().notNull(),
  fotoUrl: text(),
  ativo: boolean().notNull().default(true),
  criadoEm: dataISO().notNull(),
});

export const kits = pgTable("kits", {
  id: text().primaryKey(),
  nome: text().notNull(),
  descricao: text().notNull(),
  itens: jsonb().$type<ItemKit[]>().notNull(),
  precoTabela: integer().notNull(),
  precoMinimo: integer().notNull(),
  freteEstimado: integer().notNull(),
  ativo: boolean().notNull().default(true),
  criadoEm: dataISO().notNull(),
});

export const linhasWhatsapp = pgTable("linhas_whatsapp", {
  id: text().primaryKey(),
  nome: text().notNull(),
  numero: text().notNull(),
  vendedoresIds: jsonb().$type<string[]>().notNull(),
  ativa: boolean().notNull().default(true),
  criadaEm: dataISO().notNull(),
});

export const criativos = pgTable("criativos", {
  id: text().primaryKey(),
  nome: text().notNull(),
  codigo: text().notNull(),
  variacao: text(),
  formato: text().$type<"video" | "imagem" | "carrossel">().notNull(),
  linhaWhatsappId: text()
    .notNull()
    .references(() => linhasWhatsapp.id),
  anuncioMeta: text(),
  thumbUrl: text(),
  ativo: boolean().notNull().default(true),
  criadoEm: dataISO().notNull(),
});

export const bancosPlataformas = pgTable("bancos_plataformas", {
  id: text().primaryKey(),
  nome: text().notNull(),
  tipo: text().$type<"banco" | "plataforma">().notNull(),
  identificador: text().notNull(),
  saldo: integer().notNull().default(0),
  iconeUrl: text(),
  cor: text().notNull(),
  ativo: boolean().notNull().default(true),
  fonte: text().$type<"manual" | "api">().notNull().default("manual"),
  atualizadoEm: dataISO().notNull(),
  boleto: jsonb().$type<TaxaForma>().notNull(),
  franquiaBoleto: jsonb().$type<FranquiaBoleto>().notNull(),
  pix: jsonb().$type<TaxaForma>().notNull(),
  cartao: jsonb().$type<TaxaForma>().notNull(),
});

/* ================================================================
   Operação
   ================================================================ */

export const clientes = pgTable(
  "clientes",
  {
    id: text().primaryKey(),
    nome: text().notNull(),
    telefone: text().notNull(),
    cpf: text(),
    endereco: jsonb().$type<Endereco>().notNull(),
    observacoes: text(),
    criadoEm: dataISO().notNull(),
  },
  (t) => [index().on(t.cpf), index().on(t.telefone)],
);

export const pedidos = pgTable(
  "pedidos",
  {
    id: text().primaryKey(),
    /** Sequência que forma o código curto `AX-1001`. */
    numero: serial().notNull().unique(),
    status: text()
      .$type<
        | "agendado"
        | "aguardando_autorizacao"
        | "autorizado"
        | "em_transito"
        | "entregue"
        | "pago"
        | "cancelado"
        | "reembolsado"
        | "inadimplente"
      >()
      .notNull(),
    clienteId: text()
      .notNull()
      .references(() => clientes.id),
    itens: jsonb().$type<ItemPedido[]>().notNull(),
    valorTotal: integer().notNull(),
    frete: integer().notNull(),
    vendedorId: text()
      .notNull()
      .references(() => colaboradores.id),
    criativoId: text(),
    linhaWhatsappId: text(),
    agendadoPara: dataISO(),
    criadoEm: dataISO().notNull(),
    autorizadoEm: dataISO(),
    autorizadoPor: text(),
    rastreio: jsonb().$type<Rastreio | null>(),
    /** Rastreio apagado da aba Rastreio; o pedido e o código ficam. */
    rastreioRemovidoEm: dataISO(),
    cobranca: jsonb().$type<Cobranca>().notNull(),
    custos: jsonb().$type<CustosPedido>().notNull(),
    confirmacaoPorTexto: boolean().notNull().default(false),
    enderecoValidado: boolean().notNull().default(false),
    motivoCancelamento: text(),
    observacoes: text(),
    fonte: text().$type<"manual" | "api">().notNull().default("manual"),
    atualizadoEm: dataISO().notNull(),
    /** Entrada num status que encerra a retenção de arquivos (`lib/retencao.ts`). */
    finalizadoEm: dataISO(),
  },
  (t) => [index().on(t.vendedorId), index().on(t.status), index().on(t.criadoEm)],
);

export const ajustes = pgTable(
  "ajustes",
  {
    id: text().primaryKey(),
    pedidoId: text()
      .notNull()
      .references(() => pedidos.id, { onDelete: "cascade" }),
    tipo: text()
      .$type<"desconto" | "acrescimo" | "alteracao_cadastral" | "exclusao">()
      .notNull(),
    valorAnterior: integer().notNull(),
    valorSolicitado: integer().notNull(),
    motivo: text().notNull(),
    solicitadoPor: text().notNull(),
    solicitadoEm: dataISO().notNull(),
    status: text().$type<"pendente" | "aprovado" | "recusado">().notNull(),
    decididoPor: text(),
    decididoEm: dataISO(),
    observacaoDecisao: text(),
  },
  (t) => [index().on(t.pedidoId)],
);

/**
 * Arquivos enviados. O conteúdo fica no Vercel Blob privado; aqui só o
 * caminho. Ninguém recebe o endereço do Blob: a leitura passa por
 * `/api/anexos/[id]`, que confere a sessão e a permissão.
 */
export const anexos = pgTable(
  "anexos",
  {
    id: text().primaryKey(),
    nome: text().notNull(),
    tipo: text()
      .$type<
        | "print_confirmacao"
        | "audio_confirmacao"
        | "comprovante"
        | "foto_entrega"
        | "nota_fiscal"
        | "documento"
        | "outro"
      >()
      .notNull(),
    tamanhoBytes: integer().notNull(),
    mime: text().notNull(),
    criadoEm: dataISO().notNull(),
    criadoPor: text().notNull(),
    caminhoBlob: text().notNull(),
    /** A que o arquivo pertence: `pedido`, `pagamento_fornecedor`. */
    entidade: text().notNull(),
    entidadeId: text(),
    /** Conteúdo apagado do Blob pela retenção; o registro fica. */
    removidoEm: dataISO(),
  },
  (t) => [index().on(t.entidade, t.entidadeId)],
);

/* ================================================================
   Financeiro
   ================================================================ */

export const parametrosFornecedor = pgTable("parametros_fornecedor", {
  /** Linha única: sempre `atual`. */
  id: text().primaryKey(),
  fornecedor: text().notNull(),
  custoPote: integer().notNull(),
  freteEnvio: integer().notNull(),
  atualizadoEm: dataISO().notNull(),
});

export const pagamentosFornecedor = pgTable("pagamentos_fornecedor", {
  id: text().primaryKey(),
  pagoEm: dataISO().notNull(),
  valor: integer().notNull(),
  comprovanteAnexoId: text(),
  observacoes: text(),
  lancadoEm: dataISO().notNull(),
});

export const faturasFornecedor = pgTable("faturas_fornecedor", {
  id: text().primaryKey(),
  numero: text(),
  de: date({ mode: "string" }).notNull(),
  ate: date({ mode: "string" }).notNull(),
  valorCobrado: integer().notNull(),
  observacoes: text(),
  lancadaEm: dataISO().notNull(),
});

export const aliquotas = pgTable("aliquotas", {
  competencia: text().primaryKey(),
  aliquotaBps: integer().notNull(),
  lancadaEm: dataISO().notNull(),
});

export const despesasFixas = pgTable("despesas_fixas", {
  id: text().primaryKey(),
  descricao: text().notNull(),
  categoria: text()
    .$type<
      | "ferramentas"
      | "telefonia"
      | "internet"
      | "aluguel"
      | "energia"
      | "contabilidade"
      | "pro_labore"
      | "outros"
    >()
    .notNull(),
  valor: integer().notNull(),
  diaVencimento: integer().notNull(),
  desde: text().notNull(),
  ate: text(),
});

export const dividas = pgTable("dividas", {
  id: text().primaryKey(),
  credor: text().notNull(),
  descricao: text().notNull(),
  valorOriginal: integer().notNull(),
  jurosBps: integer().notNull(),
  parcelas: jsonb().$type<ParcelaDivida[]>().notNull(),
  contratadaEm: dataISO().notNull(),
});

/* ================================================================
   Marketing
   ================================================================ */

export const lancamentosMetaAds = pgTable(
  "lancamentos_meta_ads",
  {
    id: text().primaryKey(),
    data: date({ mode: "string" }).notNull(),
    criativoId: text().notNull(),
    campanha: text().notNull(),
    investimento: integer().notNull(),
    impressoes: integer().notNull(),
    cliques: integer().notNull(),
    conversas: integer().notNull(),
    fonte: text().$type<"manual" | "api">().notNull(),
  },
  (t) => [index().on(t.data)],
);

export const diasMetaAds = pgTable("dias_meta_ads", {
  id: text().primaryKey(),
  data: date({ mode: "string" }).notNull().unique(),
  investimento: integer().notNull(),
  leads: integer().notNull(),
  fonte: text().$type<"manual" | "api">().notNull().default("manual"),
  lancadoEm: dataISO().notNull(),
});
