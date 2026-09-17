"use client";

import Link from "next/link";
import type { PagamentoColaborador } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatBRL, formatCompetencia, formatData } from "@/lib/format";
import { Icone, type NomeIcone } from "@/components/icone";
import { useBusca } from "@/components/busca/busca-global";
import {
  Gaveta,
  GavetaCabecalho,
  GavetaConteudo,
  GavetaCorpo,
  GavetaGatilho,
  GavetaRodape,
} from "@/components/ui/drawer";
import {
  Menu,
  MenuConteudo,
  MenuGatilho,
  MenuItem,
  MenuRotulo,
} from "@/components/ui/dropdown-menu";

export interface Aviso {
  chave: string;
  icone: NomeIcone;
  texto: string;
  href?: string;
}

const BOTAO_PILULA =
  "flex size-10 items-center justify-center rounded-full text-fg transition-colors hover:bg-surface-3";

/**
 * Topo da Minha área: pílula de ações à esquerda (avisos e ajustes) e, à
 * direita, a comissão prevista do mês, que abre o detalhamento.
 */
export function TopoMinhaArea({
  avisos,
  hrefAjustes,
  fechamento,
}: {
  avisos: Aviso[];
  hrefAjustes: string;
  fechamento: PagamentoColaborador | null;
}) {
  const { abrir: abrirBusca } = useBusca();
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="inline-flex items-center gap-1 rounded-full bg-surface-2 p-1">
        <button className={BOTAO_PILULA} aria-label="Buscar" onClick={abrirBusca}>
          <Icone nome="busca" />
        </button>
        <Menu>
          <MenuGatilho asChild>
            <button
              className={cn(BOTAO_PILULA, "relative")}
              aria-label={`Avisos${avisos.length ? `, ${avisos.length} ${avisos.length === 1 ? "novo" : "novos"}` : ""}`}
            >
              <Icone nome="notificacoes" />
              {avisos.length > 0 && (
                <span
                  className="absolute top-2 right-2 size-2 rounded-full ring-2 ring-surface-2"
                  style={{ backgroundColor: "var(--accent)" }}
                  aria-hidden
                />
              )}
            </button>
          </MenuGatilho>
          <MenuConteudo align="start" className="w-72">
            <MenuRotulo>Avisos</MenuRotulo>
            {avisos.length === 0 ? (
              <p className="px-3 pb-3 text-[13px] text-muted-fg">
                Nada pedindo sua atenção agora.
              </p>
            ) : (
              avisos.map((aviso) =>
                aviso.href ? (
                  <MenuItem key={aviso.chave} asChild>
                    <Link href={aviso.href} className="items-start rounded-[var(--radius-input)]">
                      <Icone nome={aviso.icone} size={15} className="mt-0.5" />
                      <span className="whitespace-normal">{aviso.texto}</span>
                    </Link>
                  </MenuItem>
                ) : (
                  <MenuItem key={aviso.chave} className="items-start rounded-[var(--radius-input)]">
                    <Icone nome={aviso.icone} size={15} className="mt-0.5" />
                    <span className="whitespace-normal">{aviso.texto}</span>
                  </MenuItem>
                ),
              )
            )}
          </MenuConteudo>
        </Menu>
        <span className="h-5 w-px bg-border" aria-hidden />
        <Link href={hrefAjustes} className={BOTAO_PILULA} aria-label="Configurações" title="Configurações">
          <Icone nome="configuracoes" />
        </Link>
      </div>

      <PilulaComissao fechamento={fechamento} />
    </div>
  );
}

function PilulaComissao({ fechamento }: { fechamento: PagamentoColaborador | null }) {
  if (!fechamento) {
    return (
      <span className="inline-flex h-12 items-center gap-2 rounded-full bg-surface-2 px-4 text-[13px] text-muted-fg">
        <Icone nome="dinheiro" size={16} />
        Sem comissão neste mês
      </span>
    );
  }

  const variavel = fechamento.total - fechamento.fixo;

  return (
    <Gaveta>
      <GavetaGatilho asChild>
        <button
          className="inline-flex h-12 items-center gap-2.5 rounded-full bg-surface-2 py-1 pr-4 pl-1 transition-colors hover:bg-surface-3"
          aria-label={`Comissão prevista do mês: ${formatBRL(variavel)}. Ver detalhamento`}
        >
          <span className="flex size-10 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-fg)]">
            <Icone nome="dinheiro" size={18} />
          </span>
          <span className="flex flex-col items-start leading-none">
            <span className="text-[10px] text-muted-fg">Previsto no mês</span>
            <span className="tabular mt-1 text-[15px] font-medium">{formatBRL(variavel)}</span>
          </span>
        </button>
      </GavetaGatilho>
      <GavetaConteudo>
        <GavetaCabecalho
          titulo="Comissão prevista"
          descricao={`Competência de ${formatCompetencia(fechamento.competencia)}. Recalculada a cada pedido até o Admin pagar.`}
        />
        <GavetaCorpo className="flex flex-col gap-1 p-0">
          <ul className="flex flex-col">
            {fechamento.detalhamento.map((linha, i) => (
              <li
                key={`${linha.grupo}-${i}`}
                className={cn(
                  "flex items-start justify-between gap-4 border-b border-border px-5 py-3",
                  linha.informativa && "text-muted-fg",
                )}
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm">{linha.rotulo}</span>
                  {linha.conta && <span className="text-xs text-muted-fg">{linha.conta}</span>}
                </div>
                <span className="tabular shrink-0 text-right text-sm font-medium">
                  {formatBRL(linha.valor)}
                </span>
              </li>
            ))}
          </ul>
        </GavetaCorpo>
        <GavetaRodape className="flex-col items-stretch gap-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-fg">Variável (comissão e bônus)</span>
            <span className="tabular font-medium">{formatBRL(variavel)}</span>
          </div>
          <div className="flex items-center justify-between text-base">
            <span>Total com o fixo</span>
            <span className="tabular font-medium">{formatBRL(fechamento.total)}</span>
          </div>
          <p className="text-xs text-muted-fg">
            {fechamento.status === "pago"
              ? `Pago em ${formatData(fechamento.pagoEm)}.`
              : `Pagamento previsto para ${formatData(fechamento.pagarEm)}.`}
          </p>
        </GavetaRodape>
      </GavetaConteudo>
    </Gaveta>
  );
}
