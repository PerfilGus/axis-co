import type { Criativo, LancamentoMetaAds, LinhaWhatsApp } from "@/lib/types";
import { HOJE, id, inteiro, iso, isoDia, maisDias, rng } from "./base";

export const LINHAS_WHATSAPP: LinhaWhatsApp[] = [
  {
    id: "lin_0001",
    nome: "WPP1",
    numero: "11987001122",
    vendedoresIds: ["col_0002", "col_0003"],
    ativa: true,
    criadaEm: iso(maisDias(HOJE, -410)),
  },
  {
    id: "lin_0002",
    nome: "WPP2",
    numero: "11987003344",
    vendedoresIds: ["col_0004"],
    ativa: true,
    criadaEm: iso(maisDias(HOJE, -120)),
  },
];

/**
 * O código é o que aparece no anúncio e casa o lead com o criativo. A letra
 * no fim marca uma variação do mesmo criativo (09001 e 09001B).
 */
export const CRIATIVOS: Criativo[] = [
  { id: "cri_0001", nome: "Depoimento Dona Marta", codigo: "09001", formato: "video", linhaWhatsappId: "lin_0001", thumbUrl: null, ativo: true, criadoEm: iso(maisDias(HOJE, -180)) },
  { id: "cri_0002", nome: "Depoimento Dona Marta (corte curto)", codigo: "09001B", formato: "video", linhaWhatsappId: "lin_0001", thumbUrl: null, ativo: true, criadoEm: iso(maisDias(HOJE, -150)) },
  { id: "cri_0003", nome: "Antes e depois 90 dias", codigo: "09002", formato: "carrossel", linhaWhatsappId: "lin_0001", thumbUrl: null, ativo: true, criadoEm: iso(maisDias(HOJE, -150)) },
  { id: "cri_0004", nome: "Médica explica colágeno", codigo: "09003", formato: "video", linhaWhatsappId: "lin_0001", thumbUrl: null, ativo: true, criadoEm: iso(maisDias(HOJE, -120)) },
  { id: "cri_0005", nome: "Oferta 3 potes estática", codigo: "09004", formato: "imagem", linhaWhatsappId: "lin_0001", thumbUrl: null, ativo: false, criadoEm: iso(maisDias(HOJE, -240)) },
  { id: "cri_0006", nome: "Dor no joelho UGC", codigo: "09010", formato: "video", linhaWhatsappId: "lin_0002", thumbUrl: null, ativo: true, criadoEm: iso(maisDias(HOJE, -95)) },
  { id: "cri_0007", nome: "Pague só quando receber", codigo: "09011", formato: "video", linhaWhatsappId: "lin_0002", thumbUrl: null, ativo: true, criadoEm: iso(maisDias(HOJE, -70)) },
  { id: "cri_0008", nome: "Comparativo de marcas", codigo: "09012", formato: "carrossel", linhaWhatsappId: "lin_0002", thumbUrl: null, ativo: true, criadoEm: iso(maisDias(HOJE, -52)) },
];

/**
 * Quando o lead chega sem código rastreável. Existe como opção de verdade no
 * formulário para o vendedor nunca ter que digitar um criativo.
 */
export const CRIATIVO_NAO_IDENTIFICADO = "nao_identificado";

export const CRIATIVO_POR_ID = new Map(CRIATIVOS.map((c) => [c.id, c]));
export const LINHA_POR_ID = new Map(LINHAS_WHATSAPP.map((l) => [l.id, l]));
export const CRIATIVOS_ATIVOS = CRIATIVOS.filter((c) => c.ativo);

/** `09001 · WPP1` — como o criativo é mostrado e escolhido na interface. */
export function rotuloCriativo(criativoId: string | null): string {
  if (!criativoId || criativoId === CRIATIVO_NAO_IDENTIFICADO) {
    return "Criativo não identificado";
  }
  const criativo = CRIATIVO_POR_ID.get(criativoId);
  if (!criativo) return "Criativo não identificado";
  const linha = LINHA_POR_ID.get(criativo.linhaWhatsappId);
  return `${criativo.codigo} · ${linha?.nome ?? "sem linha"}`;
}

/** Opções do seletor de criativo, já com a saída para lead sem código. */
export function opcoesCriativo() {
  return [
    ...CRIATIVOS_ATIVOS.map((c) => ({
      valor: c.id,
      rotulo: rotuloCriativo(c.id),
      detalhe: c.nome,
    })),
    {
      valor: CRIATIVO_NAO_IDENTIFICADO,
      rotulo: "Criativo não identificado",
      detalhe: "Lead chegou sem código rastreável.",
    },
  ];
}

const CAMPANHAS = [
  "PAD | Conversas | Aberto",
  "PAD | Conversas | Interesse suplementos",
  "PAD | Conversas | Lookalike 2%",
  "PAD | Conversas | Retargeting 7d",
];

/** 45 dias de lançamentos diários, um por criativo ativo. */
function gerarLancamentos(): LancamentoMetaAds[] {
  const r = rng(20260915);
  const lista: LancamentoMetaAds[] = [];
  let n = 1;

  for (let dia = 44; dia >= 0; dia--) {
    const data = maisDias(HOJE, -dia);
    const fimDeSemana = [0, 6].includes(data.getDay());

    for (const criativo of CRIATIVOS_ATIVOS) {
      // Criativo ainda não existia naquele dia.
      if (new Date(criativo.criadoEm) > data) continue;
      // Nem todo criativo roda todo dia.
      if (r() < 0.18) continue;

      const base = fimDeSemana ? 0.72 : 1;
      const investimento = Math.round(inteiro(r, 8000, 34000) * base);
      const cpm = inteiro(r, 1800, 3600);
      const impressoes = Math.round((investimento / cpm) * 1000);
      const cliques = Math.round(impressoes * (0.012 + r() * 0.022));
      const conversas = Math.round(cliques * (0.28 + r() * 0.22));

      lista.push({
        id: id("meta", n++),
        data: isoDia(data),
        criativoId: criativo.id,
        campanha: CAMPANHAS[n % CAMPANHAS.length],
        investimento,
        impressoes,
        cliques,
        conversas,
        fonte: "manual",
      });
    }
  }
  return lista;
}

export const LANCAMENTOS_META_ADS: LancamentoMetaAds[] = gerarLancamentos();

export function investimentoTotal(lancamentos = LANCAMENTOS_META_ADS): number {
  return lancamentos.reduce((s, l) => s + l.investimento, 0);
}

export function conversasTotais(lancamentos = LANCAMENTOS_META_ADS): number {
  return lancamentos.reduce((s, l) => s + l.conversas, 0);
}

/** Investimento agregado por dia, pronto para gráfico. */
export function investimentoPorDia(lancamentos = LANCAMENTOS_META_ADS) {
  const mapa = new Map<string, { data: string; investimento: number; conversas: number }>();
  for (const l of lancamentos) {
    const atual = mapa.get(l.data) ?? { data: l.data, investimento: 0, conversas: 0 };
    atual.investimento += l.investimento;
    atual.conversas += l.conversas;
    mapa.set(l.data, atual);
  }
  return [...mapa.values()].sort((a, b) => a.data.localeCompare(b.data));
}
