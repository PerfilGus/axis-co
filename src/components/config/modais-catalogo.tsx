"use client";

import { useState } from "react";
import type { Kit, Produto } from "@/lib/types";
import {
  centavosParaCampo,
  formatBRL,
  parseBRL,
} from "@/lib/format";
import { useCadastros } from "@/lib/providers/cadastros";
import { Icone } from "@/components/icone";
import { Botao } from "@/components/ui/button";
import { Modal, ModalCabecalho, ModalConteudo, ModalRodape } from "@/components/ui/dialog";
import { Campo } from "@/components/ui/label";
import { Input, Textarea } from "@/components/ui/input";
import { Interruptor } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { EnvioImagem } from "@/components/shared/envio-imagem";

type Erros = Record<string, string>;

/** Linha de liga/desliga com explicação, usada em todos os cadastros. */
export function CampoAtivo({
  ativo,
  aoMudar,
  rotulo,
  descricao,
}: {
  ativo: boolean;
  aoMudar: (ativo: boolean) => void;
  rotulo: string;
  descricao: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-[var(--radius-card-sm)] border border-border bg-surface-2 px-4 py-3">
      <span className="flex flex-col gap-0.5">
        <span className="text-[13px] font-medium">{rotulo}</span>
        <span className="text-xs text-muted-fg">{descricao}</span>
      </span>
      <Interruptor checked={ativo} onCheckedChange={aoMudar} />
    </label>
  );
}

/* ================================================================
   Produto
   ================================================================ */

export function ModalProduto({
  produto,
  aberto,
  aoFechar,
}: {
  /** `null` cria um produto novo. */
  produto: Produto | null;
  aberto: boolean;
  aoFechar: () => void;
}) {
  if (!aberto) return null;
  return <FormularioProduto key={produto?.id ?? "novo"} produto={produto} aoFechar={aoFechar} />;
}

