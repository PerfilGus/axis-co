"use client";

import { useState } from "react";
import type { CategoriaDespesa, DespesaFixa } from "@/lib/types";
import {
  bpsParaCampo,
  centavosParaCampo,
  formatBps,
  formatBRL,
  formatCompetencia,
  parseBRL,
  parsePercentual,
} from "@/lib/format";
import { competenciaAtual, hoje, isoDoDia, somarDias } from "@/lib/periodos";
import { aliquotaDa } from "@/lib/resultado";
import { CATEGORIA_DESPESA } from "@/lib/status";
import { useFinanceiro } from "@/lib/providers/financeiro";
import { Icone } from "@/components/icone";
import { Botao } from "@/components/ui/button";
import { Modal, ModalCabecalho, ModalConteudo, ModalRodape } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Campo } from "@/components/ui/label";
import {
  Selecao,
  SelecaoConteudo,
  SelecaoGatilho,
  SelecaoItem,
  SelecaoValor,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";

type Erros = Record<string, string>;

function maiuscula(texto: string) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/* ================================================================
   Alíquota do Simples
   ================================================================ */

export function ModalAliquota({
  competencia,
  aoFechar,
}: {
  competencia: string | null;
  aoFechar: () => void;
}) {
  if (!competencia) return null;
  return <FormularioAliquota key={competencia} competencia={competencia} aoFechar={aoFechar} />;
}

function FormularioAliquota({ competencia, aoFechar }: { competencia: string; aoFechar: () => void }) {
  const { aliquotas, definirAliquota } = useFinanceiro();
  const atual = aliquotaDa(competencia, aliquotas);
  const [valor, setValor] = useState(atual.situacao === "confirmada" ? bpsParaCampo(atual.aliquotaBps) : "");
  const [erro, setErro] = useState<string | null>(null);
  const mes = formatCompetencia(competencia);

  function salvar() {
    const bps = parsePercentual(valor);
    if (bps === null || bps <= 0 || bps > 3300) {
      setErro("Informe a alíquota efetiva, entre 0 e 33%.");
      return;
    }
    definirAliquota(competencia, bps);
    toast.success("Alíquota confirmada", { description: `${maiuscula(mes)}: ${formatBps(bps)}.` });
    aoFechar();
  }

  return (
    <Modal open onOpenChange={(v) => !v && aoFechar()}>
      <ModalConteudo larguraMaxima="max-w-md">
        <ModalCabecalho
          titulo={`Alíquota de ${mes}`}
          descricao="A alíquota efetiva do Simples que o contador fechou para o mês."
        />
        <div className="flex flex-col gap-4">
          <Campo
            rotulo="Alíquota efetiva (%)"
            obrigatorio
            erro={erro}
            ajuda={
              atual.situacao === "estimada"
                ? atual.origem
                  ? `Hoje o mês usa ${formatBps(atual.aliquotaBps)}, herdada de ${formatCompetencia(atual.origem)}.`
                  : "Nenhuma alíquota anterior lançada: o imposto aparece zerado."
                : undefined
            }
          >
            <Input
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              inputMode="decimal"
              placeholder={atual.aliquotaBps > 0 ? bpsParaCampo(atual.aliquotaBps) : "6,12"}
              className="tabular"
              autoFocus
            />
          </Campo>
        </div>
        <ModalRodape>
          {atual.situacao === "confirmada" && (
            <Botao
              variante="fantasma"
              className="sm:mr-auto"
              onClick={() => {
                definirAliquota(competencia, null);
                toast.success("Alíquota voltou a ser estimada", { description: maiuscula(mes) });
                aoFechar();
              }}
            >
              Voltar a estimar
            </Botao>
          )}
          <Botao variante="secundaria" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao variante="principal" onClick={salvar}>
            <Icone nome="check" size={15} />
            Confirmar alíquota
          </Botao>
        </ModalRodape>
      </ModalConteudo>
    </Modal>
  );
}

/* ================================================================
   Despesa fixa
   ================================================================ */

export function ModalDespesa({
  despesa,
  aberto,
  aoFechar,
}: {
  despesa: DespesaFixa | null;
  aberto: boolean;
  aoFechar: () => void;
}) {
  if (!aberto) return null;
  return <FormularioDespesa key={despesa?.id ?? "nova"} despesa={despesa} aoFechar={aoFechar} />;
}

function FormularioDespesa({ despesa, aoFechar }: { despesa: DespesaFixa | null; aoFechar: () => void }) {
  const { salvarDespesa, excluirDespesa } = useFinanceiro();
  const [descricao, setDescricao] = useState(despesa?.descricao ?? "");
  const [categoria, setCategoria] = useState<CategoriaDespesa>(despesa?.categoria ?? "ferramentas");
  const [valor, setValor] = useState(despesa ? centavosParaCampo(despesa.valor) : "");
  const [dia, setDia] = useState(String(despesa?.diaVencimento ?? 10));
  const [desde, setDesde] = useState(despesa?.desde ?? competenciaAtual());
  const [ate, setAte] = useState(despesa?.ate ?? "");
  const [erros, setErros] = useState<Erros>({});

  function salvar() {
    const e: Erros = {};
    const centavos = parseBRL(valor);
    const diaNumero = Number(dia);
    if (!descricao.trim()) e.descricao = "Descreva a despesa, como “Assinatura do CRM”.";
    if (centavos === null || centavos <= 0) e.valor = "Informe o valor mensal.";
    if (!Number.isInteger(diaNumero) || diaNumero < 1 || diaNumero > 31) e.dia = "Dia de 1 a 31.";
    if (!desde) e.desde = "Informe o mês em que começou.";
    if (ate && ate < desde) e.ate = "O fim não pode vir antes do início.";
    setErros(e);
    if (Object.keys(e).length > 0 || centavos === null) return;

    salvarDespesa({
      id: despesa?.id,
      descricao: descricao.trim(),
      categoria,
      valor: centavos,
      diaVencimento: diaNumero,
      desde,
      ate: ate || null,
    });
    toast.success(despesa ? "Despesa atualizada" : "Despesa cadastrada", {
      description: `${descricao.trim()}: ${formatBRL(centavos)} por mês.`,
    });
    aoFechar();
  }

  return (
    <Modal open onOpenChange={(v) => !v && aoFechar()}>
      <ModalConteudo larguraMaxima="max-w-lg">
        <ModalCabecalho
          titulo={despesa ? "Editar despesa fixa" : "Nova despesa fixa"}
          descricao="Custo que se repete todo mês. Entra no relatório enquanto estiver em vigor."
        />
        <div className="flex flex-col gap-4">
          <Campo rotulo="Descrição" obrigatorio erro={erros.descricao}>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} autoFocus />
          </Campo>
          <div className="grid gap-4 sm:grid-cols-[1fr_10rem_6rem]">
            <Campo rotulo="Categoria">
              <Selecao value={categoria} onValueChange={(v) => setCategoria(v as CategoriaDespesa)}>
                <SelecaoGatilho>
                  <SelecaoValor />
                </SelecaoGatilho>
                <SelecaoConteudo>
                  {(Object.keys(CATEGORIA_DESPESA) as CategoriaDespesa[]).map((c) => (
                    <SelecaoItem key={c} value={c}>
                      {CATEGORIA_DESPESA[c]}
                    </SelecaoItem>
                  ))}
                </SelecaoConteudo>
              </Selecao>
            </Campo>
            <Campo rotulo="Valor mensal" obrigatorio erro={erros.valor}>
              <Input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" className="tabular" />
            </Campo>
            <Campo rotulo="Vence dia" erro={erros.dia}>
              <Input
                value={dia}
                onChange={(e) => setDia(e.target.value.replace(/\D/g, "").slice(0, 2))}
                inputMode="numeric"
                className="tabular"
              />
            </Campo>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Desde" obrigatorio erro={erros.desde}>
              <Input type="month" value={desde} onChange={(e) => setDesde(e.target.value)} className="tabular" />
            </Campo>
            <Campo rotulo="Até" erro={erros.ate} ajuda="Vazio enquanto estiver em vigor.">
              <Input type="month" value={ate} min={desde} onChange={(e) => setAte(e.target.value)} className="tabular" />
            </Campo>
          </div>
          {categoria === "pro_labore" && (
            <p className="flex items-start gap-2 rounded-[var(--radius-card-sm)] bg-surface-2 px-4 py-3 text-[13px] text-muted-fg">
              <Icone nome="info" size={15} className="mt-0.5 shrink-0" />
              Pró-labore sai em linha própria, abaixo do lucro operacional.
            </p>
          )}
        </div>
        <ModalRodape>
          {despesa && (
            <Botao
              variante="perigo"
              className="sm:mr-auto"
              onClick={() => {
                excluirDespesa(despesa.id);
                toast.success("Despesa excluída", {
                  description: "Some também dos meses anteriores. Para só encerrar, preencha o “Até”.",
                });
                aoFechar();
              }}
            >
              <Icone nome="excluir" size={15} />
              Excluir
            </Botao>
          )}
          <Botao variante="secundaria" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao variante="principal" onClick={salvar}>
            <Icone nome="check" size={15} />
            {despesa ? "Salvar despesa" : "Cadastrar despesa"}
          </Botao>
        </ModalRodape>
      </ModalConteudo>
    </Modal>
  );
}

