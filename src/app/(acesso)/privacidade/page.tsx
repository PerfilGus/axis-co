import type { Metadata } from "next";
import Link from "next/link";
import { AvisoRascunho, PoliticaPrivacidade } from "@/components/lgpd/textos";

export const metadata: Metadata = { title: "Política de privacidade — Axis" };

/** Pública: precisa abrir antes do login e para quem não tem conta. */
export default function PaginaPrivacidade() {
  return (
    <article className="flex flex-col gap-6 pb-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-medium tracking-tight">Política de privacidade</h1>
        <p className="text-sm text-muted-fg">Última atualização: [DATA DA VERSÃO FINAL]</p>
      </div>
      <AvisoRascunho />
      <PoliticaPrivacidade />
      <Link href="/" className="text-[13px] text-muted-fg underline underline-offset-2 hover:text-fg">
        Voltar ao sistema
      </Link>
    </article>
  );
}
