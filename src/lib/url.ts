"use client";

import { useCallback } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Estado guardado na query da URL, como `?pedido=<id>`. É o que deixa a busca
 * global e as notificações levarem direto ao item, e recarregar a página manter
 * o que estava aberto. A troca usa a History API: sem ida ao servidor.
 */
export function useParametroUrl(chave: string): [string | null, (valor: string | null) => void] {
  const valor = useSearchParams().get(chave);
  const definir = useCallback(
    (novo: string | null) => {
      const url = new URL(window.location.href);
      if (novo === null) url.searchParams.delete(chave);
      else url.searchParams.set(chave, novo);
      window.history.replaceState(null, "", url);
    },
    [chave],
  );
  return [valor, definir];
}
