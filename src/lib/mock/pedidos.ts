import type {
  AjusteValor,
  Anexo,
  Cliente,
  Cobranca,
  CustosPedido,
  EventoPedido,
  EventoRastreio,
  FormaPagamento,
  ItemPedido,
  Pedido,
  Rastreio,
  StatusPedido,
  StatusRastreio,
} from "@/lib/types";
import { STATUS_PEDIDO, STATUS_RASTREIO } from "@/lib/status";
import { formatBRL } from "@/lib/format";
import { ROTULO_FORMA, taxaEstimada } from "@/lib/taxas";
import {
  escolher,
  HOJE,
  id,
  inteiro,
  iso,
  maisDias,
  maisHoras,
  rng,
  talvez,
  type Rng,
} from "./base";
import { custoPotesDoKit, KITS } from "./catalogo";
import { VENDEDORES } from "./equipe";
import {
  CRIATIVOS,
  CRIATIVOS_ATIVOS,
  DIAS_HISTORICO,
  LANCAMENTOS_META_ADS,
  LINHA_POR_ID,
  QUALIDADE_CRIATIVO,
  criativoNoAr,
  vendasEsperadas,
} from "./marketing";
import { BANCO_POR_ID } from "./financeiro";
import {
  BAIRROS,
  CIDADES,
  LOGRADOUROS,
  NOMES,
  OBSERVACOES_CLIENTE,
  REFERENCIAS,
  SOBRENOMES,
} from "./pessoas";

/**
 * Distribuição dos 102 pedidos da operação corrente. Cobre todos os status do
 * ciclo, inclusive as três saídas (cancelado, reembolsado, inadimplente). O
 * volume em andamento acompanha o do histórico, para os dias recentes não
 * parecerem uma queda de vendas no Meta Ads e no relatório.
 */
const DISTRIBUICAO: Array<[StatusPedido, number]> = [
  ["agendado", 16],
  ["aguardando_autorizacao", 14],
  ["autorizado", 10],
  ["em_transito", 20],
  ["entregue", 14],
  ["pago", 14],
  ["cancelado", 4],
  ["reembolsado", 2],
  ["inadimplente", 4],
];

/** Há quantos dias o pedido nasceu, por status. */
const IDADE_POR_STATUS: Record<StatusPedido, [number, number]> = {
  agendado: [0, 3],
  aguardando_autorizacao: [1, 4],
  autorizado: [2, 6],
  em_transito: [5, 14],
  entregue: [9, 20],
  pago: [12, 48],
  cancelado: [2, 30],
  reembolsado: [16, 40],
  inadimplente: [22, 50],
};

const COBRADOR_ID = "col_0005";

/** Onde cada pedido em trânsito está na trilha dos Correios. */
const ETAPAS_EM_TRANSITO: StatusRastreio[] = [
  "em_transferencia",
  "saiu_para_entrega",
  "postado",
  "aguardando_retirada",
  "em_transferencia",
  "saiu_para_entrega",
];

const MOTIVOS_CANCELAMENTO = [
  "Cliente desistiu antes do envio.",
  "Endereço não confere e o cliente sumiu.",
  "Cliente encontrou o produto mais barato.",
  "Número de telefone errado no cadastro.",
];

const MOTIVOS_REEMBOLSO = [
  "Cliente recusou o pacote na entrega.",
  "Objeto devolvido por ausência após três tentativas.",
];

const MOTIVOS_ACRESCIMO = [
  "Cliente subiu para o kit maior no fechamento.",
  "Frete para região de difícil acesso.",
];

const MOTIVOS_ALTERACAO = [
  "Cliente passou o número do endereço errado.",
  "Trocar o complemento: é o bloco B, não o A.",
  "Corrigir o telefone de contato.",
  "Cliente pediu para mudar o kit antes do envio.",
];

const MOTIVOS_EXCLUSAO = [
  "Pedido duplicado, foi lançado duas vezes.",
  "Cliente desistiu logo depois de fechar.",
];

const MOTIVOS_AJUSTE = [
  "Cliente só fecha se sair por este valor.",
  "Recompra, cliente pediu o mesmo preço da primeira vez.",
  "Erro de digitação no fechamento.",
  "Cliente é indicação de outro comprador.",
];

