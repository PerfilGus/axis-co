"use client";

import { useState } from "react";
import type { BonusNivel } from "@/lib/types";
import { formatBRL, formatData } from "@/lib/format";
import { STATUS_BONUS_NIVEL } from "@/lib/status";
import { useEquipe } from "@/lib/providers/equipe";
import { useSessao } from "@/lib/providers/sessao";
import { Icone } from "@/components/icone";
import { Botao } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { AvatarAnel } from "@/components/shared/avatar-anel";
import { ModalConfirmacao } from "@/components/shared/modal-confirmacao";
import { SeloTom } from "@/components/shared/selo-status";

/**
 * Bônus de nível liberados e ainda não pagos. O sistema não paga ninguém:
 * mostra a chave Pix e espera o Admin confirmar que o dinheiro saiu.
 */
export function BonusLiberados({
  colaboradorId,
  className,
}: {
  /** Filtra um colaborador; sem ele, lista todos. */
  colaboradorId?: string;
  className?: string;
}) {
  const { bonusNivel, colaboradores, niveis, confirmarBonus } = useEquipe();
  const { ehAdmin } = useSessao();
  const [confirmando, setConfirmando] = useState<BonusNivel | null>(null);

  const liberados = bonusNivel
    .filter((b) => b.status === "liberado")
    .filter((b) => !colaboradorId || b.colaboradorId === colaboradorId)
    .sort((a, b) => a.liberadoEm.localeCompare(b.liberadoEm));

  if (liberados.length === 0) return null;

  const alvo = confirmando ? colaboradores.find((c) => c.id === confirmando.colaboradorId) : null;
  const nivelAlvo = confirmando ? niveis.find((n) => n.id === confirmando.nivelId) : null;

  return (
    <Card className={className}>
      <div className="flex flex-col gap-1 px-5 pt-5 pb-3">
        <h2 className="flex items-center gap-2 text-base font-medium tracking-tight">
          <Icone nome="medalha" size={17} className="text-[var(--accent)]" />
          Bônus de nível para pagar
        </h2>
        <p className="text-[13px] text-muted-fg">
          Faça o Pix e confirme aqui. Também dá para quitar junto com o fechamento em Comissões.
        </p>
      </div>
      <ul className="flex flex-col">
        {liberados.map((bonus) => {
          const colaborador = colaboradores.find((c) => c.id === bonus.colaboradorId);
          const nivel = niveis.find((n) => n.id === bonus.nivelId);
          return (
            <li
              key={bonus.id}
              className="flex flex-wrap items-center gap-3 border-t border-border px-5 py-3"
            >
              <AvatarAnel nome={colaborador?.nome ?? "?"} imagemUrl={colaborador?.avatarUrl} progresso={1} tamanho={36} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">
                  {colaborador?.nome ?? "—"} chegou a {nivel?.nome ?? "novo nível"}
                </span>
                <span className="truncate text-xs text-muted-fg">
                  Liberado em {formatData(bonus.liberadoEm)} · Pix:{" "}
                  {colaborador?.chavePix ?? "sem chave cadastrada"}
                </span>
              </div>
              <SeloTom tom={STATUS_BONUS_NIVEL.liberado.tom}>{STATUS_BONUS_NIVEL.liberado.rotulo}</SeloTom>
              <span className="tabular w-24 text-right font-medium">{formatBRL(bonus.valor)}</span>
              {ehAdmin && (
                <Botao variante="principal" tamanho="sm" onClick={() => setConfirmando(bonus)}>
                  <Icone nome="pix" size={14} />
                  Confirmar Pix
                </Botao>
              )}
            </li>
          );
        })}
      </ul>

      <ModalConfirmacao
        aberto={confirmando !== null}
        titulo="Confirmar pagamento do bônus"
        mensagem="Confirme só depois de o Pix ter saído. O bônus passa a constar como pago."
        itens={
          confirmando
            ? [
                `${alvo?.nome ?? "—"}, ${nivelAlvo?.nome ?? "nível"}`,
                `Valor: ${formatBRL(confirmando.valor)}`,
                `Chave Pix: ${alvo?.chavePix ?? "sem chave cadastrada"}`,
              ]
            : []
        }
        icone="pix"
        rotuloConfirmar="Pix enviado"
        aoCancelar={() => setConfirmando(null)}
        aoConfirmar={async () => {
          if (!confirmando) return;
          if (!(await confirmarBonus(confirmando.id))) return;
          toast.success("Bônus pago", {
            description: `${formatBRL(confirmando.valor)} para ${alvo?.nome ?? "o colaborador"}.`,
          });
          setConfirmando(null);
        }}
      />
    </Card>
  );
}
