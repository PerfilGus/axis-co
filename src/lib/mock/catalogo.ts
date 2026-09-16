import type { Kit, Produto } from "@/lib/types";
import { iso, maisDias, HOJE } from "./base";

export const PRODUTOS: Produto[] = [
  {
    id: "prod_0001",
    nome: "Renovax Colágeno Hidrolisado",
    sabor: "Limão",
    gramas: 150,
    custoUnitario: 2790,
    fotoUrl: null,
    ativo: true,
    criadoEm: iso(maisDias(HOJE, -420)),
  },
];

export const KITS: Kit[] = [
  {
    id: "kit_0001",
    nome: "Kit Experiência",
    descricao: "1 pote. Entrada de funil, para quem quer testar.",
    itens: [{ produtoId: "prod_0001", quantidade: 1 }],
    precoTabela: 14700,
    precoMinimo: 12700,
    freteEstimado: 2490,
    ativo: true,
    criadoEm: iso(maisDias(HOJE, -400)),
  },
  {
    id: "kit_0002",
    nome: "Kit Tratamento",
    descricao: "3 potes. Tratamento de 90 dias, o mais vendido.",
    itens: [{ produtoId: "prod_0001", quantidade: 3 }],
    precoTabela: 29700,
    precoMinimo: 25700,
    freteEstimado: 2990,
    ativo: true,
    criadoEm: iso(maisDias(HOJE, -400)),
  },
  {
    id: "kit_0003",
    nome: "Kit Resultado",
    descricao: "5 potes. Melhor margem por envio.",
    itens: [{ produtoId: "prod_0001", quantidade: 5 }],
    precoTabela: 44700,
    precoMinimo: 38700,
    freteEstimado: 3490,
    ativo: true,
    criadoEm: iso(maisDias(HOJE, -320)),
  },
];

export const PRODUTO_POR_ID = new Map(PRODUTOS.map((p) => [p.id, p]));
export const KIT_POR_ID = new Map(KITS.map((k) => [k.id, k]));

/** Quantos potes um kit carrega. Base do custo de inadimplência. */
export function potesDoKit(kitId: string, kits: Kit[] = KITS): number {
  const kit = kits.find((k) => k.id === kitId);
  if (!kit) return 0;
  return kit.itens.reduce((soma, i) => soma + i.quantidade, 0);
}

export function custoPotesDoKit(
  kitId: string,
  kits: Kit[] = KITS,
  produtos: Produto[] = PRODUTOS,
): number {
  const kit = kits.find((k) => k.id === kitId);
  if (!kit) return 0;
  return kit.itens.reduce((soma, i) => {
    const produto = produtos.find((p) => p.id === i.produtoId);
    return soma + (produto ? produto.custoUnitario * i.quantidade : 0);
  }, 0);
}