function gerarCliente(r: Rng, n: number): Cliente {
  const cidade = escolher(r, CIDADES);
  const nome = `${escolher(r, NOMES)} ${escolher(r, SOBRENOMES)}`;
  const cepSufixo = String(inteiro(r, 0, 9999999)).padStart(7, "0");
  return {
    id: id("cli", n),
    nome,
    telefone: `${inteiro(r, 11, 89)}9${inteiro(r, 10000000, 99999999)}`,
    cpf: talvez(r, 0.75)
      ? String(inteiro(r, 10000000000, 99999999999))
      : null,
    endereco: {
      cep: (cidade.cepBase + cepSufixo).slice(0, 8),
      logradouro: escolher(r, LOGRADOUROS),
      numero: String(inteiro(r, 10, 2480)),
      complemento: talvez(r, 0.3) ? `Apto ${inteiro(r, 11, 154)}` : null,
      bairro: escolher(r, BAIRROS),
      cidade: cidade.cidade,
      uf: cidade.uf,
      referencia: escolher(r, REFERENCIAS),
    },
    observacoes: escolher(r, OBSERVACOES_CLIENTE),
    criadoEm: iso(maisDias(HOJE, -inteiro(r, 1, 300))),
  };
}

function gerarItens(r: Rng): ItemPedido[] {
  // Kit Tratamento domina o mix, como no funil real.
  const peso = r();
  const kit = peso < 0.2 ? KITS[0] : peso < 0.78 ? KITS[1] : KITS[2];
  const desconto = talvez(r, 0.35)
    ? inteiro(r, 0, Math.floor((kit.precoTabela - kit.precoMinimo) / 100)) * 100
    : 0;
  return [
    {
      kitId: kit.id,
      kitNome: kit.nome,
      quantidade: 1,
      precoUnitario: kit.precoTabela - desconto,
    },
  ];
}

function codigoRastreio(r: Rng): string {
  const letras = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const l = () => letras[Math.floor(r() * letras.length)];
  return `${l()}${l()}${String(inteiro(r, 100000000, 999999999))}BR`;
}

interface PassoRastreio {
  status: StatusRastreio;
  titulo: string;
  detalhe: string | null;
  diasApos: number;
}

/**
 * Motivos de insucesso como os Correios mandam: o título traz
 * "Objeto não entregue - {motivo}", e é de lá que sai o `motivoFalha`
 * (mesma regra do `failureReasonOf` em `lib/correios.js`).
 */
const MOTIVOS_FALHA = [
  "Endereço insuficiente",
  "Destinatário ausente",
  "Cliente desconhecido no local",
  "Endereço incorreto",
] as const;

const AGENCIAS = [
  "Agência Centro",
  "Agência Jardim América",
  "Agência Bela Vista",
  "Agência Central",
] as const;

function trilhaRastreio(
  r: Rng,
  destino: { cidade: string; uf: string },
  ate: StatusRastreio,
  entregou: boolean,
  motivoFalha: string,
): PassoRastreio[] {
  const passos: PassoRastreio[] = [
    {
      status: "aguardando_postagem",
      titulo: "Etiqueta emitida",
      detalhe: "Objeto ainda não postado nos Correios.",
      diasApos: 0,
    },
    {
      status: "postado",
      titulo: "Objeto postado",
      detalhe: null,
      diasApos: 0.5,
    },
    {
      status: "em_transferencia",
      titulo: "Objeto em trânsito - por favor aguarde",
      detalhe: `de São Paulo/SP para ${destino.cidade}/${destino.uf}`,
      diasApos: 1.2,
    },
    {
      status: "em_transferencia",
      titulo: "Objeto encaminhado",
      detalhe: `para Unidade de Distribuição de ${destino.cidade}/${destino.uf}`,
      diasApos: 2 + r() * 2,
    },
    {
      status: "saiu_para_entrega",
      titulo: "Objeto saiu para entrega ao destinatário",
      detalhe: null,
      diasApos: 4 + r() * 3,
    },
  ];

  if (ate === "aguardando_retirada") {
    passos.push({
      status: "aguardando_retirada",
      titulo: "Objeto aguardando retirada no endereço indicado",
      detalhe: "Retirar em até 7 dias corridos.",
      diasApos: 5 + r() * 2,
    });
    return passos;
  }
  if (ate === "falha") {
    passos.push({
      status: "falha",
      titulo: `Objeto não entregue - ${motivoFalha.toLowerCase()}`,
      detalhe: "Objeto será devolvido ao remetente.",
      diasApos: 5 + r() * 2,
    });
    return passos;
  }
  if (entregou) {
    passos.push({
      status: "entregue",
      titulo: "Objeto entregue ao destinatário",
      detalhe: null,
      diasApos: 5 + r() * 3,
    });
  }

  const corte = passos.findIndex((p) => p.status === ate);
  return corte >= 0 && !entregou ? passos.slice(0, corte + 1) : passos;
}

