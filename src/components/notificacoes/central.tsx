"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AjusteValor, Pedido } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatBRL, formatData } from "@/lib/format";
import { diaDe, hoje, somarDias } from "@/lib/periodos";
import { estiloDoTom } from "@/lib/status";
import { pendenciasDe } from "@/lib/contadores";
import {
  DEFINICAO_NOTIFICACAO,
  hrefDaNotificacao,
  ROTULO_CATEGORIA,
  ROTULO_PAPEL,
  tiposDoPerfil,
  tituloDaNotificacao,
  type CategoriaNotificacao,
  type Notificacao,
} from "@/lib/notificacoes";
import { useNotificacoes } from "@/lib/providers/notificacoes";
import { usePedidos } from "@/lib/providers/pedidos";
import { useSessao } from "@/lib/providers/sessao";
import { useEquipe } from "@/lib/providers/equipe";
import { Icone } from "@/components/icone";
import { Botao } from "@/components/ui/button";
import {
  Gaveta,
  GavetaCabecalho,
  GavetaConteudo,
  GavetaCorpo,
  GavetaRodape,
} from "@/components/ui/drawer";
import { ControleSegmentado } from "@/components/shared/controles";
import { EstadoVazio } from "@/components/shared/estado-vazio";
import { useDecidirSolicitacao } from "@/components/pedido/fila-solicitacoes";
import { useParametroUrl } from "@/lib/url";

/**
 * Central de notificações: o sino. Uma gaveta só para o app inteiro — painel
 * lateral no desktop, folha inferior no celular. Os botões só chamam `abrir`.
 */

const Contexto = createContext<{ abrir: () => void } | null>(null);

export function ProvedorCentral({ children }: { children: ReactNode }) {
  const [abertaNaTela, setAbertaNaTela] = useState(false);
  const valor = useMemo(() => ({ abrir: () => setAbertaNaTela(true) }), []);

  // Push de várias notificações de uma vez chega com `?notificacoes=1`.
  const [pelaUrl, definirUrl] = useParametroUrl("notificacoes");
  const aberta = abertaNaTela || pelaUrl !== null;
  const fechar = () => {
    setAbertaNaTela(false);
    if (pelaUrl !== null) definirUrl(null);
  };

  return (
    <Contexto.Provider value={valor}>
      {children}
      <Gaveta open={aberta} onOpenChange={(v) => (v ? setAbertaNaTela(true) : fechar())}>
        {aberta && <PainelNotificacoes aoFechar={fechar} />}
      </Gaveta>
    </Contexto.Provider>
  );
}

function useCentral() {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("useCentral precisa do ProvedorCentral.");
  return ctx;
}

/** O sino, com o ponto de não lidas. `pilula` é o botão do topo da Minha área. */
export function BotaoNotificacoes({ estilo = "botao" }: { estilo?: "botao" | "pilula" }) {
  const { abrir } = useCentral();
  const { naoLidas } = useNotificacoes();
  const rotulo = `Notificações${naoLidas ? `, ${naoLidas} não ${naoLidas === 1 ? "lida" : "lidas"}` : ""}`;
  return (
    <button
      type="button"
      onClick={abrir}
      aria-label={rotulo}
      className={cn(
        "relative flex size-10 shrink-0 items-center justify-center rounded-full text-fg transition-colors",
        estilo === "botao" ? "bg-surface-2 hover:bg-surface-3" : "hover:bg-surface-3",
      )}
    >
      <Icone nome="notificacoes" />
      {naoLidas > 0 && (
        <span
          className="tabular absolute -top-0.5 -right-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1 text-[10px] font-medium ring-2 ring-bg"
          style={{ backgroundColor: "var(--accent)", color: "var(--accent-fg)" }}
          aria-hidden
        >
          {naoLidas > 99 ? "99+" : naoLidas}
        </span>
      )}
    </button>
  );
}

type Filtro = "todas" | "nao_lidas" | CategoriaNotificacao;

const TIPOS_SOLICITACAO = new Set(["solicitacao_ajuste", "solicitacao_alteracao", "solicitacao_exclusao"]);

/** A solicitação ainda pendente que a notificação anunciou. */
function ajusteDaNotificacao(n: Notificacao, pedido: Pedido | undefined): AjusteValor | null {
  if (!pedido || !TIPOS_SOLICITACAO.has(n.tipo)) return null;
  const pendentes = pedido.ajustes.filter((a) => a.status === "pendente");
  const doMomento = pendentes.find((a) => new Date(a.solicitadoEm).getTime() === new Date(n.ocorridoEm).getTime());
  return doMomento ?? (pendentes.length === 1 ? pendentes[0] : null);
}

