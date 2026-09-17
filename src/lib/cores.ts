/**
 * Paleta Axis: oito famílias, quatro papéis cada. Os valores moram só em
 * `globals.css` (variáveis `--cor-{familia}-{variacao}`, com um jogo por tema);
 * aqui ficam os nomes, o uso de cada papel e o formato gravado no banco.
 *
 * Uma cor escolhida pelo usuário é gravada como chave (`roxo-vibrante`), nunca
 * como hex: assim acompanha o tema e uma futura revisão da paleta.
 */

export type Familia =
  | "amarelo"
  | "laranja"
  | "vermelho"
  | "vinho"
  | "roxo"
  | "azul"
  | "verde"
  | "neutro";

export type Variacao = "vibrante" | "pastel" | "escuro" | "claro";

export type ChaveCor = `${Familia}-${Variacao}`;

export const FAMILIAS: Array<{ chave: Familia; rotulo: string }> = [
  { chave: "amarelo", rotulo: "Amarelo" },
  { chave: "laranja", rotulo: "Laranja" },
  { chave: "vermelho", rotulo: "Vermelho" },
  { chave: "vinho", rotulo: "Vinho" },
  { chave: "roxo", rotulo: "Roxo" },
  { chave: "azul", rotulo: "Azul" },
  { chave: "verde", rotulo: "Verde" },
  { chave: "neutro", rotulo: "Neutro" },
];

export const VARIACOES: Array<{ chave: Variacao; rotulo: string; uso: string }> = [
  { chave: "vibrante", rotulo: "Vibrante", uso: "Ícones, destaques e gráficos." },
  { chave: "pastel", rotulo: "Pastel", uso: "Texto de badge sobre fundo escuro." },
  { chave: "escuro", rotulo: "Escuro", uso: "Preenchimento de badge e card." },
  { chave: "claro", rotulo: "Claro", uso: "Texto de alto contraste e realces raros." },
];

export const CHAVES_COR = FAMILIAS.flatMap((f) =>
  VARIACOES.map((v) => `${f.chave}-${v.chave}` as ChaveCor),
);

/** Valor CSS de um papel da paleta. */
export function cor(familia: Familia, variacao: Variacao): string {
  return `var(--cor-${familia}-${variacao})`;
}

export function ehChaveCor(valor: string): valor is ChaveCor {
  return (CHAVES_COR as string[]).includes(valor);
}

export function partesDaCor(chave: ChaveCor): { familia: Familia; variacao: Variacao } {
  const [familia, variacao] = chave.split("-") as [Familia, Variacao];
  return { familia, variacao };
}

export function corDaChave(chave: ChaveCor): string {
  const { familia, variacao } = partesDaCor(chave);
  return cor(familia, variacao);
}

export function rotuloDaCor(chave: ChaveCor): string {
  const { familia, variacao } = partesDaCor(chave);
  const f = FAMILIAS.find((x) => x.chave === familia)?.rotulo ?? familia;
  const v = VARIACOES.find((x) => x.chave === variacao)?.rotulo ?? variacao;
  return `${f} ${v.toLowerCase()}`;
}

/** Contraste WCAG entre duas cores `#rrggbb`. */
export function contraste(a: string, b: string): number {
  const luminancia = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}
