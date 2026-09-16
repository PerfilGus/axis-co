"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Preferência guardada no navegador.
 *
 * Usa `useSyncExternalStore` em vez de efeito com setState: o servidor renderiza
 * o padrão, o cliente lê o valor salvo e o React reconcilia sem divergência de
 * hidratação nem render em cascata.
 */
export interface Preferencia<T extends string> {
  ler: () => T;
  lerNoServidor: () => T;
  gravar: (valor: T) => void;
  assinar: (aoMudar: () => void) => () => void;
}

export function criarPreferencia<T extends string>(
  chave: string,
  padrao: T,
  aceitos: readonly T[],
): Preferencia<T> {
  const ouvintes = new Set<() => void>();
  let cache: T | null = null;

  function valido(valor: string | null): valor is T {
    return valor !== null && (aceitos as readonly string[]).includes(valor);
  }

  function invalidar() {
    cache = null;
    for (const ouvinte of ouvintes) ouvinte();
  }

  return {
    ler() {
      if (cache !== null) return cache;
      try {
        const salvo = localStorage.getItem(chave);
        cache = valido(salvo) ? salvo : padrao;
      } catch {
        cache = padrao;
      }
      return cache;
    },
    lerNoServidor: () => padrao,
    gravar(valor) {
      try {
        localStorage.setItem(chave, valor);
      } catch {}
      cache = valor;
      for (const ouvinte of ouvintes) ouvinte();
    },
    assinar(aoMudar) {
      ouvintes.add(aoMudar);
      window.addEventListener("storage", invalidar);
      return () => {
        ouvintes.delete(aoMudar);
        if (ouvintes.size === 0) window.removeEventListener("storage", invalidar);
      };
    },
  };
}

export function usePreferencia<T extends string>(
  preferencia: Preferencia<T>,
): [T, (valor: T) => void] {
  const valor = useSyncExternalStore(
    preferencia.assinar,
    preferencia.ler,
    preferencia.lerNoServidor,
  );
  const definir = useCallback(
    (novo: T) => preferencia.gravar(novo),
    [preferencia],
  );
  return [valor, definir];
}
