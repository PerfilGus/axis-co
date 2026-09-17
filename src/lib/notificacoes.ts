import type { Centavos, Colaborador, DataISO, ID, Perfil, StatusRastreio } from "@/lib/types";
import type { NomeIcone } from "@/components/icone";
import type { TomStatus } from "@/lib/status";
import { escopoVendedores } from "@/lib/permissoes";

/**
 * Notificações.
 *
 * Não existe tabela de notificações: elas são a tabela de atividades lida por
 * este catálogo. `tipoDaAtividade` reconhece o evento, `alcanca` decide quem
 * pode recebê-lo e a preferência de cada usuário decide se ele quer. Servidor
 * (lista, push) e tela (textos, filtros, preferências) usam as mesmas funções.
 */

export type CategoriaNotificacao =
  | "pedidos"
  | "frustrados"
  | "solicitacoes"
  | "rastreio"
  | "equipe"
  | "seguranca";

export const ROTULO_CATEGORIA: Record<CategoriaNotificacao, string> = {
  pedidos: "Pedidos",
  frustrados: "Frustrados",
  solicitacoes: "Solicitações",
  rastreio: "Rastreio",
  equipe: "Metas e ganhos",
  seguranca: "Segurança",
};

export type TipoNotificacao =
  | "pedido_agendado"
  | "envio_autorizado"
  | "pedido_pago"
  | "pedido_cancelado"
  | "pedido_frustrado"
  | "pedido_editado"
  | "pedido_excluido"
  | "anexo_adicionado"
  | "solicitacao_ajuste"
  | "solicitacao_alteracao"
  | "solicitacao_exclusao"
  | "solicitacao_aprovada"
  | "solicitacao_recusada"
  | "rastreio_final"
  | "rastreio_arquivado"
  | "rastreio_desarquivado"
  | "rastreio_apagado"
  | "conquista"
  | "bonus_liberado"
  | "recompensa_liberada"
  | "nivel_alterado"
  | "pagamento_colaborador"
  | "colaborador_criado"
  | "colaborador_desativado"
  | "conta_alterada"
  | "login_bloqueado"
  | "exportacao_dados";

/**
 * Quem pode receber, além do perfil:
 * - `pedido`: o admin vê todos; vendedor e cobrador, os pedidos do próprio escopo.
 * - `pessoa`: só a pessoa a quem o evento se refere.
 * - `pessoa_ou_admin`: a pessoa, e os admins.
 * - `admin`: só admins.
 */
type Alcance = "pedido" | "pessoa" | "pessoa_ou_admin" | "admin";

export interface DefinicaoNotificacao {
  tipo: TipoNotificacao;
  rotulo: string;
  descricao: string;
  categoria: CategoriaNotificacao;
  icone: NomeIcone;
  tom: TomStatus;
  perfis: Perfil[];
  alcance: Alcance;
  /** Padrão para quem nunca mexeu nas preferências. No app, tudo começa ligado. */
  pushPadrao: boolean;
}

const TODOS: Perfil[] = ["admin", "vendedor", "cobrador"];

