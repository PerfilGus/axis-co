"use client";

import { useEffect } from "react";
import { authCliente } from "@/lib/auth-cliente";

/**
 * A sessão não expira por inatividade: ao abrir o sistema, a rota de sessão
 * renova o prazo do cookie (no máximo uma vez por dia, pelo `updateAge`).
 */
export function RenovarSessao() {
  useEffect(() => {
    void authCliente.getSession();
  }, []);
  return null;
}
