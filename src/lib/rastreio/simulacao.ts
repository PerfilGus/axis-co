import type { EventoRastreio, Pedido, Rastreio, StatusRastreio } from "@/lib/types";

/**
 * Atualização de rastreio — simulada.
 *
 * No axis-tracking o botão "Atualizar rastreios" chama `POST /api/refresh`, que
 * consulta os Correios em lote e grava só o que mudou. Aqui não há Correios: a
 * função avança a trilha do objeto um passo, respeitando a mesma ordem de
 * eventos e devolvendo a mesma contagem. Quando a integração entrar, só o corpo
 * daqui muda.
 *
 * A trilha e o mapa evento→status vivem em `correios.ts`, portados de
 * `referencia/axis-tracking/lib/correios.js`.
 */

interface PassoSimulado {
  status: StatusRastreio;
  titulo: string;
  detalhe: string | null;
}

/** O que vem depois de cada status, no caminho feliz. */
const PROXIMO_PASSO: Partial<Record<StatusRastreio, PassoSimulado>> = {
  aguardando_postagem: {
    status: "postado",
    titulo: "Objeto postado",
    detalhe: null,
  },
  postado: {
    status: "em_transferencia",
    titulo: "Objeto em trânsito - por favor aguarde",
    detalhe: null,
  },
  em_transferencia: {
    status: "saiu_para_entrega",
    titulo: "Objeto saiu para entrega ao destinatário",
    detalhe: null,
  },
  saiu_para_entrega: {
    status: "entregue",
    titulo: "Objeto entregue ao destinatário",
    detalhe: null,
  },
  // `entregue`, `falha` e `aguardando_retirada` são finais para a simulação:
  // o que acontece depois deles é decisão da operação, não dos Correios.
};

let sequencia = 0;

function novoEvento(
  pedido: Pedido,
  passo: PassoSimulado,
  quando: string,
): EventoRastreio {
  const endereco = pedido.cliente.endereco;
  sequencia += 1;
  return {
    id: `rstsim_${sequencia}`,
    status: passo.status,
    titulo: passo.titulo,
    detalhe: passo.detalhe,
    unidade:
      passo.status === "postado"
        ? "Agência dos Correios, São Paulo/SP"
        : passo.status === "em_transferencia"
          ? "Centro de Tratamento de Cartas, São Paulo/SP"
          : `Unidade de Distribuição, ${endereco.cidade}/${endereco.uf}`,
    cidade: passo.status === "postado" ? "São Paulo" : endereco.cidade,
    uf: passo.status === "postado" ? "SP" : endereco.uf,
    ocorridoEm: quando,
  };
}

export interface ResultadoSimulacao {
  /** Rastreio já atualizado, ou `null` se nada mudou para este pedido. */
  rastreio: Rastreio | null;
}

/**
 * Avança um pedido um passo na trilha, se houver passo a dar.
 *
 * Pedido arquivado não é consultado — no original o refresh também só olha os
 * não arquivados.
 */
export function avancarRastreio(pedido: Pedido): ResultadoSimulacao {
  const atual = pedido.rastreio;
  if (!atual || atual.arquivado) return { rastreio: null };

  const passo = PROXIMO_PASSO[atual.status];
  if (!passo) return { rastreio: null };

  const quando = new Date().toISOString();
  const evento = novoEvento(pedido, passo, quando);

  return {
    rastreio: {
      ...atual,
      status: passo.status,
      postadoEm: passo.status === "postado" ? quando : atual.postadoEm,
      entregueEm: passo.status === "entregue" ? quando : atual.entregueEm,
      tentativasEntrega:
        passo.status === "entregue" ? 1 : atual.tentativasEntrega,
      // Evento novo = atualização não vista, como no original.
      destacado: true,
      // A timeline é mantida mais-recente-primeiro.
      eventos: [evento, ...atual.eventos],
      atualizadoEm: quando,
    },
  };
}

/**
 * Quantos pedidos a próxima atualização mexeria. Usado só para o botão poder
 * dizer "Nenhuma novidade" sem repintar a lista.
 */
export function quantosAvancariam(pedidos: Pedido[]): number {
  return pedidos.filter((p) => avancarRastreio(p).rastreio !== null).length;
}
