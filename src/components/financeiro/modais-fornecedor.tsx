"use client";

import { useState } from "react";
import type { FaturaFornecedor } from "@/lib/types";
import { centavosParaCampo, formatBRL, formatDia, parseBRL } from "@/lib/format";
import { hoje, isoDoDia } from "@/lib/periodos";
import { useFinanceiro } from "@/lib/providers/financeiro";
import { Icone } from "@/components/icone";
import { Botao } from "@/components/ui/button";
import { Modal, ModalCabecalho, ModalConteudo, ModalRodape } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Campo } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { EnvioArquivo, type ArquivoSelecionado } from "@/components/shared/envio-arquivo";

type Erros = Record<string, string>;

/* ================================================================
   Parâmetros
   ================================================================ */

export function ModalParametrosFornecedor({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  if (!aberto) return null;
  return <FormularioParametros aoFechar={aoFechar} />;
}

function FormularioParametros({ aoFechar }: { aoFechar: () => void }) {
  const { parametros, salvarParametros } = useFinanceiro();
  const [fornecedor, setFornecedor] = useState(parametros.fornecedor);
  const [pote, setPote] = useState(centavosParaCampo(parametros.custoPote));
  const [frete, setFrete] = useState(centavosParaCampo(parametros.freteEnvio));
  const [erros, setErros] = useState<Erros>({});

  async function salvar() {
    const e: Erros = {};
    const custoPote = parseBRL(pote);
    const freteEnvio = parseBRL(frete);
    if (!fornecedor.trim()) e.fornecedor = "Informe o nome do fornecedor.";
    if (custoPote === null || custoPote <= 0) e.pote = "Informe quanto o fornecedor cobra por pote.";
    if (freteEnvio === null || freteEnvio < 0) e.frete = "Informe o frete por envio, mesmo que zero.";
    setErros(e);
    if (Object.keys(e).length > 0 || custoPote === null || freteEnvio === null) return;

    if (!(await salvarParametros({ fornecedor: fornecedor.trim(), custoPote, freteEnvio }))) return;
    toast.success("Parâmetros atualizados", {
      description: "O previsto de todos os envios foi recalculado com os valores novos.",
    });
    aoFechar();
  }

  return (
    <Modal open onOpenChange={(v) => !v && aoFechar()}>
      <ModalConteudo larguraMaxima="max-w-md">
        <ModalCabecalho
          titulo="Parâmetros do fornecedor"
          descricao="Base do custo previsto de cada envio. Mudar aqui recalcula o previsto de todo o histórico."
        />
        <div className="flex flex-col gap-4">
          <Campo rotulo="Fornecedor" obrigatorio erro={erros.fornecedor}>
            <Input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} />
          </Campo>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Custo por pote" obrigatorio erro={erros.pote}>
              <Input
                value={pote}
                onChange={(e) => setPote(e.target.value)}
                inputMode="decimal"
                className="tabular"
                autoFocus
              />
            </Campo>
            <Campo rotulo="Frete por envio" obrigatorio erro={erros.frete}>
              <Input
                value={frete}
                onChange={(e) => setFrete(e.target.value)}
                inputMode="decimal"
                className="tabular"
              />
            </Campo>
          </div>
        </div>
        <ModalRodape>
          <Botao variante="secundaria" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao variante="principal" onClick={salvar}>
            <Icone nome="check" size={15} />
            Salvar parâmetros
          </Botao>
        </ModalRodape>
      </ModalConteudo>
    </Modal>
  );
}

/* ================================================================
   Pagamento ao fornecedor
   ================================================================ */