export const CATALOGO_NOTIFICACOES: DefinicaoNotificacao[] = [
  { tipo: "pedido_agendado", rotulo: "Pedido agendado", descricao: "Um vendedor fechou e criou um pedido.", categoria: "pedidos", icone: "calendario", tom: "azul", perfis: ["admin"], alcance: "pedido", pushPadrao: false },
  { tipo: "envio_autorizado", rotulo: "Envio autorizado", descricao: "O pedido foi liberado para envio.", categoria: "pedidos", icone: "autorizar", tom: "roxo", perfis: TODOS, alcance: "pedido", pushPadrao: false },
  { tipo: "pedido_pago", rotulo: "Pedido pago", descricao: "O pagamento do cliente foi registrado.", categoria: "pedidos", icone: "dinheiro", tom: "verde", perfis: TODOS, alcance: "pedido", pushPadrao: true },
  { tipo: "pedido_editado", rotulo: "Pedido editado", descricao: "O Admin corrigiu dados ou valor do pedido.", categoria: "pedidos", icone: "editar", tom: "cinza", perfis: ["admin", "vendedor"], alcance: "pedido", pushPadrao: false },
  { tipo: "pedido_excluido", rotulo: "Pedido excluído", descricao: "O pedido foi apagado do sistema.", categoria: "pedidos", icone: "excluir", tom: "vermelho", perfis: ["admin", "vendedor"], alcance: "pedido", pushPadrao: false },
  { tipo: "anexo_adicionado", rotulo: "Anexo adicionado", descricao: "Print, áudio ou comprovante enviado no pedido.", categoria: "pedidos", icone: "anexo", tom: "cinza", perfis: ["admin", "vendedor"], alcance: "pedido", pushPadrao: false },
  { tipo: "pedido_cancelado", rotulo: "Frustrado: cancelado", descricao: "Cancelado antes do envio.", categoria: "frustrados", icone: "proibido", tom: "vermelho", perfis: ["admin", "vendedor"], alcance: "pedido", pushPadrao: true },
  { tipo: "pedido_frustrado", rotulo: "Frustrado: não pago", descricao: "Enviado e não pago: devolvido, recusado, suspenso, extraviado ou inadimplente.", categoria: "frustrados", icone: "alerta", tom: "vermelho", perfis: TODOS, alcance: "pedido", pushPadrao: true },
  { tipo: "solicitacao_ajuste", rotulo: "Ajuste de valor solicitado", descricao: "Desconto ou acréscimo esperando decisão.", categoria: "solicitacoes", icone: "percentual", tom: "bronze", perfis: ["admin"], alcance: "pedido", pushPadrao: true },
  { tipo: "solicitacao_alteracao", rotulo: "Alteração solicitada", descricao: "Mudança nos dados do pedido esperando decisão.", categoria: "solicitacoes", icone: "editar", tom: "bronze", perfis: ["admin"], alcance: "pedido", pushPadrao: true },
  { tipo: "solicitacao_exclusao", rotulo: "Exclusão solicitada", descricao: "Pedido que o vendedor quer apagar.", categoria: "solicitacoes", icone: "excluir", tom: "bronze", perfis: ["admin"], alcance: "pedido", pushPadrao: true },
  { tipo: "solicitacao_aprovada", rotulo: "Solicitação aprovada", descricao: "O Admin aprovou um ajuste, alteração ou exclusão.", categoria: "solicitacoes", icone: "checkCircle", tom: "verde", perfis: ["admin", "vendedor"], alcance: "pedido", pushPadrao: true },
  { tipo: "solicitacao_recusada", rotulo: "Solicitação recusada", descricao: "O Admin recusou um ajuste, alteração ou exclusão.", categoria: "solicitacoes", icone: "fechar", tom: "vermelho", perfis: ["admin", "vendedor"], alcance: "pedido", pushPadrao: true },
  { tipo: "rastreio_final", rotulo: "Rastreio na fase final", descricao: "Entregue, aguardando retirada ou com falha. Movimento em trânsito não avisa.", categoria: "rastreio", icone: "rastreio", tom: "turquesa", perfis: TODOS, alcance: "pedido", pushPadrao: false },
  { tipo: "rastreio_arquivado", rotulo: "Rastreio arquivado", descricao: "Saiu de Em trânsito para Arquivados.", categoria: "rastreio", icone: "arquivar", tom: "ardosia", perfis: ["admin"], alcance: "pedido", pushPadrao: false },
  { tipo: "rastreio_desarquivado", rotulo: "Rastreio desarquivado", descricao: "Voltou para Em trânsito.", categoria: "rastreio", icone: "desarquivar", tom: "ardosia", perfis: ["admin"], alcance: "pedido", pushPadrao: false },
  { tipo: "rastreio_apagado", rotulo: "Rastreio apagado", descricao: "Tirado da aba Rastreio; o pedido segue intacto.", categoria: "rastreio", icone: "excluir", tom: "ardosia", perfis: ["admin"], alcance: "pedido", pushPadrao: false },
  { tipo: "conquista", rotulo: "Conquista", descricao: "Você desbloqueou uma conquista.", categoria: "equipe", icone: "medalha", tom: "bronze", perfis: ["vendedor", "cobrador"], alcance: "pessoa", pushPadrao: true },
  { tipo: "bonus_liberado", rotulo: "Bônus de nível liberado", descricao: "Você subiu de nível e liberou um bônus.", categoria: "equipe", icone: "ranking", tom: "verde", perfis: ["vendedor", "cobrador"], alcance: "pessoa", pushPadrao: true },
  { tipo: "recompensa_liberada", rotulo: "Recompensa liberada", descricao: "Você bateu a condição de uma recompensa em dinheiro.", categoria: "equipe", icone: "dinheiro", tom: "verde", perfis: ["vendedor", "cobrador"], alcance: "pessoa", pushPadrao: true },
  { tipo: "nivel_alterado", rotulo: "Mudança de nível", descricao: "Você subiu de nível — ou caiu para o anterior.", categoria: "equipe", icone: "medalha", tom: "bronze", perfis: ["vendedor", "cobrador"], alcance: "pessoa", pushPadrao: true },
  { tipo: "pagamento_colaborador", rotulo: "Pagamento recebido", descricao: "Fechamento ou bônus marcado como pago.", categoria: "equipe", icone: "pix", tom: "verde", perfis: ["vendedor", "cobrador"], alcance: "pessoa", pushPadrao: true },
  { tipo: "colaborador_criado", rotulo: "Colaborador criado", descricao: "Novo acesso na equipe.", categoria: "equipe", icone: "colaboradores", tom: "azul", perfis: ["admin"], alcance: "admin", pushPadrao: false },
  { tipo: "colaborador_desativado", rotulo: "Colaborador desativado", descricao: "Acesso de alguém da equipe foi desligado.", categoria: "seguranca", icone: "proibido", tom: "vermelho", perfis: ["admin"], alcance: "admin", pushPadrao: false },
  { tipo: "conta_alterada", rotulo: "Acesso redefinido", descricao: "Senha, verificação em duas etapas ou sessões redefinidas pelo Admin.", categoria: "seguranca", icone: "cadeado", tom: "laranja", perfis: TODOS, alcance: "pessoa_ou_admin", pushPadrao: true },
  { tipo: "login_bloqueado", rotulo: "Login bloqueado", descricao: "Cinco senhas erradas seguidas bloquearam a conta por 15 minutos.", categoria: "seguranca", icone: "escudo", tom: "laranja", perfis: TODOS, alcance: "pessoa_ou_admin", pushPadrao: true },
  { tipo: "exportacao_dados", rotulo: "Exportação de dados de clientes", descricao: "Alguém baixou CPF e telefone completos.", categoria: "seguranca", icone: "exportar", tom: "laranja", perfis: ["admin"], alcance: "admin", pushPadrao: false },
];

