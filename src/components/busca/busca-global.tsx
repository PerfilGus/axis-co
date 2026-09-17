"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent as EventoTeclado,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { ID } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  buscarGlobal,
  LIMITE_POR_GRUPO,
  MINIMO_CARACTERES,
  MINIMO_DIGITOS_DOCUMENTO,
  normalizar,
  ORDEM_GRUPOS,
  ROTULO_GRUPO_BUSCA,
  type GrupoBusca,
  type ResultadoBusca,
} from "@/lib/busca";
import { podeOperarRastreio, podeVerFinanceiro } from "@/lib/permissoes";
import { useSessao } from "@/lib/providers/sessao";
import { usePedidos } from "@/lib/providers/pedidos";
import { useEquipe } from "@/lib/providers/equipe";
import { useFinanceiro } from "@/lib/providers/financeiro";
import { Icone } from "@/components/icone";
import { Botao } from "@/components/ui/button";
import { CampoBusca } from "@/components/shared/campo-busca";
import { EstadoVazio } from "@/components/shared/estado-vazio";

/**
 * Busca global: a lupa da barra superior e o atalho Cmd/Ctrl+K. Um único
 * diálogo para o app inteiro — no desktop, centralizado; no celular, tela
 * cheia. Os botões só chamam `abrir`.
 */

const Contexto = createContext<{ abrir: () => void } | null>(null);

export function ProvedorBusca({ children }: { children: ReactNode }) {
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAberto((atual) => !atual);
      }
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

  const valor = useMemo(() => ({ abrir: () => setAberto(true) }), []);

  return (
    <Contexto.Provider value={valor}>
      {children}
      <DialogPrimitive.Root open={aberto} onOpenChange={setAberto}>
        {/* Montado só aberto: cada busca começa do zero. */}
        {aberto && <PainelBusca aoFechar={() => setAberto(false)} />}
      </DialogPrimitive.Root>
    </Contexto.Provider>
  );
}

export function useBusca() {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("useBusca precisa do ProvedorBusca.");
  return ctx;
}

/** A lupa. Mesma aparência dos outros botões redondos de onde ela aparece. */
export function BotaoBusca({ className }: { className?: string }) {
  const { abrir } = useBusca();
  return (
    <Botao variante="secundaria" tamanho="icone" aria-label="Buscar" onClick={abrir} className={className}>
      <Icone nome="busca" />
    </Botao>
  );
}

const SEM_IDS: ReadonlySet<ID> = new Set();