function gerarRastreio(
  r: Rng,
  n: number,
  autorizadoEm: Date,
  destino: { cidade: string; uf: string },
  ate: StatusRastreio,
  entregou: boolean,
): Rastreio {
  const motivoFalha = escolher(r, MOTIVOS_FALHA);
  const passos = trilhaRastreio(r, destino, ate, entregou, motivoFalha).filter(
    (p) => maisDias(autorizadoEm, p.diasApos) <= HOJE,
  );

  // A timeline é mantida mais-recente-primeiro; a ordem faz parte do contrato.
  const eventos: EventoRastreio[] = passos
    .map((p, i) => ({
      id: id(`rst${n}`, i + 1),
      status: p.status,
      titulo: p.titulo,
      detalhe: p.detalhe,
      unidade:
        p.status === "aguardando_postagem" || p.status === "postado"
          ? "Agência dos Correios, São Paulo/SP"
          : p.status === "saiu_para_entrega" ||
              p.status === "entregue" ||
              p.status === "falha" ||
              p.status === "aguardando_retirada"
            ? `Unidade de Distribuição, ${destino.cidade}/${destino.uf}`
            : "Centro de Tratamento de Cartas, São Paulo/SP",
      cidade:
        p.status === "aguardando_postagem" || p.status === "postado"
          ? "São Paulo"
          : destino.cidade,
      uf:
        p.status === "aguardando_postagem" || p.status === "postado"
          ? "SP"
          : destino.uf,
      ocorridoEm: iso(maisDias(autorizadoEm, p.diasApos)),
    }))
    .reverse();

  const maisRecente = eventos[0];
  const entrega = eventos.find((e) => e.status === "entregue");
  const postagem = eventos.find((e) => e.status === "postado");
  const status = maisRecente?.status ?? "aguardando_postagem";
  const retirada = eventos.find((e) => e.status === "aguardando_retirada");

  return {
    codigo: codigoRastreio(r),
    status,
    servico: talvez(r, 0.8) ? "PAC Contrato" : "SEDEX Contrato",
    postadoEm: postagem?.ocorridoEm ?? null,
    previsaoEntrega: iso(maisDias(autorizadoEm, 7)),
    entregueEm: entrega?.ocorridoEm ?? null,
    tentativasEntrega: status === "falha" ? inteiro(r, 1, 3) : entrega ? 1 : 0,
    motivoFalha: status === "falha" ? motivoFalha : null,
    retirada:
      status === "aguardando_retirada" && retirada
        ? {
            agencia: `${escolher(r, AGENCIAS)} - ${destino.cidade}`,
            endereco: `${escolher(r, LOGRADOUROS)}, ${inteiro(r, 10, 980)} - Centro - ${destino.cidade}/${destino.uf}`,
            disponivelDesde: retirada.ocorridoEm,
            prazo: iso(maisDias(new Date(retirada.ocorridoEm), 7)),
          }
        : null,
    // Destaque = atualização ainda não vista. Parte da carteira entra destacada
    // para a seção "Atualizações Recentes" ter conteúdo já na primeira abertura.
    destacado: talvez(r, 0.3),
    arquivado: false,
    arquivadoEm: null,
    eventos,
    atualizadoEm: maisRecente?.ocorridoEm ?? iso(autorizadoEm),
    fonte: "manual",
  };
}

function custosDoStatus(
  status: StatusPedido,
  frete: number,
  kitId: string,
): CustosPedido {
  if (status === "reembolsado") {
    // Frete de ida e de volta. O pote retorna ao estoque.
    const total = frete * 2;
    return { frete: total, pote: 0, total };
  }
  if (status === "inadimplente") {
    const pote = custoPotesDoKit(kitId);
    return { frete, pote, total: frete + pote };
  }
  // Cancelado não gera custo: nada saiu. Demais status ainda não geraram perda.
  return { frete: 0, pote: 0, total: 0 };
}

/** O que o histórico fixa em vez de sortear. */
interface OpcoesPedido {
  idade: number;
  criativoId: string | null;
  vendedores: typeof VENDEDORES;
}

