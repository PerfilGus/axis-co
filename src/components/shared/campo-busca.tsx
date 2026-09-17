"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Icone } from "@/components/icone";
import { Input } from "@/components/ui/input";

/**
 * Campo de busca do sistema, com debounce.
 *
 * O texto aparece na hora; `aoMudar` só é chamado quando a digitação para por
 * `atraso` ms (ou na hora, ao limpar). Se a tela zerar `valor` por fora — um
 * "Limpar filtros" —, o campo acompanha.
 */
export function CampoBusca({
  valor,
  aoMudar,
  placeholder = "Buscar",
  atraso = 250,
  className,
}: {
  valor: string;
  aoMudar: (termo: string) => void;
  placeholder?: string;
  atraso?: number;
  className?: string;
}) {
  const [texto, setTexto] = useState(valor);
  const [externo, setExterno] = useState(valor);
  // O último termo entregue a `aoMudar`.
  const [emitido, setEmitido] = useState(valor);

  // Mudança vinda de fora (não é o eco do que este campo emitiu).
  if (valor !== externo) {
    setExterno(valor);
    if (valor !== emitido) {
      setTexto(valor);
      setEmitido(valor);
    }
  }

  const aoMudarRef = useRef(aoMudar);
  useEffect(() => {
    aoMudarRef.current = aoMudar;
  });

  useEffect(() => {
    if (texto === emitido) return;
    const id = window.setTimeout(() => {
      setEmitido(texto);
      aoMudarRef.current(texto);
    }, atraso);
    return () => window.clearTimeout(id);
  }, [texto, emitido, atraso]);

  function limpar() {
    setTexto("");
    setEmitido("");
    aoMudarRef.current("");
  }

  return (
    <div className={cn("relative min-w-52 flex-1 sm:max-w-72", className)}>
      <Icone
        nome="busca"
        size={15}
        className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted-fg"
      />
      <Input
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        enterKeyHint="search"
        autoComplete="off"
        className={cn("rounded-full pl-9", texto && "pr-9")}
      />
      {texto && (
        <button
          type="button"
          onClick={limpar}
          aria-label="Limpar busca"
          className="absolute top-1/2 right-1.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-fg transition-colors hover:bg-surface-3 hover:text-fg"
        >
          <Icone nome="fechar" size={13} />
        </button>
      )}
    </div>
  );
}