function PainelBusca({ aoFechar }: { aoFechar: () => void }) {
  const router = useRouter();
  const { perfil, usuario, escopoVendedores } = useSessao();
  const { pedidos, buscarPorDocumento } = usePedidos();
  const { nomeDe } = useEquipe();
  const { parametros, pagamentosFornecedor, faturas } = useFinanceiro();

  const [termo, setTermo] = useState("");
  const [porDocumento, setPorDocumento] = useState<{ termo: string; ids: ReadonlySet<ID> }>({
    termo: "",
    ids: SEM_IDS,
  });
  const [expandidos, setExpandidos] = useState<ReadonlySet<GrupoBusca>>(new Set());
  const [ativo, setAtivo] = useState(0);
  const [termoDoAtivo, setTermoDoAtivo] = useState(termo);

  // Termo novo: a seleção volta ao primeiro e os grupos voltam a recolher.
  if (termoDoAtivo !== termo) {
    setTermoDoAtivo(termo);
    setAtivo(0);
    setExpandidos(new Set());
  }

  const digitos = termo.replace(/\D/g, "").length >= MINIMO_DIGITOS_DOCUMENTO;

  // Telefone e CPF completos só o servidor conhece; resposta de termo velho é descartada.
  useEffect(() => {
    if (termo.replace(/\D/g, "").length < MINIMO_DIGITOS_DOCUMENTO) return;
    let valido = true;
    buscarPorDocumento(termo).then((ids) => {
      if (valido && ids) setPorDocumento({ termo, ids: new Set(ids) });
    });
    return () => {
      valido = false;
    };
  }, [termo, buscarPorDocumento]);

  const procurandoDocumento = digitos && porDocumento.termo !== termo;
  const idsPorDocumento = porDocumento.termo === termo ? porDocumento.ids : SEM_IDS;

  const grupos = useMemo(
    () =>
      buscarGlobal(
        termo,
        { pedidos, nomeDe, parametros, pagamentosFornecedor, faturas },
        {
          perfil,
          escopoVendedores,
          verRastreios: podeOperarRastreio(usuario),
          verFornecedor: podeVerFinanceiro(usuario),
        },
        idsPorDocumento,
      ),
    [termo, pedidos, nomeDe, parametros, pagamentosFornecedor, faturas, perfil, escopoVendedores, usuario, idsPorDocumento],
  );

  const secoes: Array<{ grupo: GrupoBusca; total: number; visiveis: ResultadoBusca[]; inicio: number }> = [];
  for (const grupo of ORDEM_GRUPOS) {
    const todos = grupos[grupo];
    if (todos.length === 0) continue;
    const anterior = secoes.at(-1);
    secoes.push({
      grupo,
      total: todos.length,
      visiveis: expandidos.has(grupo) ? todos : todos.slice(0, LIMITE_POR_GRUPO),
      // Posição do primeiro item na lista corrida que as setas percorrem.
      inicio: anterior ? anterior.inicio + anterior.visiveis.length : 0,
    });
  }
  const lista = secoes.flatMap((s) => s.visiveis);
  const curto = normalizar(termo).length < MINIMO_CARACTERES;

  function ir(resultado: ResultadoBusca) {
    aoFechar();
    router.push(resultado.href);
  }

  function mover(passo: number) {
    if (lista.length === 0) return;
    const proximo = (ativo + passo + lista.length) % lista.length;
    setAtivo(proximo);
    document.getElementById(`busca-item-${proximo}`)?.scrollIntoView({ block: "nearest" });
  }

  function aoTeclar(e: EventoTeclado<HTMLDivElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      mover(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      mover(-1);
    } else if (e.key === "Enter" && lista[ativo]) {
      e.preventDefault();
      ir(lista[ativo]);
    }
  }

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[var(--overlay)] backdrop-blur-[2px] data-[state=open]:[animation:axis-overlay-in_160ms_ease-out]" />
      <DialogPrimitive.Content
        onKeyDown={aoTeclar}
        className={cn(
          "fixed z-50 flex flex-col bg-surface-1 outline-none",
          // celular: tela cheia, respeitando o entalhe
          "inset-0 pt-[env(safe-area-inset-top)]",
          // desktop: janela no alto da tela
          "md:inset-auto md:top-[12vh] md:left-1/2 md:max-h-[76vh] md:w-[calc(100vw-2rem)] md:max-w-xl md:-translate-x-1/2 md:rounded-[var(--radius-card)] md:border md:border-border md:pt-0",
          "data-[state=open]:[animation:axis-in_180ms_ease-out]",
        )}
      >
        <DialogPrimitive.Title className="sr-only">Buscar no sistema</DialogPrimitive.Title>
        <DialogPrimitive.Description className="sr-only">
          Pedidos, clientes, rastreios e fornecedor. Use as setas para escolher e Enter para abrir.
        </DialogPrimitive.Description>

        <div className="flex shrink-0 items-center gap-2 border-b border-border p-3">
          <CampoBusca
            valor={termo}
            aoMudar={setTermo}
            atraso={150}
            placeholder="Buscar pedido, cliente, telefone, CPF, rastreio…"
            className="min-w-0 sm:max-w-none"
          />
          <DialogPrimitive.Close asChild>
            <Botao variante="fantasma" tamanho="sm" className="md:hidden">
              Cancelar
            </Botao>
          </DialogPrimitive.Close>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
          {curto ? (
            <p className="px-3 py-6 text-center text-[13px] text-muted-fg">
              Digite ao menos {MINIMO_CARACTERES} letras. Vale código do pedido, nome, telefone, CPF,
              cidade, kit, valor ou código de rastreio.
            </p>
          ) : lista.length === 0 ? (
            procurandoDocumento ? (
              <p className="px-3 py-6 text-center text-[13px] text-muted-fg">Procurando telefone e CPF…</p>
            ) : (
              <EstadoVazio
                compacto
                icone="busca"
                titulo="Nada encontrado"
                descricao="Confira a grafia ou tente outro dado: o código do pedido, parte do telefone ou a cidade."
                className="m-2 border-none"
              />
            )
          ) : (
            secoes.map(({ grupo, total, visiveis, inicio }) => (
              <section key={grupo} className="py-1" aria-label={ROTULO_GRUPO_BUSCA[grupo]}>
                <h3 className="flex items-center justify-between px-3 pt-2 pb-1 text-[12px] font-medium text-muted-fg">
                  {ROTULO_GRUPO_BUSCA[grupo]}
                  <span className="tabular">{total}</span>
                </h3>
                <ul>
                  {visiveis.map((r, posicao) => {
                    const i = inicio + posicao;
                    const selecionado = i === ativo;
                    return (
                      <li key={r.chave}>
                        <button
                          id={`busca-item-${i}`}
                          type="button"
                          onClick={() => ir(r)}
                          onMouseMove={() => !selecionado && setAtivo(i)}
                          aria-current={selecionado || undefined}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left transition-colors",
                            selecionado ? "bg-surface-2" : "hover:bg-surface-2",
                          )}
                        >
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-3 text-muted-fg">
                            <Icone nome={r.icone} size={16} />
                          </span>
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-sm font-medium">{r.titulo}</span>
                            <span className="truncate text-[12px] text-muted-fg">{r.detalhe}</span>
                          </span>
                          <Icone nome="avancar" size={14} className="shrink-0 text-muted-fg" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {total > visiveis.length && (
                  <button
                    type="button"
                    onClick={() => setExpandidos((atual) => new Set(atual).add(grupo))}
                    className="mx-3 mt-1 text-[12px] font-medium text-[var(--accent)]"
                  >
                    Ver mais {total - visiveis.length}
                  </button>
                )}
              </section>
            ))
          )}
          {procurandoDocumento && lista.length > 0 && (
            <p className="px-3 py-2 text-[12px] text-muted-fg">Procurando também por telefone e CPF…</p>
          )}
        </div>

        <div className="hidden shrink-0 items-center gap-4 border-t border-border px-4 py-2.5 text-[11px] text-muted-fg md:flex">
          <span>↑ ↓ para escolher</span>
          <span>Enter para abrir</span>
          <span>Esc para fechar</span>
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
