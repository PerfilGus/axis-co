import type { Endereco } from "@/lib/types";
import { CIDADES, LOGRADOUROS, BAIRROS } from "@/lib/mock/pessoas";

/**
 * Busca de endereço por CEP — simulada.
 *
 * Deriva um endereço plausível do próprio CEP, de forma determinística: o
 * mesmo CEP devolve sempre a mesma rua. Quando a integração entrar, só o corpo
 * de `buscarCep` muda; a assinatura já é a de uma chamada de rede.
 */

export type ResultadoCep =
  | { ok: true; endereco: Pick<Endereco, "logradouro" | "bairro" | "cidade" | "uf"> }
  | { ok: false; erro: string };

export function cepValido(cep: string): boolean {
  return /^\d{8}$/.test(cep.replace(/\D/g, ""));
}

function somaDigitos(texto: string): number {
  return [...texto].reduce((soma, c) => soma + c.charCodeAt(0), 0);
}

export async function buscarCep(cep: string): Promise<ResultadoCep> {
  const digitos = cep.replace(/\D/g, "");

  if (!cepValido(digitos)) {
    return { ok: false, erro: "CEP precisa ter 8 dígitos." };
  }

  // Latência parecida com a de uma consulta real, para a interface não
  // esconder o estado de carregamento.
  await new Promise((resolve) => setTimeout(resolve, 420));

  // CEP terminado em 000 finge não existir, para a tela ter um caminho de erro
  // testável.
  if (digitos.endsWith("000")) {
    return { ok: false, erro: "CEP não encontrado. Preencha o endereço à mão." };
  }

  const cidade =
    CIDADES.find((c) => digitos.startsWith(c.cepBase)) ??
    CIDADES[somaDigitos(digitos) % CIDADES.length];
  const semente = somaDigitos(digitos);

  return {
    ok: true,
    endereco: {
      logradouro: LOGRADOUROS[semente % LOGRADOUROS.length],
      bairro: BAIRROS[(semente >> 2) % BAIRROS.length],
      cidade: cidade.cidade,
      uf: cidade.uf,
    },
  };
}