export const DEFINICAO_NOTIFICACAO = Object.fromEntries(
  CATALOGO_NOTIFICACOES.map((d) => [d.tipo, d]),
) as Record<TipoNotificacao, DefinicaoNotificacao>;

export const ehTipoNotificacao = (valor: string): valor is TipoNotificacao => valor in DEFINICAO_NOTIFICACAO;

/** Tipos que o perfil pode escolher receber. */
export const tiposDoPerfil = (perfil: Perfil) => CATALOGO_NOTIFICACOES.filter((d) => d.perfis.includes(perfil));

/** Na tela de atividades, só estes verbos e entidades podem virar notificação. */
export const ACOES_NOTIFICAVEIS = [
  "criacao",
  "aprovacao",
  "recusa",
  "solicitacao_alteracao",
  "pagamento",
  "frustracao",
  "mudanca_status",
  "edicao",
  "anexo",
  "arquivamento",
  "exclusao",
  "rastreio",
  "conquista",
  "bonus_liberado",
  "recompensa_liberada",
  "nivel",
  "desativacao",
  "redefinicao_senha",
  "redefinicao_2fa",
  "encerramento_sessoes",
  "login_bloqueado",
  "exportacao_dados",
];
export const ENTIDADES_NOTIFICAVEIS = ["pedido", "rastreio", "colaborador", "sessao", "cliente"];

/** Fases do rastreio depois do trânsito: é aqui que o cobrador precisa agir. */
export const RASTREIO_FINAL: StatusRastreio[] = ["entregue", "aguardando_retirada", "falha"];

export interface AtividadeNotificavel {
  acao: string;
  entidade: string;
  titulo: string | null;
  dados: Record<string, unknown> | null;
  depois: unknown;
}

/**
 * Reconhece o evento. Os verbos saem de `acaoDoEvento`
 * (`repositorio/pedidos.ts`) e das ações; solicitação e decisão ainda se
 * distinguem pelo título que o domínio grava.
 */
