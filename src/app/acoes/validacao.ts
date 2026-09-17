import { z } from "zod";

/**
 * Schemas compartilhados pelas ações. O servidor nunca confia no que a tela
 * mandou: tudo passa por aqui antes de tocar o banco.
 */

export const schemaId = z.string().trim().min(1).max(64);

/** Texto livre com limite; vazio vira string vazia. */
export const textoLivre = (max: number) => z.string().trim().max(max, `Use no máximo ${max} caracteres.`);

const soDigitos = (valor: string) => valor.replace(/\D/g, "");

export const schemaEndereco = z.object({
  cep: z.string().transform(soDigitos).pipe(z.string().length(8, "CEP precisa ter 8 dígitos.")),
  logradouro: z.string().trim().min(1, "Informe a rua.").max(200),
  numero: z.string().trim().min(1, "Informe o número.").max(20),
  complemento: z.string().trim().max(120).nullable().transform((v) => v || null),
  bairro: z.string().trim().min(1, "Informe o bairro.").max(120),
  cidade: z.string().trim().min(1, "Informe a cidade.").max(120),
  uf: z.string().trim().length(2, "Informe a UF.").toUpperCase(),
  referencia: z.string().trim().max(200).nullable().transform((v) => v || null),
});

export const schemaCliente = z.object({
  nome: z.string().trim().min(3, "Informe o nome completo do cliente.").max(160),
  telefone: z
    .string()
    .transform(soDigitos)
    .pipe(z.string().min(10, "Telefone com DDD, 10 ou 11 dígitos.").max(11, "Telefone com DDD, 10 ou 11 dígitos.")),
  cpf: z
    .string()
    .nullable()
    .transform((v) => (v ? soDigitos(v) : null))
    .pipe(z.string().length(11, "CPF precisa ter 11 dígitos.").nullable()),
  endereco: schemaEndereco,
  observacoes: z.string().trim().max(1000).nullable().transform((v) => v || null),
});

/** Centavos: inteiro, sem negativo. */
export const centavos = z.number().int().min(0).max(1_000_000_000);

export const bps = z.number().int().min(0).max(100_000);

export const dataISO = z.string().datetime({ offset: true });

export const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");

export const competencia = z.string().regex(/^\d{4}-\d{2}$/, "Competência inválida.");
