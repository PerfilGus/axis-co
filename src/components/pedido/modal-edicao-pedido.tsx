"use client";

import { useEffect, useState } from "react";
import type { Pedido } from "@/lib/types";
import { centavosParaCampo, parseBRL } from "@/lib/format";
import { usePedidos } from "@/lib/providers/pedidos";
import { Icone } from "@/components/icone";
import { Botao } from "@/components/ui/button";
import { Modal, ModalCabecalho, ModalConteudo, ModalRodape } from "@/components/ui/dialog";
import { Campo } from "@/components/ui/label";
import { Input, Textarea } from "@/components/ui/input";
import { Caixa } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/toast";
import { AvisoSaude } from "@/components/shared/aviso-saude";
import {
  CamposCliente,
  clienteDoForm,
  formDoCliente,
  validarCliente,
  type DadosClienteForm,
  type ErrosCliente,
} from "./campos-cliente";

/**
 * Edição direta do pedido pelo Admin: cliente, endereço, valor e conferências.
 * Abrir busca CPF e telefone completos — e isso fica registrado.
 */
export function ModalEdicaoPedido({
  pedido,
  aberto,
  aoFechar,
}: {
  pedido: Pedido;
  aberto: boolean;
  aoFechar: () => void;
}) {
  if (!aberto) return null;
  return <Formulario key={pedido.id} pedido={pedido} aoFechar={aoFechar} />;
}

function Formulario({ pedido, aoFechar }: { pedido: Pedido; aoFechar: () => void }) {
  const { editar, revelarDados } = usePedidos();
  const [cliente, setCliente] = useState<DadosClienteForm | null>(null);
  const [valor, setValor] = useState(centavosParaCampo(pedido.valorTotal));
  const [observacoes, setObservacoes] = useState(pedido.observacoes ?? "");
  const [enderecoValidado, setEnderecoValidado] = useState(pedido.enderecoValidado);
  const [confirmacaoPorTexto, setConfirmacaoPorTexto] = useState(pedido.confirmacaoPorTexto);
  const [erros, setErros] = useState<ErrosCliente & { valor?: string }>({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let ativo = true;
    revelarDados([pedido.id]).then((dados) => {
      if (!ativo) return;
      const completos = dados?.[0];
      if (!completos) {
        aoFechar();
        return;
      }
      setCliente(formDoCliente({ ...pedido.cliente, telefone: completos.telefone, cpf: completos.cpf }));
    });
    return () => {
      ativo = false;
    };
    // Carrega uma vez por abertura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function salvar() {
    if (!cliente) return;
    const e: ErrosCliente & { valor?: string } = validarCliente(cliente);
    const centavos = parseBRL(valor);
    if (!centavos || centavos <= 0) e.valor = "Informe o valor do pedido.";
    setErros(e);
    if (Object.keys(e).length > 0 || !centavos) return;

    setSalvando(true);
    const salvo = await editar(pedido.id, {
      cliente: clienteDoForm(cliente, pedido.cliente.observacoes),
      observacoes: observacoes.trim() || null,
      valorTotal: centavos,
      enderecoValidado,
      confirmacaoPorTexto,
    });
    setSalvando(false);
    if (!salvo) return;
    toast.success(`Pedido ${pedido.codigo} atualizado`, { description: "A mudança ficou na linha do tempo." });
    aoFechar();
  }

  return (
    <Modal open onOpenChange={(v) => !v && aoFechar()}>
      <ModalConteudo larguraMaxima="max-w-3xl">
        <ModalCabecalho titulo={`Editar ${pedido.codigo}`} descricao="Correção direta pelo Admin. Tudo fica registrado." />

        {!cliente ? (
          <p className="py-8 text-center text-[13px] text-muted-fg">Carregando os dados do cliente…</p>
        ) : (
          <div className="flex flex-col gap-5">
            <CamposCliente
              dados={cliente}
              aoMudar={setCliente}
              erros={erros}
              aoLimparErro={(campo, mensagem) =>
                setErros((atual) => {
                  const resto = { ...atual };
                  if (mensagem) resto[campo] = mensagem;
                  else delete resto[campo];
                  return resto;
                })
              }
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <Campo rotulo="Valor do pedido" obrigatorio erro={erros.valor}>
                <Input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" className="tabular" />
              </Campo>
              <label className="flex items-center gap-3 sm:pt-6">
                <Caixa checked={enderecoValidado} onCheckedChange={(v) => setEnderecoValidado(v === true)} />
                <span className="text-[13px]">Endereço validado</span>
              </label>
              <label className="flex items-center gap-3 sm:pt-6">
                <Caixa checked={confirmacaoPorTexto} onCheckedChange={(v) => setConfirmacaoPorTexto(v === true)} />
                <span className="text-[13px]">Confirmado por texto</span>
              </label>
            </div>
            <Campo rotulo="Observações">
              <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
            </Campo>
            <AvisoSaude />
          </div>
        )}

        <ModalRodape>
          <Botao variante="secundaria" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao variante="principal" onClick={salvar} disabled={!cliente || salvando}>
            <Icone nome="check" size={15} />
            Salvar pedido
          </Botao>
        </ModalRodape>
      </ModalConteudo>
    </Modal>
  );
}
