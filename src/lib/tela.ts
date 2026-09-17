"use client";

import { useSyncExternalStore } from "react";

/**
 * Tela larga (breakpoint `lg` do Tailwind, 1024px). Serve para trocar de
 * componente — coluna fixa no desktop, gaveta no celular — quando só CSS não
 * resolve. No servidor responde `false`.
 */
const CONSULTA = "(min-width: 1024px)";

function assinar(aviso: () => void) {
  const lista = window.matchMedia(CONSULTA);
  lista.addEventListener("change", aviso);
  return () => lista.removeEventListener("change", aviso);
}

export function useTelaLarga(): boolean {
  return useSyncExternalStore(
    assinar,
    () => window.matchMedia(CONSULTA).matches,
    () => false,
  );
}
