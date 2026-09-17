import type { Colaborador, Pedido, Perfil } from "@/lib/types";

/**
 * Matriz de permissões.
 *
 * Fonte única: o servidor decide com estas funções em cada ação e rota, o proxy
 * e a navegação as usam para não oferecer o que seria recusado. A interface
 * esconder um botão nunca é a proteção — é só cortesia.
 *
 * | Recurso                               | Admin | Vendedor          | Cobrador               |
 * |---------------------------------------|-------|-------------------|------------------------|
 * | Pedidos: ver lista                    | todos | todos (filtra os próprios na tela) | idem  |
 * | Pedidos: criar                        | sim   | próprios          | não                    |
 * | Pedidos: editar, cancelar, excluir    | sim   | não (solicita)    | não                    |
 * | Dados completos do cliente (detalhe)  | sim   | sim, registrado   | sim, registrado        |
 * | Solicitar ajuste                      | sim   | próprios          | não                    |
 * | Aprovar/recusar ajuste                | sim   | não               | não                    |
 * | Anexos do pedido: enviar              | sim   | próprios          | atribuídos (comprovante) |
 * | Autorizar envio, rastreio             | sim   | não               | não                    |
 * | Apagar rastreio arquivado             | sim   | não               | não                    |
 * | Pagamento, inadimplência              | sim   | não               | atribuídos             |
 * | Cadastros, metas, níveis, conquistas  | sim   | só leitura        | só leitura             |
 * | Equipe e usuários                     | sim   | não               | não                    |
 * | Financeiro, marketing                 | sim   | não               | não                    |
 * | Comissões                             | todas | a própria         | a própria              |
 * | Atividades (auditoria)                | sim   | não               | não                    |
 */

type Quem = Pick<Colaborador, "id" | "perfil" | "vendedoresAtribuidos">;

export const ehAdmin = (u: Pick<Colaborador, "perfil">) => u.perfil === "admin";

export const podeCriarPedido = (u: Pick<Colaborador, "perfil">) =>
  u.perfil === "admin" || u.perfil === "vendedor";

export const podeEditarPedido = ehAdmin;
export const podeExcluirPedido = ehAdmin;
export const podeCancelarPedido = ehAdmin;
export const podeAprovarAjuste = ehAdmin;
export const podeAutorizarEnvio = ehAdmin;
export const podeOperarRastreio = ehAdmin;
/** Tira o objeto da aba Rastreio. O pedido não é tocado. */
export const podeApagarRastreio = ehAdmin;
export const podeConfigurar = ehAdmin;
export const podeGerirEquipe = ehAdmin;
export const podeVerFinanceiro = ehAdmin;
export const podeVerMarketing = ehAdmin;
export const podeVerAuditoria = ehAdmin;

export const podeOperarCobranca = (u: Pick<Colaborador, "perfil">) =>
  u.perfil === "admin" || u.perfil === "cobrador";

/** Vendedores cujos pedidos a pessoa opera; `null` = todos. */
export function escopoVendedores(u: Quem): string[] | null {
  if (u.perfil === "admin") return null;
  if (u.perfil === "vendedor") return [u.id];
  return u.vendedoresAtribuidos;
}

export function pedidoNoEscopo(u: Quem, pedido: Pick<Pedido, "vendedorId">): boolean {
  const escopo = escopoVendedores(u);
  return escopo === null || escopo.includes(pedido.vendedorId);
}

export function podeSolicitarAjuste(u: Quem, pedido: Pick<Pedido, "vendedorId">): boolean {
  return u.perfil === "admin" || (u.perfil === "vendedor" && pedido.vendedorId === u.id);
}

export function podeCobrarPedido(u: Quem, pedido: Pick<Pedido, "vendedorId">): boolean {
  return podeOperarCobranca(u) && pedidoNoEscopo(u, pedido);
}

export function podeAnexarNoPedido(u: Quem, pedido: Pick<Pedido, "vendedorId">): boolean {
  if (u.perfil === "admin") return true;
  if (u.perfil === "vendedor") return pedido.vendedorId === u.id;
  return pedidoNoEscopo(u, pedido);
}

/**
 * Dados completos do cliente. A equipe inteira tem acesso — há contrato de
 * confidencialidade —, mas cada abertura fica registrada nas atividades.
 */
export const podeVerDadosCliente = (u: Pick<Colaborador, "perfil">) =>
  u.perfil === "admin" || u.perfil === "vendedor" || u.perfil === "cobrador";

/** Anexos de pedido seguem a mesma regra de quem vê os dados do cliente. */
export const podeVerAnexo = podeVerDadosCliente;

/**
 * Quantos clientes um perfil não-admin revela numa chamada. O detalhe abre um
 * pedido por vez; a exportação da base é do Admin.
 */
export const LIMITE_REVELACAO = 50;

export const PERFIS: Perfil[] = ["admin", "vendedor", "cobrador"];

export const ROTULO_PERFIL: Record<Perfil, string> = {
  admin: "Admin",
  vendedor: "Vendedor",
  cobrador: "Cobrador",
};
