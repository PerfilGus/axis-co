"use client";

import { toast } from "@/components/ui/toast";

type Resultado<T> = { ok: true; dados: T } | { ok: false; erro: string };

/**
 * Chama uma server action e trata a recusa num lugar só: mostra o motivo e
 * devolve `null`. A tela só confere se veio resultado.
 */
export async function chamar<T>(promessa: Promise<Resultado<T>>): Promise<T | null> {
  try {
    const resultado = await promessa;
    if (resultado.ok) return resultado.dados;
    toast.error(resultado.erro);
    return null;
  } catch {
    toast.error("Sem conexão com o servidor. Tente de novo.");
    return null;
  }
}
