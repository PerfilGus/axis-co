"use client";

import type { ReactNode } from "react";
import { CabecalhoPagina } from "./cabecalho-pagina";
import { EmConstrucao } from "@/components/shared/estado-vazio";

/**
 * Tela ainda sem conteúdo próprio: cabeçalho de página e estado vazio.
 * Cada uma ganha a sua construção numa fase seguinte.
 */
export function PaginaSimples({
  titulo,
  descricao,
  vazioTitulo,
  vazioDescricao,
  fase,
  acao,
  children,
}: {
  titulo: string;
  descricao: string;
  vazioTitulo: string;
  vazioDescricao: string;
  fase?: string;
  acao?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina titulo={titulo} descricao={descricao} acao={acao} />
      {children ?? (
        <EmConstrucao titulo={vazioTitulo} descricao={vazioDescricao} fase={fase} />
      )}
    </div>
  );
}
