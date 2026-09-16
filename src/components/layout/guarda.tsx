"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GRUPOS_POR_PERFIL, podeAcessar } from "@/lib/nav";
import { useSessao } from "@/lib/providers/sessao";
import { Botao } from "@/components/ui/button";
import { EstadoVazio } from "@/components/shared/estado-vazio";

/**
 * Barra o acesso direto pela URL a telas fora do perfil.
 *
 * É uma barreira de interface, não de segurança: quando o backend entrar, a
 * mesma decisão passa a ser tomada também no servidor.
 */
export function Guarda({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { perfil } = useSessao();

  if (podeAcessar(perfil, pathname)) return <>{children}</>;

  const inicio = GRUPOS_POR_PERFIL[perfil][0];

  return (
    <div className="pt-10">
      <EstadoVazio
        icone="proibido"
        titulo="Esta tela não faz parte do seu perfil"
        descricao="Peça ao Admin se você precisa de acesso a ela."
        acao={
          <Botao variante="principal" asChild>
            <Link href={inicio.href}>Ir para {inicio.rotulo}</Link>
          </Botao>
        }
      />
    </div>
  );
}
