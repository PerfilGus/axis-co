"use client";

import { Icone, type NomeIcone } from "@/components/icone";
import { Botao } from "@/components/ui/button";
import {
  Modal,
  ModalCabecalho,
  ModalConteudo,
  ModalRodape,
} from "@/components/ui/dialog";

/**
 * Confirmação com a lista do que será afetado.
 *
 * Portada do `confirmDialog()` do axis-tracking: fechar por Escape, X ou
 * clique fora conta como "não".
 */
export function ModalConfirmacao({
  aberto,
  titulo,
  mensagem,
  itens,
  rotuloConfirmar = "Confirmar",
  icone = "alerta",
  perigo = false,
  aoConfirmar,
  aoCancelar,
}: {
  aberto: boolean;
  titulo: string;
  mensagem: string;
  itens?: string[];
  rotuloConfirmar?: string;
  icone?: NomeIcone;
  perigo?: boolean;
  aoConfirmar: () => void;
  aoCancelar: () => void;
}) {
  return (
    <Modal open={aberto} onOpenChange={(v) => !v && aoCancelar()}>
      <ModalConteudo larguraMaxima="max-w-md">
        <ModalCabecalho titulo={titulo} descricao={mensagem} />

        {itens && itens.length > 0 && (
          <ul className="max-h-56 overflow-y-auto rounded-[var(--radius-card-sm)] border border-border bg-surface-2 px-4 py-3">
            {itens.map((item) => (
              <li key={item} className="py-0.5 text-[13px] text-muted-fg">
                {item}
              </li>
            ))}
          </ul>
        )}

        <ModalRodape>
          <Botao variante="secundaria" onClick={aoCancelar}>
            Cancelar
          </Botao>
          <Botao
            variante={perigo ? "perigo" : "principal"}
            onClick={aoConfirmar}
          >
            <Icone nome={icone} size={15} />
            {rotuloConfirmar}
          </Botao>
        </ModalRodape>
      </ModalConteudo>
    </Modal>
  );
}