export function tipoDaAtividade(a: AtividadeNotificavel): TipoNotificacao | null {
  const dados = a.dados ?? {};
  const titulo = a.titulo ?? "";
  if (a.entidade === "pedido") {
    switch (a.acao) {
      case "criacao":
        return "pedido_agendado";
      case "aprovacao":
        return dados.tipo === "ajuste" ? "solicitacao_aprovada" : "envio_autorizado";
      case "recusa":
        return "solicitacao_recusada";
      case "solicitacao_alteracao":
        if (titulo.startsWith("Exclusão")) return "solicitacao_exclusao";
        if (titulo.startsWith("Alteração")) return "solicitacao_alteracao";
        return "solicitacao_ajuste";
      case "pagamento":
        return "pedido_pago";
      case "frustracao":
        return "pedido_frustrado";
      case "mudanca_status":
        if (dados.status === "cancelado") return "pedido_cancelado";
        if (dados.status === "reembolsado" || dados.status === "inadimplente") return "pedido_frustrado";
        return null;
      case "edicao":
        return "pedido_editado";
      case "anexo":
        return "anexo_adicionado";
      case "arquivamento": {
        const depois = (a.depois ?? {}) as { arquivado?: boolean };
        return depois.arquivado ? "rastreio_arquivado" : "rastreio_desarquivado";
      }
      case "exclusao":
        return "pedido_excluido";
      case "rastreio":
        // Contrato para a integração com os Correios: `dados.rastreioStatus`.
        return RASTREIO_FINAL.includes(dados.rastreioStatus as StatusRastreio) ? "rastreio_final" : null;
    }
    return null;
  }
  if (a.entidade === "rastreio" && a.acao === "exclusao") return "rastreio_apagado";
  if (a.entidade === "colaborador") {
    switch (a.acao) {
      case "conquista":
        return "conquista";
      case "bonus_liberado":
        return "bonus_liberado";
      case "recompensa_liberada":
        return "recompensa_liberada";
      case "nivel":
        return "nivel_alterado";
      case "pagamento":
        return "pagamento_colaborador";
      case "criacao":
        return "colaborador_criado";
      case "desativacao":
        return "colaborador_desativado";
      case "redefinicao_senha":
      case "redefinicao_2fa":
      case "encerramento_sessoes":
        return "conta_alterada";
    }
    return null;
  }
  if (a.entidade === "sessao" && a.acao === "login_bloqueado") return "login_bloqueado";
  if (a.entidade === "cliente" && a.acao === "exportacao_dados") return "exportacao_dados";
  return null;
}

/** O que a tela e o push precisam de uma notificação. */
export interface Notificacao {
  /** O id da atividade. */
  id: ID;
  tipo: TipoNotificacao;
  ocorridoEm: DataISO;
  registradoEm: DataISO;
  autorId: ID | null;
  papel: Perfil | null;
  pedidoId: ID | null;
  /** Código do pedido (`AX-1001`), mesmo depois de excluído. */
  codigo: string | null;
  vendedorId: ID | null;
  cliente: string | null;
  /** A pessoa a quem o evento se refere, nos tipos de equipe e segurança. */
  alvoId: ID | null;
  titulo: string | null;
  descricao: string | null;
  valor: Centavos | null;
  lida: boolean;
}

export interface PreferenciaNotificacao {
  tipo: TipoNotificacao;
  noApp: boolean;
  push: boolean;
}

export interface EstadoNotificacoes {
  itens: Notificacao[];
  preferencias: PreferenciaNotificacao[];
}

/** A escolha salva, ou o padrão do catálogo. */
export function preferenciaDe(
  preferencias: PreferenciaNotificacao[],
  tipo: TipoNotificacao,
): PreferenciaNotificacao {
  return (
    preferencias.find((p) => p.tipo === tipo) ?? {
      tipo,
      noApp: true,
      push: DEFINICAO_NOTIFICACAO[tipo].pushPadrao,
    }
  );
}

type Destinatario = Pick<Colaborador, "id" | "perfil" | "vendedoresAtribuidos">;

/**
 * Pode receber? Ninguém é avisado do que ele mesmo fez — menos do bloqueio de
 * login, que é "autoria" de quem errou a senha, possivelmente outra pessoa.
 */
