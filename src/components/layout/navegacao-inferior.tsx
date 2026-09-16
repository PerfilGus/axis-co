"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { grupoDaRota, itensMobile } from "@/lib/nav";
import { useSessao } from "@/lib/providers/sessao";
import { Icone } from "@/components/icone";

/**
 * No mobile a navegação vai para a barra inferior: ícone + rótulo, com o item
 * ativo na cor de destaque e uma barra curta acima do ícone.
 */
export function NavegacaoInferior() {
  const pathname = usePathname();
  const { perfil } = useSessao();
  const itens = itensMobile(perfil);
  const grupoAtivo = grupoDaRota(perfil, pathname);

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg/95 backdrop-blur-md md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex items-stretch">
        {itens.map((item) => {
          const ativo = grupoAtivo?.id === item.id;
          return (
            <li key={item.id} className="flex-1">
              <Link
                href={item.href}
                aria-current={ativo ? "page" : undefined}
                className="flex flex-col items-center gap-1 pt-2 pb-2.5"
              >
                <span
                  className={cn(
                    "h-0.5 w-6 rounded-full transition-colors",
                    ativo ? "bg-[var(--accent)]" : "bg-transparent",
                  )}
                  aria-hidden
                />
                <Icone
                  nome={item.icone}
                  size={20}
                  className={cn(
                    "transition-colors",
                    ativo ? "text-[var(--accent)]" : "text-muted-fg",
                  )}
                />
                <span
                  className={cn(
                    "text-[10px] leading-none",
                    ativo ? "text-[var(--accent)]" : "text-muted-fg",
                  )}
                >
                  {item.rotulo}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
