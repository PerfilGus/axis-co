import { NavegacaoSuperior } from "@/components/layout/navegacao-superior";
import { NavegacaoInferior } from "@/components/layout/navegacao-inferior";
import { Guarda } from "@/components/layout/guarda";

/**
 * Casca do sistema. Navegação superior em dois níveis no desktop e barra
 * inferior no mobile — nenhuma barra lateral.
 */
export default function LayoutApp({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <NavegacaoSuperior />
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 pt-6 pb-28 md:pb-12 lg:px-6">
        <Guarda>{children}</Guarda>
      </main>
      <NavegacaoInferior />
    </div>
  );
}
