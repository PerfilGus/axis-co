import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { contextoDaSessao } from "@/lib/servidor/sessao";
import { FormularioEntrar } from "@/components/acesso/formulario-entrar";

export const metadata: Metadata = { title: "Entrar — Axis" };

export default async function PaginaEntrar() {
  const ctx = await contextoDaSessao();
  if (ctx) redirect(ctx.pendencia ? "/primeiro-acesso" : "/");
  return <FormularioEntrar />;
}
