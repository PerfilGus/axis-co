"use client";

import { useState } from "react";
import { centavosParaCampo, formatBRL, formatDia, parseBRL } from "@/lib/format";
import { custoPor } from "@/lib/meta-ads";
import { hoje } from "@/lib/periodos";
import { useMarketing } from "@/lib/providers/marketing";
import { Icone } from "@/components/icone";
import { Botao } from "@/components/ui/button";
import { Modal, ModalCabecalho, ModalConteudo, ModalRodape } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Campo } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";

/**
 * Lançamento manual do dia no Meta Ads: investimento e leads. Vendas não se
 * lançam — vêm dos pedidos agendados no dia.
 */
export function ModalDiaMeta({
  aberto,
  dia,
  aoFechar,
}: {
  aberto: boolean;
  /** Dia a editar. Sem ele, abre em hoje. */
  dia: string | null;
  aoFechar: () => void;
}) {
  if (!aberto) return null;
  return <Formulario key={dia ?? "novo"} diaInicial={dia} aoFechar={aoFechar} />;
}

function Formulario({ diaInicial, aoFechar }: { diaInicial: string | null; aoFechar: () => void }) {
  const { diasManuais, diasComApi, lancarDia, excluirDia } = useMarketing();
  const limite = hoje();
  const [data, setData] = useState(diaInicial ?? limite);
  const existente = diasManuais.find((d) => d.data === data) ?? null;
  const [investimento, setInvestimento] = useState(
    existente ? centavosParaCampo(existente.investimento) : "",
  );
  const [leads, setLeads] = useState(existente ? String(existente.leads) : "");
  const [erros, setErros] = useState<Record<string, string>>({});

  const temApi = diasComApi.has(data);
  const valorCentavos = parseBRL(investimento);
  const qtdLeads = Number(leads) || 0;
  const cpl = valorCentavos !== null ? custoPor(valorCentavos, qtdLeads) : null;

  function trocarData(nova: string) {
    setData(nova);
    const doDia = diasManuais.find((d) => d.data === nova);
    setInvestimento(doDia ? centavosParaCampo(doDia.investimento) : "");
    setLeads(doDia ? String(doDia.leads) : "");
    setErros({});
  }

  async function salvar() {
    const e: Record<string, string> = {};
    if (!data || data > limite) e.data = "Escolha um dia até hoje.";
    else if (temApi) e.data = "Este dia já veio da API do Meta e não aceita lançamento manual.";
    if (valorCentavos === null || valorCentavos < 0) e.investimento = "Informe quanto foi investido no dia.";
    if (leads.trim() === "") e.leads = "Informe quantos leads chegaram, mesmo que zero.";
    setErros(e);
    if (Object.keys(e).length > 0 || valorCentavos === null) return;

    if (!(await lancarDia(data, valorCentavos, qtdLeads))) return;
    toast.success(existente ? "Lançamento corrigido" : "Dia lançado", {
      description: `${formatDia(data)}: ${formatBRL(valorCentavos)} e ${qtdLeads} leads.`,
    });
    aoFechar();
  }

  return (
    <Modal open onOpenChange={(v) => !v && aoFechar()}>
      <ModalConteudo larguraMaxima="max-w-md">
        <ModalCabecalho
          titulo={existente ? "Corrigir lançamento do dia" : "Lançar dia no Meta Ads"}
          descricao="Total do dia, para quando a API não trouxe os números. Vendas saem dos pedidos."
        />
        <div className="flex flex-col gap-4">
          <Campo rotulo="Dia" obrigatorio erro={erros.data}>
            <Input
              type="date"
              value={data}
              max={limite}
              onChange={(e) => e.target.value && trocarData(e.target.value)}
              className="tabular"
            />
          </Campo>
          {temApi && (
            <p className="flex items-start gap-2 rounded-[var(--radius-card-sm)] bg-surface-2 px-4 py-3 text-[13px] text-muted-fg">
              <Icone nome="info" size={15} className="mt-0.5 shrink-0" />
              Este dia já foi sincronizado pela API, com o detalhe por criativo.
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Investimento" obrigatorio erro={erros.investimento}>
              <Input
                value={investimento}
                onChange={(e) => setInvestimento(e.target.value)}
                inputMode="decimal"
                placeholder="R$ 0,00"
                className="tabular"
                disabled={temApi}
                autoFocus
              />
            </Campo>
            <Campo rotulo="Leads" obrigatorio erro={erros.leads}>
              <Input
                value={leads}
                onChange={(e) => setLeads(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                placeholder="0"
                className="tabular"
                disabled={temApi}
              />
            </Campo>
          </div>
          {!temApi && (
            <p className="text-xs text-muted-fg">
              CPL do dia: <span className="tabular text-fg">{cpl !== null ? formatBRL(cpl) : "—"}</span>.
              Sem detalhe por criativo, o valor entra em “Criativo não identificado” na análise.
            </p>
          )}
        </div>
        <ModalRodape>
          {existente && (
            <Botao
              variante="perigo"
              className="sm:mr-auto"
              onClick={async () => {
                if (!(await excluirDia(data))) return;
                toast.success("Lançamento removido", { description: formatDia(data) });
                aoFechar();
              }}
            >
              <Icone nome="excluir" size={15} />
              Remover lançamento
            </Botao>
          )}
          <Botao variante="secundaria" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao variante="principal" onClick={salvar} disabled={temApi}>
            <Icone nome="check" size={15} />
            {existente ? "Salvar correção" : "Lançar dia"}
          </Botao>
        </ModalRodape>
      </ModalConteudo>
    </Modal>
  );
}