function gerarPedido(r: Rng, n: number, status: StatusPedido, opcoes?: OpcoesPedido): Pedido {
  const [minIdade, maxIdade] = IDADE_POR_STATUS[status];
  const idade = opcoes?.idade ?? inteiro(r, minIdade, maxIdade);
  const criadoEm = maisHoras(maisDias(HOJE, -idade), -inteiro(r, 0, 9));

  const cliente = gerarCliente(r, n);
  const itens = gerarItens(r);
  const kit = KITS.find((k) => k.id === itens[0].kitId)!;
  const frete = kit.freteEstimado;
  const valorTotal = itens[0].precoUnitario;

  const vendedor = escolher(r, opcoes?.vendedores ?? VENDEDORES);
  const criativoId = opcoes ? opcoes.criativoId : escolher(r, CRIATIVOS_ATIVOS).id;
  const linha =
    [...LINHA_POR_ID.values()].find((l) => l.vendedoresIds.includes(vendedor.id)) ??
    null;

  const passouPorAutorizacao = ![
    "agendado",
    "aguardando_autorizacao",
    "cancelado",
  ].includes(status);
  const autorizadoEm = passouPorAutorizacao
    ? maisHoras(criadoEm, inteiro(r, 4, 26))
    : null;

  let rastreio: Rastreio | null = null;
  if (autorizadoEm) {
    const ate: StatusRastreio =
      status === "autorizado"
        ? "aguardando_postagem"
        : status === "em_transito"
          ? // Rodízio em vez de sorteio: garante que os sete status de rastreio
            // apareçam na tela, inclusive a retirada em agência — objeto parado
            // esperando o cliente ainda é um pedido em trânsito.
            ETAPAS_EM_TRANSITO[n % ETAPAS_EM_TRANSITO.length]
          : status === "reembolsado"
            ? "falha"
            : "entregue";
    const entregou = ["entregue", "pago", "inadimplente"].includes(status);
    rastreio = gerarRastreio(r, n, autorizadoEm, cliente.endereco, ate, entregou);
  }

  const entregueEm = rastreio?.entregueEm ? new Date(rastreio.entregueEm) : null;
  const pago = status === "pago";
  const pagoEm = pago && entregueEm ? maisHoras(entregueEm, inteiro(r, 2, 72)) : null;

  const forma: FormaPagamento = pago
    ? escolher(r, ["pix", "boleto", "link_cartao"] as const)
    : "nao_definido";
  const bancoRecebimento = pago
    ? forma === "link_cartao"
      ? "plt_0001"
      : escolher(r, ["bnc_0001", "bnc_0002", "bnc_0003"])
    : null;

  const cobranca: Cobranca = {
    responsavelId: passouPorAutorizacao ? COBRADOR_ID : null,
    tentativas: pago
      ? inteiro(r, 1, 2)
      : status === "entregue"
        ? inteiro(r, 0, 2)
        : status === "inadimplente"
          ? inteiro(r, 4, 7)
          : 0,
    ultimaTentativaEm:
      status === "entregue" || status === "inadimplente" || pago
        ? iso(maisHoras(entregueEm ?? criadoEm, inteiro(r, 3, 48)))
        : null,
    proximoContatoEm:
      status === "entregue"
        ? iso(maisDias(HOJE, inteiro(r, 0, 2)))
        : status === "inadimplente"
          ? iso(maisDias(HOJE, inteiro(r, 1, 5)))
          : null,
    formaPagamento: forma,
    pagoEm: pagoEm ? iso(pagoEm) : null,
    valorRecebido: pago ? valorTotal + frete : null,
    // Preenchida em `aplicarTaxas`, que conta a franquia de boletos em ordem.
    taxaAplicada: null,
    bancoId: pago ? bancoRecebimento : null,
    comprovanteAnexoId: pago ? id(`anx${n}`, 1) : null,
    observacoes:
      status === "inadimplente"
        ? "Não atende há mais de uma semana. Encaminhado para negativação."
        : null,
  };

  // Provas que o vendedor anexa no fechamento. As lacunas são de propósito:
  // é delas que a fila de autorização tira as pendências reais.
  const confirmacaoPorTexto = talvez(r, 0.22);
  const temPrint = talvez(r, 0.88);
  const temAudio = confirmacaoPorTexto ? false : talvez(r, 0.84);
  const enderecoValidado = talvez(r, 0.85);

  const anexos: Anexo[] = [];
  if (temPrint) {
    anexos.push({
      id: id(`anx${n}`, 3),
      nome: "print-confirmacao.png",
      tipo: "print_confirmacao",
      tamanhoBytes: inteiro(r, 120_000, 780_000),
      mime: "image/png",
      criadoEm: iso(maisHoras(criadoEm, 1)),
      criadoPor: vendedor.id,
      url: "#",
    });
  }
  if (temAudio) {
    anexos.push({
      id: id(`anx${n}`, 4),
      nome: "audio-confirmacao.ogg",
      tipo: "audio_confirmacao",
      tamanhoBytes: inteiro(r, 60_000, 420_000),
      mime: "audio/ogg",
      criadoEm: iso(maisHoras(criadoEm, 1)),
      criadoPor: vendedor.id,
      url: "#",
    });
  }
  if (pago) {
    anexos.push({
      id: id(`anx${n}`, 1),
      nome: `comprovante-${cliente.nome.split(" ")[0].toLowerCase()}.jpg`,
      tipo: "comprovante",
      tamanhoBytes: inteiro(r, 180_000, 920_000),
      mime: "image/jpeg",
      criadoEm: cobranca.pagoEm!,
      criadoPor: COBRADOR_ID,
      url: "#",
    });
  }
  if (entregueEm && talvez(r, 0.25)) {
    anexos.push({
      id: id(`anx${n}`, 2),
      nome: "foto-entrega.jpg",
      tipo: "foto_entrega",
      tamanhoBytes: inteiro(r, 240_000, 1_400_000),
      mime: "image/jpeg",
      criadoEm: iso(entregueEm),
      criadoPor: vendedor.id,
      url: "#",
    });
  }

  const ajustes: AjusteValor[] = [];
  if (talvez(r, 0.18)) {
    const pendente = status === "agendado" || status === "aguardando_autorizacao";
    const solicitadoEm = maisHoras(criadoEm, inteiro(r, 1, 6));
    const acrescimo = talvez(r, 0.2);
    const delta = inteiro(r, 10, 40) * 100;
    ajustes.push({
      id: id(`aju${n}`, 1),
      pedidoId: id("ped", n),
      tipo: acrescimo ? "acrescimo" : "desconto",
      valorAnterior: valorTotal,
      valorSolicitado: acrescimo ? valorTotal + delta : valorTotal - delta,
      motivo: escolher(r, acrescimo ? MOTIVOS_ACRESCIMO : MOTIVOS_AJUSTE),
      solicitadoPor: vendedor.id,
      solicitadoEm: iso(solicitadoEm),
      status: pendente ? "pendente" : talvez(r, 0.7) ? "aprovado" : "recusado",
      decididoPor: pendente ? null : "col_0001",
      decididoEm: pendente ? null : iso(maisHoras(solicitadoEm, inteiro(r, 1, 20))),
      observacaoDecisao: pendente ? null : "Analisado pelo Admin.",
    });
  }

  // O vendedor não edita nem exclui: ele pede, e o Admin resolve na fila.
  if (talvez(r, 0.1) && !["cancelado", "pago"].includes(status)) {
    const exclusao = talvez(r, 0.35);
    const solicitadoEm = maisHoras(criadoEm, inteiro(r, 2, 30));
    ajustes.push({
      id: id(`aju${n}`, 2),
      pedidoId: id("ped", n),
      tipo: exclusao ? "exclusao" : "alteracao_cadastral",
      valorAnterior: valorTotal,
      valorSolicitado: valorTotal,
      motivo: escolher(r, exclusao ? MOTIVOS_EXCLUSAO : MOTIVOS_ALTERACAO),
      solicitadoPor: vendedor.id,
      solicitadoEm: iso(solicitadoEm),
      status: "pendente",
      decididoPor: null,
      decididoEm: null,
      observacaoDecisao: null,
    });
  }

  const custos = custosDoStatus(status, frete, kit.id);

  const linhaDoTempo = montarLinhaDoTempo({
    n,
    r,
    status,
    criadoEm,
    autorizadoEm,
    rastreio,
    cobranca,
    custos,
    ajustes,
    anexos,
    vendedorId: vendedor.id,
    valorTotal,
    idade,
  });

  return {
    id: id("ped", n),
    codigo: `AX-${2400 + n}`,
    status,
    cliente,
    itens,
    valorTotal,
    frete,
    vendedorId: vendedor.id,
    criativoId,
    linhaWhatsappId: linha?.id ?? null,
    agendadoPara:
      status === "agendado" ? iso(maisDias(HOJE, inteiro(r, 0, 2))) : null,
    criadoEm: iso(criadoEm),
    autorizadoEm: autorizadoEm ? iso(autorizadoEm) : null,
    autorizadoPor: autorizadoEm ? "col_0001" : null,
    rastreio,
    cobranca,
    custos,
    ajustes,
    anexos,
    linhaDoTempo,
    confirmacaoPorTexto,
    enderecoValidado,
    motivoCancelamento:
      status === "cancelado" ? escolher(r, MOTIVOS_CANCELAMENTO) : null,
    observacoes:
      status === "reembolsado" ? escolher(r, MOTIVOS_REEMBOLSO) : null,
    fonte: "manual",
    atualizadoEm: iso(maisDias(HOJE, -inteiro(r, 0, Math.max(idade - 1, 0)))),
  };
}