function rotuloDoDia(dia: string): string {
  const hojeDia = hoje();
  if (dia === hojeDia) return "Hoje";
  if (dia === somarDias(hojeDia, -1)) return "Ontem";
  return formatData(`${dia}T12:00:00-03:00`);
}

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

function PainelNotificacoes({ aoFechar }: { aoFechar: () => void }) {
  const router = useRouter();
  const { perfil, usuario, escopoVendedores, podeAprovarAjuste } = useSessao();
  const { pedidos } = usePedidos();
  const { niveis, bonusNivel } = useEquipe();
  const { itens, naoLidas, marcarLidas, marcarTodas } = useNotificacoes();
  const [filtro, setFiltro] = useState<Filtro>("todas");

  const pendencias = pendenciasDe(usuario, pedidos, escopoVendedores, { niveis, bonusNivel });

  // Só as categorias que o perfil pode receber, na ordem do catálogo.
  const categorias = [...new Set(tiposDoPerfil(perfil).map((d) => d.categoria))];
  const visiveis = itens.filter((n) =>
    filtro === "todas" ? true : filtro === "nao_lidas" ? !n.lida : DEFINICAO_NOTIFICACAO[n.tipo].categoria === filtro,
  );

  const porDia: Array<{ dia: string; lista: Notificacao[] }> = [];
  for (const n of visiveis) {
    const dia = diaDe(n.registradoEm);
    const grupo = porDia.at(-1);
    if (grupo?.dia === dia) grupo.lista.push(n);
    else porDia.push({ dia, lista: [n] });
  }

  function abrir(n: Notificacao) {
    if (!n.lida) marcarLidas([n.id]);
    const href = hrefDaNotificacao(n, perfil);
    if (!href) return;
    aoFechar();
    router.push(href);
  }

  return (
    <GavetaConteudo larguraMaxima="sm:max-w-md">
      <GavetaCabecalho
        titulo="Notificações"
        descricao={naoLidas > 0 ? `${naoLidas} não ${naoLidas === 1 ? "lida" : "lidas"}` : "Tudo lido"}
        acoes={
          naoLidas > 0 ? (
            <Botao variante="fantasma" tamanho="sm" onClick={() => void marcarTodas()}>
              <Icone nome="check" />
              <span className="hidden sm:inline">Marcar todas</span>
              <span className="sm:hidden">Todas</span>
            </Botao>
          ) : undefined
        }
      />

      <div className="shrink-0 border-b border-border px-5 py-3">
        <ControleSegmentado<Filtro>
          tamanho="sm"
          valor={filtro}
          aoMudar={setFiltro}
          opcoes={[
            { valor: "todas", rotulo: "Todas" },
            { valor: "nao_lidas", rotulo: "Não lidas", contador: naoLidas },
            ...categorias.map((c) => ({ valor: c, rotulo: ROTULO_CATEGORIA[c] })),
          ]}
        />
      </div>

      <GavetaCorpo className="flex flex-col gap-4">
        {filtro === "todas" && pendencias.length > 0 && (
          <section aria-label="Esperando você" className="flex flex-col gap-1.5">
            <h3 className="text-[12px] font-medium text-muted-fg">Esperando você</h3>
            {pendencias.map((p) => {
              const conteudo = (
                <>
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
                    <Icone nome={p.icone} size={16} />
                  </span>
                  <span className="min-w-0 flex-1 text-sm">{p.texto}</span>
                  {p.href && <Icone nome="avancar" size={14} className="shrink-0 text-muted-fg" />}
                </>
              );
              const classe = "flex items-center gap-3 rounded-[14px] bg-surface-2 px-3 py-2.5";
              return p.href ? (
                <Link key={p.chave} href={p.href} onClick={aoFechar} className={cn(classe, "hover:bg-surface-3")}>
                  {conteudo}
                </Link>
              ) : (
                <div key={p.chave} className={classe}>
                  {conteudo}
                </div>
              );
            })}
          </section>
        )}

        {visiveis.length === 0 ? (
          <EstadoVazio
            compacto
            icone="notificacoes"
            titulo={filtro === "nao_lidas" ? "Nada por ler" : "Nenhuma notificação"}
            descricao={
              filtro === "todas"
                ? "Quando alguém mexer em algo que é seu, o aviso aparece aqui."
                : "Nada deste tipo nos últimos 60 dias."
            }
          />
        ) : (
          porDia.map(({ dia, lista }) => (
            <section key={dia} aria-label={rotuloDoDia(dia)} className="flex flex-col gap-1">
              <h3 className="text-[12px] font-medium text-muted-fg">{rotuloDoDia(dia)}</h3>
              <ul className="flex flex-col gap-1">
                {lista.map((n) => (
                  <ItemNotificacao
                    key={n.id}
                    notificacao={n}
                    pedido={n.pedidoId ? pedidos.find((p) => p.id === n.pedidoId) : undefined}
                    podeDecidir={podeAprovarAjuste}
                    aoAbrir={() => abrir(n)}
                    aoDecidir={() => !n.lida && marcarLidas([n.id])}
                  />
                ))}
              </ul>
            </section>
          ))
        )}
      </GavetaCorpo>

      <GavetaRodape className="justify-between pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-5">
        <span className="text-[11px] text-muted-fg">Últimos 60 dias</span>
        <Botao variante="secundaria" tamanho="sm" asChild>
          <Link href="/configuracoes/notificacoes" onClick={aoFechar}>
            <Icone nome="configuracoes" />
            Preferências
          </Link>
        </Botao>
      </GavetaRodape>
    </GavetaConteudo>
  );
}

