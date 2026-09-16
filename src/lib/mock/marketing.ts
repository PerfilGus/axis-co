import type { Criativo, DiaMetaAds, LancamentoMetaAds, LinhaWhatsApp } from "@/lib/types";
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
    vendedoresIds: ["col_0004", "col_0006"],
    ativa: true,
    criadaEm: iso(maisDias(HOJE, -120)),
  },
];

/**
 * O código é o que aparece no anúncio e casa o lead com o criativo. A
 * variação marca outro corte do mesmo criativo (09001 e 09001 B).
 */
export const CRIATIVOS: Criativo[] = [
  { id: "cri_0001", nome: "Depoimento Dona Marta", codigo: "09001", variacao: null, formato: "video", linhaWhatsappId: "lin_0001", anuncioMeta: "6412880031455", thumbUrl: null, ativo: true, criadoEm: iso(maisDias(HOJE, -180)) },
  { id: "cri_0002", nome: "Depoimento Dona Marta (corte curto)", codigo: "09001", variacao: "B", formato: "video", linhaWhatsappId: "lin_0001", anuncioMeta: "6412880031456", thumbUrl: null, ativo: true, criadoEm: iso(maisDias(HOJE, -150)) },
  { id: "cri_0003", nome: "Antes e depois 90 dias", codigo: "09002", variacao: null, formato: "carrossel", linhaWhatsappId: "lin_0001", anuncioMeta: null, thumbUrl: null, ativo: true, criadoEm: iso(maisDias(HOJE, -150)) },
  { id: "cri_0004", nome: "Médica explica colágeno", codigo: "09003", variacao: null, formato: "video", linhaWhatsappId: "lin_0001", anuncioMeta: "6412880044120", thumbUrl: null, ativo: true, criadoEm: iso(maisDias(HOJE, -120)) },
  { id: "cri_0005", nome: "Oferta 3 potes estática", codigo: "09004", variacao: null, formato: "imagem", linhaWhatsappId: "lin_0001", anuncioMeta: null, thumbUrl: null, ativo: false, criadoEm: iso(maisDias(HOJE, -240)) },
  { id: "cri_0006", nome: "Dor no joelho UGC", codigo: "09010", variacao: null, formato: "video", linhaWhatsappId: "lin_0002", anuncioMeta: "6412991200873", thumbUrl: null, ativo: true, criadoEm: iso(maisDias(HOJE, -95)) },
  { id: "cri_0007", nome: "Pague só quando receber", codigo: "09011", variacao: null, formato: "video", linhaWhatsappId: "lin_0002", anuncioMeta: "6412991200874", thumbUrl: null, ativo: true, criadoEm: iso(maisDias(HOJE, -70)) },
  { id: "cri_0008", nome: "Comparativo de marcas", codigo: "09012", variacao: null, formato: "carrossel", linhaWhatsappId: "lin_0002", anuncioMeta: null, thumbUrl: null, ativo: true, criadoEm: iso(maisDias(HOJE, -52)) },
];

/**
 * Quando o lead chega sem código rastreável. Existe como opção de verdade no
 * formulário para o vendedor nunca ter que digitar um criativo.
 */
export const CRIATIVO_NAO_IDENTIFICADO = "nao_identificado";

export const CRIATIVO_POR_ID = new Map(CRIATIVOS.map((c) => [c.id, c]));
export const LINHA_POR_ID = new Map(LINHAS_WHATSAPP.map((l) => [l.id, l]));
export const CRIATIVOS_ATIVOS = CRIATIVOS.filter((c) => c.ativo);

/** `09001 B` — código com a variação, quando houver. */
export function codigoCompleto(criativo: Criativo): string {
  return criativo.variacao ? `${criativo.codigo} ${criativo.variacao}` : criativo.codigo;
}

/** `09001 · WPP1` — como o criativo é mostrado e escolhido na interface. */
export function rotuloCriativo(
  criativoId: string | null,
  criativos: Criativo[] = CRIATIVOS,
  linhas: LinhaWhatsApp[] = LINHAS_WHATSAPP,
): string {
  if (!criativoId || criativoId === CRIATIVO_NAO_IDENTIFICADO) {
    return "Criativo não identificado";
  }
  const criativo = criativos.find((c) => c.id === criativoId);
  if (!criativo) return "Criativo não identificado";
  const linha = linhas.find((l) => l.id === criativo.linhaWhatsappId);
  return `${codigoCompleto(criativo)} · ${linha?.nome ?? "sem linha"}`;
}