export function ModalPagamentoFornecedor({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  if (!aberto) return null;
  return <FormularioPagamento aoFechar={aoFechar} />;
}

function FormularioPagamento({ aoFechar }: { aoFechar: () => void }) {
  const { parametros, lancarPagamentoFornecedor } = useFinanceiro();
  const [data, setData] = useState(hoje());
  const [valor, setValor] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [arquivo, setArquivo] = useState<ArquivoSelecionado | null>(null);
  const [erros, setErros] = useState<Erros>({});

  async function salvar() {
    const e: Erros = {};
    const centavos = parseBRL(valor);
    if (!data || data > hoje()) e.data = "Escolha a data do pagamento, até hoje.";
    if (centavos === null || centavos <= 0) e.valor = "Informe o valor pago.";
    setErros(e);
    if (Object.keys(e).length > 0 || centavos === null) return;

    const pagoEm = isoDoDia(data);
    const lancado = await lancarPagamentoFornecedor(
      { pagoEm, valor: centavos, observacoes: observacoes.trim() || null },
      arquivo?.arquivo ?? null,
    );
    if (!lancado) return;
    toast.success("Pagamento lançado", {
      description: `${formatBRL(centavos)} para ${parametros.fornecedor} em ${formatDia(data)}.`,
    });
    aoFechar();
  }

  return (
    <Modal open onOpenChange={(v) => !v && aoFechar()}>
      <ModalConteudo larguraMaxima="max-w-md">
        <ModalCabecalho
          titulo="Lançar pagamento ao fornecedor"
          descricao={`O que saiu da conta para ${parametros.fornecedor}. Abate do saldo previsto.`}
        />
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Data" obrigatorio erro={erros.data}>
              <Input
                type="date"
                value={data}
                max={hoje()}
                onChange={(e) => setData(e.target.value)}
                className="tabular"
              />
            </Campo>
            <Campo rotulo="Valor" obrigatorio erro={erros.valor}>
              <Input
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                inputMode="decimal"
                placeholder="R$ 0,00"
                className="tabular"
                autoFocus
              />
            </Campo>
          </div>
          <Campo rotulo="Comprovante" ajuda="Opcional, mas é o que a conferência vai pedir depois.">
            <EnvioArquivo
              rotulo="Arraste o comprovante ou clique para escolher"
              aoSelecionar={(lista) => setArquivo(lista[0] ?? null)}
            />
          </Campo>
          <Campo rotulo="Observações">
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex.: restante dos envios de agosto"
              className="min-h-16"
            />
          </Campo>
        </div>
        <ModalRodape>
          <Botao variante="secundaria" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao variante="principal" onClick={salvar}>
            <Icone nome="check" size={15} />
            Lançar pagamento
          </Botao>
        </ModalRodape>
      </ModalConteudo>
    </Modal>
  );
}

/* ================================================================
   Fatura para conferência
   ================================================================ */

export function ModalFaturaFornecedor({
  fatura,
  aberto,
  aoFechar,
}: {
  fatura: FaturaFornecedor | null;
  aberto: boolean;
  aoFechar: () => void;
}) {
  if (!aberto) return null;
  return <FormularioFatura key={fatura?.id ?? "nova"} fatura={fatura} aoFechar={aoFechar} />;
}

function FormularioFatura({ fatura, aoFechar }: { fatura: FaturaFornecedor | null; aoFechar: () => void }) {
  const { salvarFatura, excluirFatura } = useFinanceiro();
  const [numero, setNumero] = useState(fatura?.numero ?? "");
  const [de, setDe] = useState(fatura?.de ?? `${hoje().slice(0, 7)}-01`);
  const [ate, setAte] = useState(fatura?.ate ?? hoje());
  const [valor, setValor] = useState(fatura ? centavosParaCampo(fatura.valorCobrado) : "");
  const [observacoes, setObservacoes] = useState(fatura?.observacoes ?? "");
  const [erros, setErros] = useState<Erros>({});

  async function salvar() {
    const e: Erros = {};
    const centavos = parseBRL(valor);
    if (!de || !ate) e.periodo = "Informe o período de envios da fatura.";
    else if (de > ate) e.periodo = "O início precisa vir antes do fim.";
    if (centavos === null || centavos <= 0) e.valor = "Informe o valor cobrado na fatura.";
    setErros(e);
    if (Object.keys(e).length > 0 || centavos === null) return;

    const salva = await salvarFatura({
      id: fatura?.id,
      numero: numero.trim() || null,
      de,
      ate,
      valorCobrado: centavos,
      observacoes: observacoes.trim() || null,
    });
    if (!salva) return;
    toast.success(fatura ? "Fatura atualizada" : "Fatura lançada", {
      description: `Envios de ${formatDia(de)} a ${formatDia(ate)}, conferidos contra o previsto.`,
    });
    aoFechar();
  }

  return (
    <Modal open onOpenChange={(v) => !v && aoFechar()}>
      <ModalConteudo larguraMaxima="max-w-md">
        <ModalCabecalho
          titulo={fatura ? "Editar fatura" : "Conferir fatura"}
          descricao="Lance o que o fornecedor cobrou por um período de envios. A tela compara com o previsto."
        />
        <div className="flex flex-col gap-4">
          <Campo rotulo="Envios de" obrigatorio erro={erros.periodo}>
            <div className="flex items-center gap-2">
              <Input type="date" value={de} max={ate} onChange={(e) => setDe(e.target.value)} className="tabular" />
              <span className="text-xs text-muted-fg">até</span>
              <Input type="date" value={ate} min={de} onChange={(e) => setAte(e.target.value)} className="tabular" />
            </div>
          </Campo>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Valor cobrado" obrigatorio erro={erros.valor}>
              <Input
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                inputMode="decimal"
                placeholder="R$ 0,00"
                className="tabular"
                autoFocus
              />
            </Campo>
            <Campo rotulo="Número da nota" ajuda="Opcional.">
              <Input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="NF 15410" />
            </Campo>
          </div>
          <Campo rotulo="Observações">
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              className="min-h-16"
            />
          </Campo>
        </div>
        <ModalRodape>
          {fatura && (
            <Botao
              variante="perigo"
              className="sm:mr-auto"
              onClick={async () => {
                if (!(await excluirFatura(fatura.id))) return;
                toast.success("Fatura removida da conferência");
                aoFechar();
              }}
            >
              <Icone nome="excluir" size={15} />
              Remover
            </Botao>
          )}
          <Botao variante="secundaria" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao variante="principal" onClick={salvar}>
            <Icone nome="check" size={15} />
            {fatura ? "Salvar fatura" : "Conferir fatura"}
          </Botao>
        </ModalRodape>
      </ModalConteudo>
    </Modal>
  );
}