interface ArgsLinhaDoTempo {
  n: number;
  r: Rng;
  status: StatusPedido;
  criadoEm: Date;
  autorizadoEm: Date | null;
  rastreio: Rastreio | null;
  cobranca: Cobranca;
  custos: CustosPedido;
  ajustes: AjusteValor[];
  anexos: Anexo[];
  vendedorId: string;
  valorTotal: number;
  idade: number;
}

/**
 * Linha do tempo do pedido: criação, autorização, eventos de rastreio,
 * cobrança, custos gerados, ajustes de valor e anexos, em ordem cronológica.
 */
function montarLinhaDoTempo(a: ArgsLinhaDoTempo): EventoPedido[] {
  const eventos: EventoPedido[] = [];
  let seq = 1;
  const push = (e: Omit<EventoPedido, "id">) =>
    eventos.push({ ...e, id: id(`evt${a.n}`, seq++) });

  push({
    tipo: "criacao",
    titulo: "Pedido criado",
    descricao: `Fechamento por telefone, valor de ${formatBRL(a.valorTotal)}.`,
    ocorridoEm: iso(a.criadoEm),
    autorId: a.vendedorId,
    fonte: "manual",
    status: "agendado",
    valor: a.valorTotal,
  });

  for (const ajuste of a.ajustes) {
    push({
      tipo: "ajuste",
      titulo: "Ajuste de valor solicitado",
      descricao: `${ajuste.motivo} De ${formatBRL(ajuste.valorAnterior)} para ${formatBRL(ajuste.valorSolicitado)}.`,
      ocorridoEm: ajuste.solicitadoEm,
      autorId: ajuste.solicitadoPor,
      fonte: "manual",
      valor: ajuste.valorSolicitado,
    });
    if (ajuste.decididoEm) {
      push({
        tipo: "ajuste",
        titulo:
          ajuste.status === "aprovado" ? "Ajuste aprovado" : "Ajuste recusado",
        descricao: ajuste.observacaoDecisao,
        ocorridoEm: ajuste.decididoEm,
        autorId: ajuste.decididoPor,
        fonte: "manual",
      });
    }
  }

  if (a.status !== "agendado" && a.status !== "cancelado") {
    push({
      tipo: "status",
      titulo: "Enviado para autorização",
      descricao: "Aguardando o Admin liberar o envio.",
      ocorridoEm: iso(maisHoras(a.criadoEm, 2)),
      autorId: a.vendedorId,
      fonte: "manual",
      status: "aguardando_autorizacao",
    });
  }

  if (a.autorizadoEm) {
    push({
      tipo: "autorizacao",
      titulo: "Envio autorizado",
      descricao: a.rastreio
        ? `Código de rastreio ${a.rastreio.codigo} gerado.`
        : null,
      ocorridoEm: iso(a.autorizadoEm),
      autorId: "col_0001",
      fonte: "manual",
      status: "autorizado",
    });
  }

  // Os eventos chegam mais-recente-primeiro; a linha do tempo do pedido é
  // ordenada no fim, então a ordem de inserção aqui não importa.
  for (const evento of a.rastreio?.eventos ?? []) {
    push({
      tipo: "rastreio",
      titulo: STATUS_RASTREIO[evento.status].rotulo,
      descricao: `${evento.titulo} — ${evento.unidade}`,
      ocorridoEm: evento.ocorridoEm,
      autorId: null,
      fonte: "manual",
    });
  }

  if (a.cobranca.tentativas > 0 && a.cobranca.ultimaTentativaEm) {
    push({
      tipo: "cobranca",
      titulo: `${a.cobranca.tentativas} ${a.cobranca.tentativas === 1 ? "tentativa" : "tentativas"} de cobrança`,
      descricao:
        a.status === "inadimplente"
          ? "Cliente não atende e não responde no WhatsApp."
          : "Contato feito pelo cobrador responsável.",
      ocorridoEm: a.cobranca.ultimaTentativaEm,
      autorId: a.cobranca.responsavelId,
      fonte: "manual",
    });
  }

  if (a.cobranca.pagoEm) {
    push({
      tipo: "cobranca",
      titulo: "Pagamento recebido",
      descricao: `Recebido via ${ROTULO_FORMA[a.cobranca.formaPagamento].toLowerCase()}.`,
      ocorridoEm: a.cobranca.pagoEm,
      autorId: a.cobranca.responsavelId,
      fonte: "manual",
      status: "pago",
      valor: a.valorTotal,
    });
  }

  if (a.status === "cancelado") {
    push({
      tipo: "status",
      titulo: "Pedido cancelado",
      descricao:
        "Cancelado antes da autorização. Custo zero, conta como frustrado.",
      ocorridoEm: iso(maisHoras(a.criadoEm, 20)),
      autorId: "col_0001",
      fonte: "manual",
      status: "cancelado",
      valor: 0,
    });
  }

  if (a.custos.total > 0) {
    push({
      tipo: "custo",
      titulo:
        a.status === "reembolsado"
          ? "Custo de frete gerado"
          : "Custo de frete e de pote gerado",
      descricao:
        a.status === "reembolsado"
          ? `Frete de ida e volta: ${formatBRL(a.custos.frete)}.`
          : `Frete ${formatBRL(a.custos.frete)} e pote ${formatBRL(a.custos.pote)}.`,
      ocorridoEm: iso(maisDias(HOJE, -Math.max(a.idade - 12, 1))),
      autorId: null,
      fonte: "manual",
      status: a.status,
      valor: a.custos.total,
    });
  }

  for (const anexo of a.anexos) {
    push({
      tipo: "anexo",
      titulo: "Anexo adicionado",
      descricao: anexo.nome,
      ocorridoEm: anexo.criadoEm,
      autorId: anexo.criadoPor,
      fonte: "manual",
    });
  }

  return eventos.sort(
    (x, y) => new Date(x.ocorridoEm).getTime() - new Date(y.ocorridoEm).getTime(),
  );
}

