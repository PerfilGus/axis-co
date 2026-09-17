import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { contextoDaSessao } from "@/lib/servidor/sessao";
import { PrimeiroAcesso } from "@/components/acesso/primeiro-acesso";

export const metadata: Metadata = { title: "Primeiro acesso — Axis" };

export default async function PaginaPrimeiroAcesso() {
  const ctx = await contextoDaSessao();
  if (!ctx) redirect("/entrar");
  if (!ctx.pendencia) redirect("/");
  return (
    <PrimeiroAcesso
      pendencia={ctx.pendencia}
      email={ctx.email}
      ehAdmin={ctx.colaborador.perfil === "admin"}
    />
  );
}
