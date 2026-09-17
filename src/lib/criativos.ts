import type { Criativo, LinhaWhatsApp } from "@/lib/types";

/** Valor do seletor para o lead que chegou sem código rastreável. */
export const CRIATIVO_NAO_IDENTIFICADO = "nao_identificado";

/** `09001 B` — código com a variação, quando houver. */
export function codigoCompleto(criativo: Criativo): string {
  return criativo.variacao ? `${criativo.codigo} ${criativo.variacao}` : criativo.codigo;
}

/** `09001 · WPP1` — como o criativo é mostrado e escolhido na interface. */
export function rotuloCriativo(
  criativoId: string | null,
  criativos: Criativo[],
  linhas: LinhaWhatsApp[],
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
export function opcoesCriativo(criativos: Criativo[], linhas: LinhaWhatsApp[]) {
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