/**
 * Taxa de cada recebimento, na ordem em que foram pagos: o boleto só paga
 * tarifa depois de esgotar a franquia do banco naquela competência.
 */
function aplicarTaxas(pedidos: Pedido[]): Pedido[] {
  const boletos = new Map<string, number>();
  const pagos = pedidos
    .filter((p) => p.cobranca.pagoEm && p.cobranca.valorRecebido !== null)
    .sort((a, b) => a.cobranca.pagoEm!.localeCompare(b.cobranca.pagoEm!));
  const taxaPorId = new Map<string, number>();
  for (const p of pagos) {
    const banco = p.cobranca.bancoId ? (BANCO_POR_ID.get(p.cobranca.bancoId) ?? null) : null;
    const chave = `${p.cobranca.bancoId}|${p.cobranca.pagoEm!.slice(0, 7)}`;
    const emitidos = boletos.get(chave) ?? 0;
    taxaPorId.set(
      p.id,
      taxaEstimada(banco, p.cobranca.formaPagamento, p.cobranca.valorRecebido!, emitidos),
    );
    if (p.cobranca.formaPagamento === "boleto") boletos.set(chave, emitidos + 1);
  }
  return pedidos.map((p) =>
    taxaPorId.has(p.id)
      ? { ...p, cobranca: { ...p.cobranca, taxaAplicada: taxaPorId.get(p.id)! } }
      : p,
  );
}