/* ================================================================
   Dívida
   ================================================================ */

export function ModalDivida({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  if (!aberto) return null;
  return <FormularioDivida aoFechar={aoFechar} />;
}

function FormularioDivida({ aoFechar }: { aoFechar: () => void }) {
  const { criarDivida } = useFinanceiro();
  const [credor, setCredor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [valorOriginal, setValorOriginal] = useState("");
  const [juros, setJuros] = useState("");
  const [quantidade, setQuantidade] = useState("12");
  const [valorParcela, setValorParcela] = useState("");
  const [primeiro, setPrimeiro] = useState(somarDias(hoje(), 30));
  const [erros, setErros] = useState<Erros>({});

  const qtd = Number(quantidade) || 0;
  const parcela = parseBRL(valorParcela);

  function salvar() {
    const e: Erros = {};
    const original = parseBRL(valorOriginal);
    const jurosBps = juros.trim() ? parsePercentual(juros) : 0;
    if (!credor.trim()) e.credor = "Informe com quem é a dívida.";
    if (original === null || original <= 0) e.valorOriginal = "Informe o valor contratado.";
    if (jurosBps === null || jurosBps < 0) e.juros = "Juros ao mês, em %.";
    if (qtd < 1 || qtd > 120) e.quantidade = "De 1 a 120 parcelas.";
    if (parcela === null || parcela <= 0) e.valorParcela = "Informe o valor de cada parcela.";
    if (!primeiro) e.primeiro = "Informe o primeiro vencimento.";
    setErros(e);
    if (Object.keys(e).length > 0 || original === null || parcela === null || jurosBps === null) return;

    criarDivida({
      credor: credor.trim(),
      descricao: descricao.trim(),
      valorOriginal: original,
      jurosBps,
      quantidadeParcelas: qtd,
      valorParcela: parcela,
      primeiroVencimento: isoDoDia(primeiro),
    });
    toast.success("Dívida cadastrada", {
      description: `${qtd} parcelas de ${formatBRL(parcela)} com ${credor.trim()}.`,
    });
    aoFechar();
  }

  return (
    <Modal open onOpenChange={(v) => !v && aoFechar()}>
      <ModalConteudo larguraMaxima="max-w-lg">
        <ModalCabecalho
          titulo="Nova dívida"
          descricao="Empréstimo ou parcelamento. As parcelas entram no relatório pelo vencimento e pelo pagamento."
        />
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Credor" obrigatorio erro={erros.credor}>
              <Input value={credor} onChange={(e) => setCredor(e.target.value)} placeholder="Banco Inter PJ" autoFocus />
            </Campo>
            <Campo rotulo="Descrição">
              <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Capital de giro" />
            </Campo>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Valor contratado" obrigatorio erro={erros.valorOriginal}>
              <Input value={valorOriginal} onChange={(e) => setValorOriginal(e.target.value)} inputMode="decimal" className="tabular" />
            </Campo>
            <Campo rotulo="Juros ao mês (%)" erro={erros.juros}>
              <Input value={juros} onChange={(e) => setJuros(e.target.value)} inputMode="decimal" placeholder="1,89" className="tabular" />
            </Campo>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Campo rotulo="Parcelas" obrigatorio erro={erros.quantidade}>
              <Input
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value.replace(/\D/g, "").slice(0, 3))}
                inputMode="numeric"
                className="tabular"
              />
            </Campo>
            <Campo rotulo="Valor da parcela" obrigatorio erro={erros.valorParcela}>
              <Input value={valorParcela} onChange={(e) => setValorParcela(e.target.value)} inputMode="decimal" className="tabular" />
            </Campo>
            <Campo rotulo="1º vencimento" obrigatorio erro={erros.primeiro}>
              <Input type="date" value={primeiro} onChange={(e) => setPrimeiro(e.target.value)} className="tabular" />
            </Campo>
          </div>
          {qtd > 0 && parcela !== null && parcela > 0 && (
            <p className="text-xs text-muted-fg">
              Total a pagar: <span className="tabular text-fg">{formatBRL(qtd * parcela)}</span>, uma parcela por mês.
            </p>
          )}
        </div>
        <ModalRodape>
          <Botao variante="secundaria" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao variante="principal" onClick={salvar}>
            <Icone nome="check" size={15} />
            Cadastrar dívida
          </Botao>
        </ModalRodape>
      </ModalConteudo>
    </Modal>
  );
}
