"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Colaborador, Perfil } from "@/lib/types";
import * as permissoes from "@/lib/permissoes";
import { useEquipe } from "./equipe";

/**
 * Sessão do usuário logado.
 *
 * Quem é vem do servidor (`contextoDaSessao`), nunca de escolha na tela. Os
 * atalhos de permissão saem de `lib/permissoes.ts`, a mesma matriz que o
 * servidor aplica em cada ação — aqui servem só para não oferecer o que seria
 * recusado.
 */

interface ContextoSessao {
  perfil: Perfil;
  usuario: Colaborador;
  email: string;
  doisFatores: boolean;
  ehAdmin: boolean;
  podeCriarPedido: boolean;
  podeEditarPedido: boolean;
  podeExcluirPedido: boolean;
  podeAprovarAjuste: boolean;
  podeOperarCobranca: boolean;
  podeConfigurar: boolean;
  podeApagarRastreio: boolean;
  /** Vendedores cujos pedidos este usuário opera; `null` = todos. */
  escopoVendedores: string[] | null;
}

const Contexto = createContext<ContextoSessao | null>(null);

export function SessaoProvider({
  usuario: inicial,
  email,
  doisFatores,
  children,
}: {
  usuario: Colaborador;
  email: string;
  doisFatores: boolean;
  children: ReactNode;
}) {
  const { colaboradores } = useEquipe();

  const valor = useMemo<ContextoSessao>(() => {
    // Lê do estado da equipe: mudar os vendedores atribuídos a um cobrador
    // muda na hora quais pedidos ele enxerga.
    const usuario = colaboradores.find((c) => c.id === inicial.id) ?? inicial;
    return {
      perfil: usuario.perfil,
      usuario,
      email,
      doisFatores,
      ehAdmin: permissoes.ehAdmin(usuario),
      podeCriarPedido: permissoes.podeCriarPedido(usuario),
      podeEditarPedido: permissoes.podeEditarPedido(usuario),
      podeExcluirPedido: permissoes.podeExcluirPedido(usuario),
      podeAprovarAjuste: permissoes.podeAprovarAjuste(usuario),
      podeOperarCobranca: permissoes.podeOperarCobranca(usuario),
      podeConfigurar: permissoes.podeConfigurar(usuario),
      podeApagarRastreio: permissoes.podeApagarRastreio(usuario),
      escopoVendedores: permissoes.escopoVendedores(usuario),
    };
  }, [colaboradores, inicial, email, doisFatores]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSessao() {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("useSessao precisa do SessaoProvider.");
  return ctx;
}
