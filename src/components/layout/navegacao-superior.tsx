"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { GRUPOS_POR_PERFIL, grupoDaRota, GRUPO_CONFIG, CONFIG_POR_PERFIL } from "@/lib/nav";
import { totalNotificacoes } from "@/lib/contadores";
import { usePedidos } from "@/lib/providers/pedidos";
import { useSessao } from "@/lib/providers/sessao";
import { useAparencia } from "@/lib/providers/aparencia";
import { Icone } from "@/components/icone";
import { Botao } from "@/components/ui/button";
import { AvatarAnel } from "@/components/shared/avatar-anel";
import {
  Menu,
  MenuConteudo,
  MenuGatilho,
  MenuItem,
  MenuRotulo,
  MenuSeparador,
} from "@/components/ui/dropdown-menu";
import { Logo } from "./logo";
import { SeletorPerfil } from "./seletor-perfil";
import { NIVEL_POR_ID, NIVEIS } from "@/lib/mock/equipe";

/**
 * Navegação superior em dois níveis. Não existe barra lateral em tela nenhuma:
 * a barra de grupos fica centralizada numa pílula escura e as subabas do grupo
 * aparecem no cabeçalho da página.
 */
export function NavegacaoSuperior() {
  const pathname = usePathname();
  const { perfil, usuario, ehAdmin, escopoVendedores } = useSessao();
  const { tema, alternarTema } = useAparencia();
  const { pedidos } = usePedidos();

  const grupos = GRUPOS_POR_PERFIL[perfil];
  const grupoAtivo = grupoDaRota(perfil, pathname);
  const naConfig = pathname.startsWith("/configuracoes");
  const notificacoes = totalNotificacoes(pedidos, escopoVendedores, ehAdmin);

  const nivel = NIVEL_POR_ID.get(usuario.nivelId);
  const proximo = NIVEIS.find((n) => n.ordem === (nivel?.ordem ?? 0) + 1);
  const progressoNivel = proximo
    ? Math.min(
        (usuario.pontos - (nivel?.pontosNecessarios ?? 0)) /
          (proximo.pontosNecessarios - (nivel?.pontosNecessarios ?? 0)),
        1,
      )
    : 1;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 lg:px-6">
        <Logo href={grupos[0].href} />

        <nav
          aria-label="Grupos"
          className="scrollbar-none mx-auto hidden max-w-full overflow-x-auto md:block"
        >
          <div className="inline-flex items-center gap-1 rounded-full bg-surface-2 p-1">
            {grupos.map((grupo) => {
              const ativo = !naConfig && grupoAtivo?.id === grupo.id;
              return (
                <Link
                  key={grupo.id}
                  href={grupo.href}
                  aria-current={ativo ? "page" : undefined}
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-4 text-[13px] font-medium whitespace-nowrap transition-colors",
                    ativo
                      ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                      : "text-muted-fg hover:bg-surface-3 hover:text-fg",
                  )}
                >
                  <Icone nome={grupo.icone} size={15} />
                  {grupo.rotulo}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <SeletorPerfil />

          <Botao
            variante="secundaria"
            tamanho="icone"
            aria-label="Buscar"
            className="hidden sm:inline-flex"
          >
            <Icone nome="busca" />
          </Botao>

          <Botao
            variante="secundaria"
            tamanho="icone"
            aria-label={`Notificações${notificacoes ? `, ${notificacoes} pendentes` : ""}`}
            className="relative"
          >
            <Icone nome="notificacoes" />
            {notificacoes > 0 && (
              <span
                className="absolute top-2 right-2 size-2 rounded-full ring-2 ring-surface-2"
                style={{ backgroundColor: "var(--accent)" }}
                aria-hidden
              />
            )}
          </Botao>

          <Link
            href={CONFIG_POR_PERFIL[perfil][0].href}
            aria-label="Configurações"
            aria-current={naConfig ? "page" : undefined}
            className={cn(
              "hidden size-10 items-center justify-center rounded-full transition-colors sm:inline-flex",
              naConfig
                ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                : "bg-surface-2 text-fg hover:bg-surface-3",
            )}
            title={GRUPO_CONFIG.rotulo}
          >
            <Icone nome="configuracoes" />
          </Link>

          <Menu>
            <MenuGatilho asChild>
              <button
                className="rounded-full outline-none"
                aria-label={`Conta de ${usuario.nome}`}
              >
                <AvatarAnel
                  nome={usuario.nome}
                  progresso={progressoNivel}
                  tamanho={40}
                />
              </button>
            </MenuGatilho>
            <MenuConteudo>
              <MenuRotulo>
                {usuario.nome} · {nivel?.nome ?? "Bronze"}
              </MenuRotulo>
              <MenuItem asChild>
                <Link href="/minha-area">
                  <Icone nome="minhaArea" size={15} />
                  Minha área
                </Link>
              </MenuItem>
              <MenuItem onSelect={alternarTema}>
                <Icone nome={tema === "escuro" ? "sol" : "lua"} size={15} />
                Tema {tema === "escuro" ? "claro" : "escuro"}
              </MenuItem>
              <MenuItem asChild>
                <Link href="/configuracoes/aparencia">
                  <Icone nome="aparencia" size={15} />
                  Aparência
                </Link>
              </MenuItem>
              <MenuSeparador />
              <MenuItem disabled>
                <Icone nome="sair" size={15} />
                Sair
              </MenuItem>
            </MenuConteudo>
          </Menu>
        </div>
      </div>
    </header>
  );
}
