import type { Kit, Produto } from "@/lib/types";

/** Quantos potes saem num kit. */
export function potesDoKit(kitId: string, kits: Kit[]): number {
  const kit = kits.find((k) => k.id === kitId);
  if (!kit) return 0;
  return kit.itens.reduce((soma, i) => soma + i.quantidade, 0);
}

/** Custo dos potes de um kit, pelo custo unitário de cada produto. */
export function custoPotesDoKit(kitId: string, kits: Kit[], produtos: Produto[]): number {
  const kit = kits.find((k) => k.id === kitId);
  if (!kit) return 0;
  return kit.itens.reduce((soma, i) => {
    const produto = produtos.find((p) => p.id === i.produtoId);
    return soma + (produto ? produto.custoUnitario * i.quantidade : 0);
  }, 0);
}
