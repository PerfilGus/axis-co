import { redirect } from "next/navigation";
import { GRUPOS_POR_PERFIL } from "@/lib/nav";
import { contextoDaSessao } from "@/lib/servidor/sessao";

/** A raiz leva cada perfil para a primeira tela a que ele tem acesso. */
export default async function Raiz() {
  const ctx = await contextoDaSessao();
  if (!ctx) redirect("/entrar");
  if (ctx.pendencia) redirect("/primeiro-acesso");
  redirect(GRUPOS_POR_PERFIL[ctx.colaborador.perfil][0].href);
}
