"use server";

import type { Endereco } from "@/lib/types";
import { executar, exigirUsuario, ErroDeAcao, type Resultado } from "@/lib/servidor/sessao";

/**
 * Busca de endereço pelo CEP no ViaCEP. Roda no servidor: o navegador não fala
 * com serviço de terceiro e o CEP digitado não fica exposto na política de
 * conteúdo.
 */
export async function buscarCep(cep: string): Promise<Resultado<Pick<Endereco, "logradouro" | "bairro" | "cidade" | "uf" | "complemento">>> {
  return executar(async () => {
    await exigirUsuario();
    const digitos = String(cep ?? "").replace(/\D/g, "");
    if (digitos.length !== 8) throw new ErroDeAcao("CEP precisa ter 8 dígitos.");

    let resposta: Response;
    try {
      resposta = await fetch(`https://viacep.com.br/ws/${digitos}/json/`, {
        signal: AbortSignal.timeout(6000),
        cache: "force-cache",
      });
    } catch {
      throw new ErroDeAcao("A busca de CEP não respondeu. Preencha o endereço à mão.");
    }
    if (!resposta.ok) throw new ErroDeAcao("CEP inválido.");
    const dados = (await resposta.json()) as {
      erro?: boolean | string;
      logradouro?: string;
      complemento?: string;
      bairro?: string;
      localidade?: string;
      uf?: string;
    };
    if (dados.erro) throw new ErroDeAcao("CEP não encontrado. Preencha o endereço à mão.");
    return {
      logradouro: dados.logradouro ?? "",
      bairro: dados.bairro ?? "",
      cidade: dados.localidade ?? "",
      uf: dados.uf ?? "",
      complemento: dados.complemento || null,
    };
  });
}
