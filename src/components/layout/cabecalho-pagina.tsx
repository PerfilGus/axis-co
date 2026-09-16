"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { grupoDaRota } from "@/lib/nav";
import { contadores } from "@/lib/contadores";
import { usePedidos } from "@/lib/providers/pedidos";
import { useSessao } from "@/lib/providers/sessao";
import { Icone } from "@/components/icone";
import { Botao } from "@/components/ui/button";
import { Contador } from "@/components/ui/badge";

/**
 * Subabas do grupo atual, em controle segmentado de pílula, com contador em
 * badge quando fizer sentido. Não aparece quando o grupo tem uma tela só.
 */
export function SubAbas({ className }: { className?: string }) {
  const pathname = usePathname();
  const { perfil, escopoVendedores } = useSessao();
  const grupo = grupoDaRota(perfil, pathname);
  const { pedidos } = usePedidos();
  const numeros = contadores(pedidos, escopoVendedores);

  if (!grupo || grupo.itens.length < 2) return null;

  return (
    <nav
      aria-label={`Telas de ${grupo.rotulo}`}
      className={cn(
        "scrollbar-none -mx-4 overflow-x-auto px-4 lg:-mx-6 lg:px-6",
        className,
      )}
    >
      <div className="inline-flex items-center gap-1 rounded-full bg-surface-2 p-1">
        {grupo.itens.map((item) => {
          const ativo = pathname.startsWith(item.href);
          const valor = item.contador ? numeros[item.contador] : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={ativo ? "page" : undefined}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-4 text-[13px] font-medium whitespace-nowrap transition-colors",
                ativo
                  ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                  : "text-muted-fg hover:bg-surface-3 hover:text-fg",
              )}
            >
              <Icone nome={item.icone} size={15} />
              {item.rotulo}
              {item.contador && valor > 0 && (
                <Contador valor={valor} ativo={ativo} />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/**
 * Cabeçalho de página: botão circular de voltar, título grande, descrição de
 * uma linha. À direita, filtros em botão circular e a ação principal em
 * pílula com a cor de destaque.
 */
export function CabecalhoPagina({
  titulo,
  descricao,
  acao,
  aoFiltrar,
  filtrosAtivos = 0,
  voltar = true,
  comSubAbas = true,
  extras,
}: {
  titulo: string;
  descricao: string;
  acao?: ReactNode;
  aoFiltrar?: () => void;
  filtrosAtivos?: number;
  voltar?: boolean | string;
  comSubAbas?: boolean;
  extras?: ReactNode;
}) {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-5">
      {comSubAbas && <SubAbas />}

      <div className="flex flex-wrap items-start gap-4">
        {voltar && (
          typeof voltar === "string" ? (
            <Botao variante="secundaria" tamanho="icone" asChild aria-label="Voltar">
              <Link href={voltar}>
                <Icone nome="voltar" />
              </Link>
            </Botao>
          ) : (
            <Botao
              variante="secundaria"
              tamanho="icone"
              aria-label="Voltar"
              onClick={() => router.back()}
            >
              <Icone nome="voltar" />
            </Botao>
          )
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="truncate text-[26px] leading-tight font-medium tracking-tight sm:text-[30px]">
            {titulo}
          </h1>
          <p className="text-[13px] text-muted-fg">{descricao}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {extras}
          {aoFiltrar && (
            <Botao
              variante="secundaria"
              tamanho="icone"
              aria-label="Filtros"
              onClick={aoFiltrar}
              className="relative"
            >
              <Icone nome="filtros" />
              {filtrosAtivos > 0 && (
                <span
                  className="absolute top-2 right-2 size-2 rounded-full ring-2 ring-surface-2"
                  style={{ backgroundColor: "var(--accent)" }}
                  aria-hidden
                />
              )}
            </Botao>
          )}
          {acao}
        </div>
      </div>
    </div>
  );
}
