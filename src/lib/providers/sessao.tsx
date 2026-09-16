"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Colaborador, Perfil } from "@/lib/types";
import { USUARIO_POR_PERFIL } from "@/lib/mock/equipe";
import { criarPreferencia, usePreferencia } from "@/lib/armazenamento";

/**
 * Sessão simulada.
 *
 * Não há autenticação nesta fase: o perfil vem de um seletor visível apenas em
 * desenvolvimento. Quando o backend entrar, este provider troca a fonte do
 * `usuario` sem que nenhuma tela precise mudar.
 */

const PERFIS: Perfil[] = ["admin", "vendedor", "financeiro"];
const prefPerfil = criarPreferencia<Perfil>("axis.perfil", "admin", PERFIS);

interface ContextoSessao {
  perfil: Perfil;
  usuario: Colaborador;
  definirPerfil: (perfil: Perfil) => void;
  /** Atalhos de permissão, para as telas não repetirem comparações de perfil. */
  ehAdmin: boolean;
  podeCriarPedido: boolean;
  podeEditarPedido: boolean;
  podeExcluirPedido: boolean;
  podeAprovarAjuste: boolean;
  podeOperarCobranca: boolean;
  podeConfigurar: boolean;
  /** Vendedores cujos pedidos este usuário enxerga; `null` = todos. */
  escopoVendedores: string[] | null;
}

const Contexto = createContext<ContextoSessao | null>(null);

export function SessaoProvider({ children }: { children: ReactNode }) {
  const [perfil, definirPerfil] = usePreferencia(prefPerfil);

  const valor = useMemo<ContextoSessao>(() => {
    const usuario = USUARIO_POR_PERFIL[perfil];
    const ehAdmin = perfil === "admin";
    return {
      perfil,
      usuario,
      definirPerfil,
      ehAdmin,
      podeCriarPedido: ehAdmin || perfil === "vendedor",
      podeEditarPedido: ehAdmin,
      podeExcluirPedido: ehAdmin,
      podeAprovarAjuste: ehAdmin,
      podeOperarCobranca: ehAdmin || perfil === "financeiro",
      podeConfigurar: ehAdmin,
      escopoVendedores: ehAdmin
        ? null
        : perfil === "vendedor"
          ? [usuario.id]
          : usuario.vendedoresAtribuidos,
    };
  }, [perfil, definirPerfil]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSessao() {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("useSessao precisa do SessaoProvider.");
  return ctx;
}