/** Leads de cada criativo por dia, para sortear de onde veio o pedido. */
function leadsPorDia(): Map<string, Array<{ criativoId: string; peso: number }>> {
  const mapa = new Map<string, Array<{ criativoId: string; peso: number }>>();
  for (const l of LANCAMENTOS_META_ADS) {
    const lista = mapa.get(l.data) ?? [];
    lista.push({ criativoId: l.criativoId, peso: l.conversas * (QUALIDADE_CRIATIVO[l.criativoId] ?? 1) });
    mapa.set(l.data, lista);
  }
  return mapa;
}

function sortearPonderado(r: Rng, opcoes: Array<{ criativoId: string; peso: number }>): string | null {
  const total = opcoes.reduce((s, o) => s + o.peso, 0);
  if (total <= 0) return null;
  let alvo = r() * total;
  for (const o of opcoes) {
    alvo -= o.peso;
    if (alvo <= 0) return o.criativoId;
  }
  return opcoes[opcoes.length - 1].criativoId;
}

/**
 * O histórico chega com o rastreio arquivado, como a operação deixa depois de
 * fechar o ciclo: sem isso, meses de objetos entregues lotariam Em trânsito.
 */
function arquivarRastreio(pedido: Pedido): Pedido {
  if (!pedido.rastreio) return pedido;
  const fechado = pedido.cobranca.pagoEm ?? pedido.rastreio.atualizadoEm;
  const arquivadoEm = new Date(Math.min(new Date(fechado).getTime() + 2 * 86_400_000, HOJE.getTime()));
  return {
    ...pedido,
    rastreio: { ...pedido.rastreio, destacado: false, arquivado: true, arquivadoEm: iso(arquivadoEm) },
  };
}

/** Pedido fechado mais novo que o histórico gera: antes disso, o ciclo ainda corre. */
const IDADE_MINIMA_HISTORICO = 12;

/**
 * Histórico de março até doze dias atrás: só pedidos que já fecharam o ciclo.
 * Completa o volume esperado de cada dia descontando o que a operação corrente
 * já pôs lá, e puxa o criativo dos leads do dia, para CPA e conversão da
 * análise de criativos saírem dos próprios pedidos.
 */