/** Opções do seletor de criativo, já com a saída para lead sem código. */
export function opcoesCriativo(
  criativos: Criativo[] = CRIATIVOS_ATIVOS,
  linhas: LinhaWhatsApp[] = LINHAS_WHATSAPP,
) {
  return [
    ...criativos
      .filter((c) => c.ativo)
      .map((c) => ({
        valor: c.id,
        rotulo: rotuloCriativo(c.id, criativos, linhas),
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

/**
 * Dias de histórico dos mocks: de 1º de março até hoje. Março é o mês de
 * partida — o relatório compara de abril em diante, quando o caixa já carrega
 * o fornecedor, o imposto e a folha do mês anterior.
 */
export const DIAS_HISTORICO = 198;

/** Dias mais recentes em que a API não trouxe dados e o total foi lançado à mão. */
const DIAS_SEM_API = 3;

/**
 * Até quando um criativo hoje inativo rodou, em dias antes de hoje. Ele tem
 * história: gerou leads e pedidos antes de ser desligado.
 */
const ENCERRADO_HA_DIAS: Record<string, number> = { cri_0005: 60 };

/**
 * Quanto cada criativo converte lead em pedido, relativo à média. É o que faz
 * o CPA variar de um criativo para outro na análise.
 */
export const QUALIDADE_CRIATIVO: Record<string, number> = {
  cri_0001: 1.1,
  cri_0002: 0.9,
  cri_0003: 0.8,
  cri_0004: 1.2,
  cri_0005: 0.7,
  cri_0006: 1,
  cri_0007: 1.35,
  cri_0008: 0.65,
};

/**
 * Pedidos esperados num dia: a operação cresce de pouco mais de 3 por dia em
 * março para 6 em setembro, com fim de semana mais fraco.
 */
export function vendasEsperadas(diasAtras: number): number {
  const data = maisDias(HOJE, -diasAtras);
  const tendencia = 3.2 + ((DIAS_HISTORICO - diasAtras) / DIAS_HISTORICO) * 2.8;
  const semana = data.getDay() === 0 ? 0.55 : data.getDay() === 6 ? 0.75 : 1.1;
  return tendencia * semana;
}

/** CPA alvo do mês, em centavos: tem mês bom e mês ruim de tráfego. */
const CPA_POR_MES: Record<string, number> = {
  "03": 3600,
  "04": 3400,
  "05": 2900,
  "06": 3900,
  "07": 3100,
  "08": 2700,
  "09": 3000,
};

/** O criativo estava no ar naquele dia? */
export function criativoNoAr(criativo: Criativo, diasAtras: number): boolean {
  const data = maisDias(HOJE, -diasAtras);
  if (new Date(criativo.criadoEm) > data) return false;
  const encerrado = ENCERRADO_HA_DIAS[criativo.id];
  if (encerrado !== undefined) return diasAtras >= encerrado;
  return criativo.ativo;
}

function gerarMetaAds(): { lancamentos: LancamentoMetaAds[]; manuais: DiaMetaAds[] } {
  const r = rng(20260915);
  const lancamentos: LancamentoMetaAds[] = [];
  const manuais: DiaMetaAds[] = [];
  let n = 1;

  // Hoje ainda não tem dado: é o dia que fica para lançar.
  for (let dia = DIAS_HISTORICO; dia >= 1; dia--) {
    const data = maisDias(HOJE, -dia);
    const cpa = CPA_POR_MES[isoDia(data).slice(5, 7)] ?? 3000;
    const investimentoDia = Math.round(vendasEsperadas(dia) * cpa * (0.85 + r() * 0.3));

    const noAr = CRIATIVOS.filter((c) => criativoNoAr(c, dia)).filter(() => r() >= 0.12);
    const pesos = noAr.map(() => 0.4 + r() * 0.8);
    const somaPesos = pesos.reduce((s, p) => s + p, 0);

    if (dia <= DIAS_SEM_API) {
      const cpl = inteiro(r, 330, 520);
      manuais.push({
        id: id("mdia", manuais.length + 1),
        data: isoDia(data),
        investimento: investimentoDia,
        leads: Math.round(investimentoDia / cpl),
        fonte: "manual",
        lancadoEm: iso(maisDias(data, 0.4)),
      });
      continue;
    }

    noAr.forEach((criativo, i) => {
      const investimento = Math.round((investimentoDia * pesos[i]) / somaPesos);
      const qualidade = QUALIDADE_CRIATIVO[criativo.id] ?? 1;
      // Criativo bom também puxa lead mais barato, mas menos do que converte.
      const cpl = inteiro(r, 320, 540) / Math.sqrt(qualidade);
      const conversas = Math.max(0, Math.round(investimento / cpl));
      const cliques = Math.round(conversas / (0.28 + r() * 0.22));
      const impressoes = Math.round(cliques / (0.012 + r() * 0.022));
      lancamentos.push({
        id: id("meta", n++),
        data: isoDia(data),
        criativoId: criativo.id,
        campanha: CAMPANHAS[n % CAMPANHAS.length],
        investimento,
        impressoes,
        cliques,
        conversas,
        fonte: "api",
      });
    });
  }
  return { lancamentos, manuais };
}

const META_ADS = gerarMetaAds();

/** Detalhe por criativo, como a API do Meta devolve. */
export const LANCAMENTOS_META_ADS: LancamentoMetaAds[] = META_ADS.lancamentos;

/** Dias que a API não trouxe, com o total lançado à mão. */
export const DIAS_META_ADS_MANUAIS: DiaMetaAds[] = META_ADS.manuais;