function FormularioProduto({
  produto,
  aoFechar,
}: {
  produto: Produto | null;
  aoFechar: () => void;
}) {
  const { salvarProduto } = useCadastros();
  const [nome, setNome] = useState(produto?.nome ?? "");
  const [sabor, setSabor] = useState(produto?.sabor ?? "");
  const [gramas, setGramas] = useState(produto ? String(produto.gramas) : "");
  const [custo, setCusto] = useState(centavosParaCampo(produto?.custoUnitario ?? null));
  const [fotoUrl, setFotoUrl] = useState(produto?.fotoUrl ?? null);
  const [ativo, setAtivo] = useState(produto?.ativo ?? true);
  const [erros, setErros] = useState<Erros>({});

  function salvar() {
    const e: Erros = {};
    const custoCentavos = parseBRL(custo);
    const gramasNumero = Number(gramas.replace(/\D/g, ""));
    if (!nome.trim()) e.nome = "Dê um nome ao produto.";
    if (custoCentavos === null || custoCentavos <= 0) {
      e.custo = "Informe quanto custa um pote.";
    }
    setErros(e);
    if (Object.keys(e).length > 0 || custoCentavos === null) return;

    const salvo = salvarProduto({
      id: produto?.id,
      nome: nome.trim(),
      sabor: sabor.trim() || null,
      gramas: gramasNumero || 0,
      custoUnitario: custoCentavos,
      fotoUrl,
      ativo,
    });
    toast.success(produto ? "Produto atualizado" : "Produto cadastrado", {
      description: produto
        ? `${salvo.nome} já vale para os próximos cálculos de custo.`
        : `Agora cadastre os kits de ${salvo.nome}.`,
    });
    aoFechar();
  }

  return (
    <Modal open onOpenChange={(v) => !v && aoFechar()}>
      <ModalConteudo larguraMaxima="max-w-lg">
        <ModalCabecalho
          titulo={produto ? "Editar produto" : "Novo produto"}
          descricao="O custo do pote é a referência do custo de inadimplência."
        />
        <div className="flex flex-col gap-4">
          <EnvioImagem nome={nome} url={fotoUrl} aoMudar={setFotoUrl} rotulo="Enviar foto" />
          <Campo rotulo="Nome" obrigatorio erro={erros.nome}>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Colágeno Hidrolisado"
              autoFocus
            />
          </Campo>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Sabor" ajuda="Opcional.">
              <Input value={sabor} onChange={(e) => setSabor(e.target.value)} placeholder="Limão" />
            </Campo>
            <Campo rotulo="Peso do pote (g)" ajuda="Opcional.">
              <Input
                value={gramas}
                onChange={(e) => setGramas(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                placeholder="150"
              />
            </Campo>
          </div>
          <Campo
            rotulo="Custo do pote de referência"
            obrigatorio
            erro={erros.custo}
            ajuda="Quanto a operação paga por um pote. Entra no custo quando o pedido vira inadimplente."
          >
            <Input
              value={custo}
              onChange={(e) => setCusto(e.target.value)}
              inputMode="decimal"
              placeholder="R$ 0,00"
              className="tabular"
            />
          </Campo>
          <CampoAtivo
            ativo={ativo}
            aoMudar={setAtivo}
            rotulo="Produto ativo"
            descricao="Inativo, os kits dele somem do formulário de pedido."
          />
        </div>
        <ModalRodape>
          <Botao variante="secundaria" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao variante="principal" onClick={salvar}>
            <Icone nome="check" size={15} />
            {produto ? "Salvar produto" : "Cadastrar produto"}
          </Botao>
        </ModalRodape>
      </ModalConteudo>
    </Modal>
  );
}

/* ================================================================
   Kit
   ================================================================ */

export function ModalKit({
  kit,
  produto,
  aberto,
  aoFechar,
}: {
  /** `null` cria um kit novo para `produto`. */
  kit: Kit | null;
  produto: Produto | null;
  aberto: boolean;
  aoFechar: () => void;
}) {
  if (!aberto || !produto) return null;
  return (
    <FormularioKit key={kit?.id ?? `novo-${produto.id}`} kit={kit} produto={produto} aoFechar={aoFechar} />
  );
}

function FormularioKit({
  kit,
  produto,
  aoFechar,
}: {
  kit: Kit | null;
  produto: Produto;
  aoFechar: () => void;
}) {
  const { salvarKit } = useCadastros();
  const potesIniciais = kit?.itens.find((i) => i.produtoId === produto.id)?.quantidade;
  const [nome, setNome] = useState(kit?.nome ?? "");
  const [potes, setPotes] = useState(potesIniciais ? String(potesIniciais) : "");
  const [preco, setPreco] = useState(centavosParaCampo(kit?.precoTabela ?? null));
  const [piso, setPiso] = useState(centavosParaCampo(kit?.precoMinimo ?? null));
  const [frete, setFrete] = useState(centavosParaCampo(kit?.freteEstimado ?? null));
  const [descricao, setDescricao] = useState(kit?.descricao ?? "");
  const [ativo, setAtivo] = useState(kit?.ativo ?? true);
  const [erros, setErros] = useState<Erros>({});

  const quantidade = Number(potes) || 0;
  const precoCentavos = parseBRL(preco);
  const custoPotes = quantidade * produto.custoUnitario;

  function salvar() {
    const e: Erros = {};
    const pisoCentavos = parseBRL(piso) ?? precoCentavos;
    const freteCentavos = parseBRL(frete) ?? 0;
    if (!nome.trim()) e.nome = "Dê um nome ao kit, como “Kit 3 meses”.";
    if (quantidade < 1) e.potes = "O kit precisa de pelo menos um pote.";
    if (precoCentavos === null || precoCentavos <= 0) e.preco = "Informe o preço do kit.";
    if (precoCentavos !== null && pisoCentavos !== null && pisoCentavos > precoCentavos) {
      e.piso = "O piso não pode passar do preço de tabela.";
    }
    setErros(e);
    if (Object.keys(e).length > 0 || precoCentavos === null || pisoCentavos === null) return;

    // Mantém itens de outros produtos, se o kit já tiver: a estrutura aceita
    // mais de um produto, mesmo que este formulário edite só um.
    const outros = kit?.itens.filter((i) => i.produtoId !== produto.id) ?? [];
    const salvo = salvarKit({
      id: kit?.id,
      nome: nome.trim(),
      descricao: descricao.trim(),
      itens: [{ produtoId: produto.id, quantidade }, ...outros],
      precoTabela: precoCentavos,
      precoMinimo: pisoCentavos,
      freteEstimado: freteCentavos,
      ativo,
    });
    toast.success(kit ? "Kit atualizado" : "Kit cadastrado", {
      description: salvo.ativo
        ? `${salvo.nome} aparece no formulário de pedido por ${formatBRL(salvo.precoTabela)}.`
        : `${salvo.nome} fica fora do formulário de pedido enquanto inativo.`,
    });
    aoFechar();
  }

  return (
    <Modal open onOpenChange={(v) => !v && aoFechar()}>
      <ModalConteudo larguraMaxima="max-w-lg">
        <ModalCabecalho
          titulo={kit ? "Editar kit" : "Novo kit"}
          descricao={`Kit de ${produto.nome}. O pedido leva um kit.`}
        />
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
            <Campo rotulo="Nome" obrigatorio erro={erros.nome}>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Kit 3 meses"
                autoFocus
              />
            </Campo>
            <Campo rotulo="Potes" obrigatorio erro={erros.potes}>
              <Input
                value={potes}
                onChange={(e) => setPotes(e.target.value.replace(/\D/g, "").slice(0, 3))}
                inputMode="numeric"
                placeholder="3"
                className="tabular"
              />
            </Campo>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Preço" obrigatorio erro={erros.preco}>
              <Input
                value={preco}
                onChange={(e) => setPreco(e.target.value)}
                inputMode="decimal"
                placeholder="R$ 0,00"
                className="tabular"
              />
            </Campo>
            <Campo
              rotulo="Piso de negociação"
              erro={erros.piso}
              ajuda="Abaixo disso, o vendedor pede ajuste. Vazio = o próprio preço."
            >
              <Input
                value={piso}
                onChange={(e) => setPiso(e.target.value)}
                inputMode="decimal"
                placeholder="R$ 0,00"
                className="tabular"
              />
            </Campo>
          </div>
          <Campo rotulo="Frete estimado" ajuda="Somado ao valor cobrado do cliente.">
            <Input
              value={frete}
              onChange={(e) => setFrete(e.target.value)}
              inputMode="decimal"
              placeholder="R$ 0,00"
              className="tabular"
            />
          </Campo>
          <Campo rotulo="Descrição" ajuda="Opcional. Aparece para o vendedor ao escolher o kit.">
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="min-h-16"
              placeholder="Tratamento de 90 dias."
            />
          </Campo>

          {quantidade > 0 && precoCentavos !== null && precoCentavos > 0 && (
            <div className="flex flex-col gap-1.5 rounded-[var(--radius-card-sm)] border border-border bg-surface-2 px-4 py-3 text-[13px]">
              <div className="flex justify-between gap-4">
                <span className="text-muted-fg">
                  Custo dos potes ({quantidade} × {formatBRL(produto.custoUnitario)})
                </span>
                <span className="tabular">{formatBRL(custoPotes)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-fg">Preço por pote</span>
                <span className="tabular">{formatBRL(Math.round(precoCentavos / quantidade))}</span>
              </div>
            </div>
          )}

          <CampoAtivo
            ativo={ativo}
            aoMudar={setAtivo}
            rotulo="Kit ativo"
            descricao="Inativo, some do formulário de pedido. Pedidos antigos não mudam."
          />
        </div>
        <ModalRodape>
          <Botao variante="secundaria" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao variante="principal" onClick={salvar}>
            <Icone nome="check" size={15} />
            {kit ? "Salvar kit" : "Cadastrar kit"}
          </Botao>
        </ModalRodape>
      </ModalConteudo>
    </Modal>
  );
}