function gerarHistorico(r: Rng, primeiroN: number, correntes: Pedido[]): Pedido[] {
  const leads = leadsPorDia();
  const porDia = new Map<string, number>();
  for (const p of correntes) {
    const dia = p.criadoEm.slice(0, 10);
    porDia.set(dia, (porDia.get(dia) ?? 0) + 1);
  }

  const pedidos: Pedido[] = [];
  let n = primeiroN;
  for (let idade = DIAS_HISTORICO; idade >= IDADE_MINIMA_HISTORICO; idade--) {
    const data = maisDias(HOJE, -idade);
    const dia = iso(data).slice(0, 10);
    const esperado = Math.round(vendasEsperadas(idade) * (0.75 + r() * 0.5));
    const quantidade = Math.max(0, esperado - (porDia.get(dia) ?? 0));
    const vendedores = VENDEDORES.filter((v) => new Date(v.entrouEm) <= data);
    const doDia = leads.get(dia) ?? [];

    for (let i = 0; i < quantidade; i++) {
      const sorteio = r();
      const status: StatusPedido =
        sorteio < 0.075
          ? "cancelado"
          : sorteio < 0.135
            ? "reembolsado"
            : sorteio < 0.17 && idade >= 22
              ? "inadimplente"
              : "pago";
      // Um em cada dez leads chega sem código rastreável.
      const semCodigo = r() < 0.1;
      const criativoId = semCodigo
        ? null
        : (sortearPonderado(r, doDia) ?? CRIATIVOS.find((c) => criativoNoAr(c, idade))?.id ?? null);
      const pedido = gerarPedido(r, n++, status, {
        idade,
        criativoId,
        vendedores: vendedores.length > 0 ? vendedores : VENDEDORES,
      });
      pedidos.push(arquivarRastreio(pedido));
    }
  }
  return pedidos;
}

function gerarPedidos(): Pedido[] {
  const r = rng(987654321);
  const fila: StatusPedido[] = DISTRIBUICAO.flatMap(([status, quantidade]) =>
    Array.from({ length: quantidade }, () => status),
  );
  const correntes = fila.map((status, i) => gerarPedido(r, i + 1, status));
  const historico = gerarHistorico(rng(20260401), correntes.length + 1, correntes);
  const pedidos = aplicarTaxas([...correntes, ...historico]).sort(
    (a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime(),
  );
  // Código em ordem de criação: o mais novo fica logo abaixo do primeiro
  // código que a sessão gera (AX-2500).
  return pedidos.map((p, i) => ({ ...p, codigo: `AX-${2499 - i}` }));
}

export const PEDIDOS: Pedido[] = gerarPedidos();
export const PEDIDO_POR_ID = new Map(PEDIDOS.map((p) => [p.id, p]));

/* ----------------------------------------------------------------
   Seletores — o que as telas consomem hoje e o backend devolverá depois.
   ---------------------------------------------------------------- */

export function pedidosDoVendedor(vendedorId: string): Pedido[] {
  return PEDIDOS.filter((p) => p.vendedorId === vendedorId);
}

export function pedidosDoCobrador(vendedoresAtribuidos: string[]): Pedido[] {
  return PEDIDOS.filter((p) => vendedoresAtribuidos.includes(p.vendedorId));
}

export const PEDIDOS_AGUARDANDO_AUTORIZACAO = PEDIDOS.filter(
  (p) => p.status === "aguardando_autorizacao",
);

export const PEDIDOS_EM_COBRANCA = PEDIDOS.filter((p) =>
  ["entregue", "inadimplente"].includes(p.status),
);

export const PEDIDOS_EM_RASTREIO = PEDIDOS.filter(
  (p) => p.rastreio !== null && ["autorizado", "em_transito"].includes(p.status),
);

export const AJUSTES_PENDENTES = PEDIDOS.flatMap((p) =>
  p.ajustes.filter((a) => a.status === "pendente"),
);

export function contarPorStatus(pedidos = PEDIDOS): Record<StatusPedido, number> {
  const base = Object.fromEntries(
    Object.keys(STATUS_PEDIDO).map((s) => [s, 0]),
  ) as Record<StatusPedido, number>;
  for (const p of pedidos) base[p.status] += 1;
  return base;
}

export function somarValor(pedidos: Pedido[]): number {
  return pedidos.reduce((s, p) => s + p.valorTotal, 0);
}

export function somarCustos(pedidos: Pedido[]): number {
  return pedidos.reduce((s, p) => s + p.custos.total, 0);
}
