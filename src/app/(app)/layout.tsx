import { redirect } from "next/navigation";
import { NavegacaoSuperior } from "@/components/layout/navegacao-superior";
import { NavegacaoInferior } from "@/components/layout/navegacao-inferior";
import { Guarda } from "@/components/layout/guarda";
import { ProvedoresDados } from "@/components/layout/provedores-dados";
import { RenovarSessao } from "@/components/layout/renovar-sessao";
import { carregarDadosIniciais } from "@/lib/servidor/dados";
import { contextoDaSessao } from "@/lib/servidor/sessao";

/**
 * Casca do sistema. Só renderiza para sessão válida e sem pendência de
 * primeiro acesso; os dados chegam do banco já recortados para o perfil.
 * Navegação superior em dois níveis no desktop e barra inferior no mobile.
 */
export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const ctx = await contextoDaSessao();
  if (!ctx) redirect("/entrar");
  if (ctx.pendencia) redirect("/primeiro-acesso");

  const dados = await carregarDadosIniciais(ctx);

  return (
    <ProvedoresDados dados={dados}>
      <div className="flex min-h-dvh flex-col bg-bg">
        <NavegacaoSuperior />
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 pt-6 pb-28 md:pb-12 lg:px-6">
          <Guarda>{children}</Guarda>
        </main>
        <NavegacaoInferior />
      </div>
      <RenovarSessao />
    </ProvedoresDados>
  );
}