export function alcanca(
  u: Destinatario,
  n: Pick<Notificacao, "tipo" | "autorId" | "vendedorId" | "alvoId">,
): boolean {
  if (n.autorId === u.id && n.tipo !== "login_bloqueado") return false;
  const def = DEFINICAO_NOTIFICACAO[n.tipo];
  if (!def.perfis.includes(u.perfil)) return false;
  switch (def.alcance) {
    case "admin":
      return u.perfil === "admin";
    case "pessoa":
      return n.alvoId === u.id;
    case "pessoa_ou_admin":
      return u.perfil === "admin" || n.alvoId === u.id;
    case "pedido": {
      const escopo = escopoVendedores(u);
      return escopo === null || (n.vendedorId !== null && escopo.includes(n.vendedorId));
    }
  }
}

export const ROTULO_PAPEL: Record<Perfil, string> = {
  admin: "Admin",
  vendedor: "Vendedor",
  cobrador: "Financeiro",
};

const pedidoDe = (n: Notificacao) => (n.codigo ? `Pedido ${n.codigo}` : "Pedido");

/** Título curto, igual no sino e no push. */
export function tituloDaNotificacao(n: Notificacao): string {
  const codigo = n.codigo ?? "";
  switch (n.tipo) {
    case "pedido_agendado":
      return `${pedidoDe(n)} agendado`;
    case "envio_autorizado":
      return `Envio de ${codigo} autorizado`;
    case "pedido_pago":
      return `${pedidoDe(n)} pago`;
    case "pedido_cancelado":
      return `${pedidoDe(n)} cancelado`;
    case "pedido_frustrado":
      return `${pedidoDe(n)} frustrado`;
    case "pedido_editado":
      return `${pedidoDe(n)} editado`;
    case "pedido_excluido":
      return `${pedidoDe(n)} excluído`;
    case "anexo_adicionado":
      return `Anexo em ${codigo}`;
    case "solicitacao_ajuste":
      return `Ajuste de valor pedido em ${codigo}`;
    case "solicitacao_alteracao":
      return `Alteração pedida em ${codigo}`;
    case "solicitacao_exclusao":
      return `Exclusão pedida para ${codigo}`;
    case "solicitacao_aprovada":
      return `Solicitação aprovada em ${codigo}`;
    case "solicitacao_recusada":
      return `Solicitação recusada em ${codigo}`;
    case "rastreio_final":
      return `${pedidoDe(n)}: ${n.titulo ?? "rastreio atualizado"}`;
    case "rastreio_arquivado":
      return `Rastreio de ${codigo} arquivado`;
    case "rastreio_desarquivado":
      return `Rastreio de ${codigo} desarquivado`;
    case "rastreio_apagado":
      return `Rastreio de ${codigo} apagado`;
    default:
      return n.titulo ?? DEFINICAO_NOTIFICACAO[n.tipo].rotulo;
  }
}

/** Para onde o toque leva. `null` quando não há o que abrir (pedido excluído). */
export function hrefDaNotificacao(n: Notificacao, perfil: Perfil): string | null {
  const def = DEFINICAO_NOTIFICACAO[n.tipo];
  if (n.tipo === "pedido_excluido") return null;
  if (def.categoria === "rastreio" && perfil === "admin" && n.tipo !== "rastreio_apagado" && n.pedidoId) {
    return `/operacao/rastreio?pedido=${encodeURIComponent(n.pedidoId)}`;
  }
  if (n.pedidoId) {
    const base = perfil === "cobrador" ? "/operacao/cobranca" : "/operacao/pedidos";
    return `${base}?pedido=${encodeURIComponent(n.pedidoId)}`;
  }
  switch (n.tipo) {
    case "conquista":
    case "bonus_liberado":
    case "recompensa_liberada":
    case "nivel_alterado":
      return "/minha-area";
    case "pagamento_colaborador":
      return "/minha-area/perfil";
    case "colaborador_criado":
    case "colaborador_desativado":
    case "conta_alterada":
    case "login_bloqueado":
      return perfil === "admin" ? "/equipe/colaboradores" : "/configuracoes/seguranca";
    default:
      return null;
  }
}

/** Texto do push: curto e sem dado de cliente, porque aparece com a tela bloqueada. */
export function textoDoPush(n: Notificacao, autor: string | null): string {
  return autor ? `${tituloDaNotificacao(n)} — por ${autor}` : tituloDaNotificacao(n);
}
