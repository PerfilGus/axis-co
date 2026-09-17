import type { Endereco } from "@/lib/types";
import { buscarCep as buscarNoServidor } from "@/app/acoes/cep";

/** Busca de endereço por CEP, pelo ViaCEP (via servidor). */

export type ResultadoCep =
  | { ok: true; endereco: Pick<Endereco, "logradouro" | "bairro" | "cidade" | "uf" | "complemento"> }
  | { ok: false; erro: string };

export function cepValido(cep: string): boolean {
  return /^\d{8}$/.test(cep.replace(/\D/g, ""));
}

export async function buscarCep(cep: string): Promise<ResultadoCep> {
  if (!cepValido(cep)) return { ok: false, erro: "CEP precisa ter 8 dígitos." };
  const resultado = await buscarNoServidor(cep);
  return resultado.ok ? { ok: true, endereco: resultado.dados } : { ok: false, erro: resultado.erro };
}
