"use client";

import type { Perfil } from "@/lib/types";
import { useSessao } from "@/lib/providers/sessao";
import { Icone } from "@/components/icone";
import { Botao } from "@/components/ui/button";
import {
  Menu,
  MenuConteudo,
  MenuGatilho,
  MenuItem,
  MenuRotulo,
  MenuSeparador,
} from "@/components/ui/dropdown-menu";

const ROTULOS: Record<Perfil, string> = {
  admin: "Admin",
  vendedor: "Vendedor",
  financeiro: "Financeiro",
};

const RESUMO: Record<Perfil, string> = {
  admin: "Vê tudo e é o único que edita, exclui e aprova ajustes.",
  vendedor: "Cria pedidos e vê só os próprios. Nunca edita nem exclui.",
  financeiro: "Opera a cobrança dos vendedores atribuídos a ele.",
};

/**
 * Seletor de perfil.
 *
 * Existe só em desenvolvimento, para testar as permissões sem autenticação.
 * Em produção este componente não renderiza nada — quando o backend entrar, o
 * perfil virá da sessão real.
 */
export function SeletorPerfil() {
  const { perfil, definirPerfil, usuario } = useSessao();

  if (process.env.NODE_ENV === "production") return null;

  return (
    <Menu>
      <MenuGatilho asChild>
        <Botao
          variante="contorno"
          tamanho="sm"
          className="gap-2 border-dashed"
          title="Seletor de perfil, disponível apenas em desenvolvimento"
        >
          <span
            className="size-1.5 rounded-full bg-[var(--accent)]"
            aria-hidden
          />
          {ROTULOS[perfil]}
          <Icone nome="abrir" size={12} />
        </Botao>
      </MenuGatilho>
      <MenuConteudo className="min-w-72">
        <MenuRotulo>Perfil simulado (desenvolvimento)</MenuRotulo>
        {(Object.keys(ROTULOS) as Perfil[]).map((chave) => (
          <MenuItem
            key={chave}
            onSelect={() => definirPerfil(chave)}
            className="flex-col items-start gap-0.5 rounded-[var(--radius-input)] py-2"
          >
            <span className="flex w-full items-center gap-2">
              <span className="font-medium">{ROTULOS[chave]}</span>
              {chave === perfil && (
                <Icone
                  nome="check"
                  size={13}
                  className="ml-auto text-[var(--accent)]"
                />
              )}
            </span>
            <span className="text-[11px] leading-tight text-muted-fg">
              {RESUMO[chave]}
            </span>
          </MenuItem>
        ))}
        <MenuSeparador />
        <div className="px-3 pb-1 text-[11px] text-muted-fg">
          Sessão como {usuario.nome}.
        </div>
      </MenuConteudo>
    </Menu>
  );
}
