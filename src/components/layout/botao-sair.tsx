"use client";

import { useState } from "react";
import { authCliente } from "@/lib/auth-cliente";
import { Icone } from "@/components/icone";
import { Botao } from "@/components/ui/button";
import { MenuItem } from "@/components/ui/dropdown-menu";

/**
 * Encerra a sessão deste aparelho. A sessão não expira sozinha: sair é
 * sempre uma ação de quem usa.
 */
export function BotaoSair({ comoItemDeMenu = false }: { comoItemDeMenu?: boolean }) {
  const [saindo, setSaindo] = useState(false);

  async function sair() {
    setSaindo(true);
    await authCliente.signOut();
    // Recarrega do zero: nenhum dado da sessão anterior fica na memória.
    window.location.replace("/entrar");
  }

  if (comoItemDeMenu) {
    return (
      <MenuItem onSelect={sair} disabled={saindo}>
        <Icone nome="sair" size={15} />
        Sair
      </MenuItem>
    );
  }
  return (
    <Botao variante="secundaria" onClick={sair} disabled={saindo}>
      <Icone nome="sair" size={15} />
      Sair
    </Botao>
  );
}
