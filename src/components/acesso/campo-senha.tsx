"use client";

import { useState } from "react";
import { Icone } from "@/components/icone";
import { Input } from "@/components/ui/input";

/** Senha com botão de mostrar, para digitar certo no celular. */
export function CampoSenha({
  valor,
  aoMudar,
  autoComplete,
  autoFocus,
}: {
  valor: string;
  aoMudar: (valor: string) => void;
  autoComplete: "current-password" | "new-password";
  autoFocus?: boolean;
}) {
  const [visivel, setVisivel] = useState(false);
  return (
    <div className="relative">
      <Input
        type={visivel ? "text" : "password"}
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className="pr-12"
      />
      <button
        type="button"
        onClick={() => setVisivel((v) => !v)}
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted-fg hover:text-fg"
        aria-label={visivel ? "Esconder senha" : "Mostrar senha"}
      >
        <Icone nome={visivel ? "ocultar" : "ver"} size={18} />
      </button>
    </div>
  );
}