function ItemNotificacao({
  notificacao: n,
  pedido,
  podeDecidir,
  aoAbrir,
  aoDecidir,
}: {
  notificacao: Notificacao;
  pedido: Pedido | undefined;
  podeDecidir: boolean;
  aoAbrir: () => void;
  aoDecidir: () => void;
}) {
  const { nomeDe } = useEquipe();
  const decidirSolicitacao = useDecidirSolicitacao();
  const [decidindo, setDecidindo] = useState(false);
  const def = DEFINICAO_NOTIFICACAO[n.tipo];
  const tom = estiloDoTom(def.tom);
  const ajuste = podeDecidir ? ajusteDaNotificacao(n, pedido) : null;

  const detalhe = [
    n.cliente,
    typeof n.valor === "number" && n.valor > 0 ? formatBRL(n.valor) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const autor = n.autorId ? `${nomeDe(n.autorId)}${n.papel ? ` · ${ROTULO_PAPEL[n.papel]}` : ""}` : "Sistema";

  async function decidir(decisao: "aprovado" | "recusado") {
    if (!pedido || !ajuste) return;
    setDecidindo(true);
    const ok = await decidirSolicitacao(pedido, ajuste, decisao, null);
    setDecidindo(false);
    if (ok) aoDecidir();
  }

  return (
    <li
      className={cn(
        "flex flex-col gap-2 rounded-[14px] transition-colors",
        !n.lida && "bg-surface-2",
      )}
    >
      <button type="button" onClick={aoAbrir} className="flex w-full items-start gap-3 rounded-[14px] px-3 py-2.5 text-left hover:bg-surface-3">
        <span
          className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full"
          style={{ color: tom.cor, backgroundColor: tom.fundo }}
        >
          <Icone nome={def.icone} size={16} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={cn("text-sm leading-snug", !n.lida && "font-medium")}>{tituloDaNotificacao(n)}</span>
          {detalhe && <span className="truncate text-[12px] text-muted-fg">{detalhe}</span>}
          {n.descricao && TIPOS_SOLICITACAO.has(n.tipo) && (
            <span className="line-clamp-2 text-[12px] text-fg/80">{n.descricao}</span>
          )}
          <span className="text-[11px] text-muted-fg">
            por {autor} · {hora(n.ocorridoEm)}
            {diaDe(n.ocorridoEm) !== diaDe(n.registradoEm) && ` de ${formatData(n.ocorridoEm)}`}
          </span>
        </span>
        {!n.lida && (
          <span className="mt-2 size-2 shrink-0 rounded-full" style={{ backgroundColor: "var(--accent)" }} aria-label="Não lida" />
        )}
      </button>

      {ajuste && (
        <div className="flex gap-2 px-3 pb-3 pl-15">
          <Botao variante="principal" tamanho="sm" disabled={decidindo} onClick={() => void decidir("aprovado")}>
            <Icone nome="check" />
            Aprovar
          </Botao>
          <Botao variante="secundaria" tamanho="sm" disabled={decidindo} onClick={() => void decidir("recusado")}>
            <Icone nome="fechar" />
            Recusar
          </Botao>
        </div>
      )}
    </li>
  );
}
