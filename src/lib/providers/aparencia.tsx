"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { criarPreferencia, usePreferencia } from "@/lib/armazenamento";

export type Tema = "claro" | "escuro";

export type Destaque =
  | "amarelo"
  | "laranja"
  | "coral"
  | "rosa"
  | "roxo"
  | "azul"
  | "turquesa"
  | "verde";

export interface OpcaoDestaque {
  chave: Destaque;
  rotulo: string;
  cor: string;
}

/** Oito opções. Amarelo é o padrão da identidade. */
export const DESTAQUES: OpcaoDestaque[] = [
  { chave: "amarelo", rotulo: "Amarelo", cor: "#ffbe00" },
  { chave: "laranja", rotulo: "Laranja", cor: "#ff8a3d" },
  { chave: "coral", rotulo: "Coral", cor: "#ff7a66" },
  { chave: "rosa", rotulo: "Rosa", cor: "#ff8fb1" },
  { chave: "roxo", rotulo: "Roxo", cor: "#b08cff" },
  { chave: "azul", rotulo: "Azul", cor: "#6fa8ff" },
  { chave: "turquesa", rotulo: "Turquesa", cor: "#4fd6c8" },
  { chave: "verde", rotulo: "Verde", cor: "#6ee787" },
];

export const CHAVE_TEMA = "axis.tema";
export const CHAVE_DESTAQUE = "axis.destaque";

const TEMAS: Tema[] = ["claro", "escuro"];
const CHAVES_DESTAQUE = DESTAQUES.map((d) => d.chave);

const prefTema = criarPreferencia<Tema>(CHAVE_TEMA, "escuro", TEMAS);
const prefDestaque = criarPreferencia<Destaque>(
  CHAVE_DESTAQUE,
  "amarelo",
  CHAVES_DESTAQUE,
);

interface ContextoAparencia {
  tema: Tema;
  destaque: Destaque;
  definirTema: (tema: Tema) => void;
  definirDestaque: (destaque: Destaque) => void;
  alternarTema: () => void;
}

const Contexto = createContext<ContextoAparencia | null>(null);

/**
 * Roda antes da primeira pintura para que o tema salvo já esteja aplicado —
 * sem piscar e sem divergência de hidratação.
 */
export const SCRIPT_APARENCIA = `(function(){try{
var t=localStorage.getItem("${CHAVE_TEMA}")||"escuro";
var d=localStorage.getItem("${CHAVE_DESTAQUE}")||"amarelo";
var e=document.documentElement;
e.setAttribute("data-theme",t==="claro"?"light":"dark");
e.setAttribute("data-accent",d);
}catch(_){}})();`;

export function AparenciaProvider({ children }: { children: ReactNode }) {
  const [tema, definirTema] = usePreferencia(prefTema);
  const [destaque, definirDestaque] = usePreferencia(prefDestaque);

  // Espelha a preferência no documento — inclusive quando outra aba a muda.
  useEffect(() => {
    document.documentElement.setAttribute(
      "data-theme",
      tema === "claro" ? "light" : "dark",
    );
  }, [tema]);

  useEffect(() => {
    document.documentElement.setAttribute("data-accent", destaque);
  }, [destaque]);

  const alternarTema = useCallback(() => {
    definirTema(tema === "claro" ? "escuro" : "claro");
  }, [tema, definirTema]);

  const valor = useMemo(
    () => ({ tema, destaque, definirTema, definirDestaque, alternarTema }),
    [tema, destaque, definirTema, definirDestaque, alternarTema],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useAparencia() {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("useAparencia precisa do AparenciaProvider.");
  return ctx;
}
