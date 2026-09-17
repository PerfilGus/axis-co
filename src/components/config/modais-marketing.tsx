"use client";

import { useState } from "react";
import type { Criativo, FormatoCriativo, LinhaWhatsApp } from "@/lib/types";
import { RE_CODIGO_CRIATIVO, RE_VARIACAO_CRIATIVO, ROTULO_FORMATO } from "@/lib/types";
import { digitos, mascaraTelefone } from "@/lib/format";
import { useCadastros } from "@/lib/providers/cadastros";
import { useEquipe } from "@/lib/providers/equipe";
import { codigoCompleto } from "@/lib/criativos";
import { Icone } from "@/components/icone";
import { Botao } from "@/components/ui/button";
import { Modal, ModalCabecalho, ModalConteudo, ModalRodape } from "@/components/ui/dialog";
import { Campo } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Selecao,
  SelecaoConteudo,
  SelecaoGatilho,
  SelecaoItem,
  SelecaoValor,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { SelecaoMultipla } from "@/components/shared/selecao-multipla";
import { CampoAtivo } from "./modais-catalogo";

type Erros = Record<string, string>;

/* ================================================================
   Criativo
   ================================================================ */

export function ModalCriativo({
  criativo,
  aberto,
  aoFechar,
}: {
  criativo: Criativo | null;
  aberto: boolean;
  aoFechar: () => void;
}) {
  if (!aberto) return null;
  return <FormularioCriativo key={criativo?.id ?? "novo"} criativo={criativo} aoFechar={aoFechar} />;
}

function FormularioCriativo({
  criativo,
  aoFechar,
}: {
  criativo: Criativo | null;
  aoFechar: () => void;
}) {
  const { criativos, linhas, salvarCriativo } = useCadastros();
  const [codigo, setCodigo] = useState(criativo?.codigo ?? "");
  const [variacao, setVariacao] = useState(criativo?.variacao ?? "");
  const [nome, setNome] = useState(criativo?.nome ?? "");
  const [formato, setFormato] = useState<FormatoCriativo>(criativo?.formato ?? "video");
  const [linhaId, setLinhaId] = useState(criativo?.linhaWhatsappId ?? "");
  const [anuncio, setAnuncio] = useState(criativo?.anuncioMeta ?? "");
  const [ativo, setAtivo] = useState(criativo?.ativo ?? true);
  const [erros, setErros] = useState<Erros>({});

  async function salvar() {
    const e: Erros = {};
    const letra = variacao.trim().toUpperCase() || null;
    if (!RE_CODIGO_CRIATIVO.test(codigo)) {
      e.codigo = "Use cinco dígitos: dois do mês e três da sequência, como 09001.";
    } else if (Number(codigo.slice(0, 2)) < 1 || Number(codigo.slice(0, 2)) > 12) {
      e.codigo = "Os dois primeiros dígitos são o mês, de 01 a 12.";
    }
    if (letra && !RE_VARIACAO_CRIATIVO.test(letra)) e.variacao = "Uma letra só.";
    const repetido = criativos.find(
      (c) => c.id !== criativo?.id && c.codigo === codigo && (c.variacao ?? null) === letra,
    );
    if (!e.codigo && repetido) {
      e.codigo = `${codigoCompleto(repetido)} já é “${repetido.nome}”.`;
    }
    if (!nome.trim()) e.nome = "Dê um nome que a equipe reconheça.";
    if (!linhaId) e.linha = "Escolha a linha que recebe os leads deste criativo.";
    setErros(e);
    if (Object.keys(e).length > 0) return;

    const salvo = await salvarCriativo({
      id: criativo?.id,
      codigo,
      variacao: letra,
      nome: nome.trim(),
      formato,
      linhaWhatsappId: linhaId,
      anuncioMeta: anuncio.trim() || null,
      thumbUrl: criativo?.thumbUrl ?? null,
      ativo,
    });
    if (!salvo) return;
    toast.success(criativo ? "Criativo atualizado" : "Criativo cadastrado", {
      description: `${codigoCompleto(salvo)} · ${linhas.find((l) => l.id === linhaId)?.nome ?? ""}`,
    });
    aoFechar();
  }

  return (
    <Modal open onOpenChange={(v) => !v && aoFechar()}>
      <ModalConteudo larguraMaxima="max-w-lg">
        <ModalCabecalho
          titulo={criativo ? "Editar criativo" : "Novo criativo"}
          descricao="O código é o que aparece no anúncio e casa o lead com o criativo."
        />
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
            <Campo rotulo="Código (MM###)" obrigatorio erro={erros.codigo}>
              <Input
                value={codigo}
                onChange={(e) => setCodigo(digitos(e.target.value).slice(0, 5))}
                inputMode="numeric"
                placeholder="09001"
                className="tabular"
                autoFocus
              />
            </Campo>
            <Campo rotulo="Variação" erro={erros.variacao} ajuda="Opcional.">
              <Input
                value={variacao}
                onChange={(e) =>
                  setVariacao(e.target.value.replace(/[^a-zA-Z]/g, "").slice(0, 1).toUpperCase())
                }
                placeholder="B"
                className="tabular"
              />
            </Campo>
          </div>
          <Campo rotulo="Nome" obrigatorio erro={erros.nome}>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Depoimento Dona Marta"
            />
          </Campo>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Linha de WhatsApp" obrigatorio erro={erros.linha}>
              <Selecao value={linhaId} onValueChange={setLinhaId}>
                <SelecaoGatilho>
                  <SelecaoValor placeholder="Escolha a linha" />
                </SelecaoGatilho>
                <SelecaoConteudo>
                  {linhas.map((l) => (
                    <SelecaoItem key={l.id} value={l.id} disabled={!l.ativa && l.id !== linhaId}>
                      {l.nome}
                      {!l.ativa ? " (inativa)" : ""}
                    </SelecaoItem>
                  ))}
                </SelecaoConteudo>
              </Selecao>
            </Campo>
            <Campo rotulo="Formato">
              <Selecao value={formato} onValueChange={(v) => setFormato(v as FormatoCriativo)}>
                <SelecaoGatilho>
                  <SelecaoValor />
                </SelecaoGatilho>
                <SelecaoConteudo>
                  {(Object.keys(ROTULO_FORMATO) as FormatoCriativo[]).map((f) => (
                    <SelecaoItem key={f} value={f}>
                      {ROTULO_FORMATO[f]}
                    </SelecaoItem>
                  ))}
                </SelecaoConteudo>
              </Selecao>
            </Campo>
          </div>
          <Campo
            rotulo="Anúncio no Meta"
            ajuda="Opcional. ID ou nome do anúncio, guardado para o vínculo automático via API."
          >
            <Input
              value={anuncio}
              onChange={(e) => setAnuncio(e.target.value)}
              placeholder="6412880031455"
            />
          </Campo>
          <CampoAtivo
            ativo={ativo}
            aoMudar={setAtivo}
            rotulo="Criativo ativo"
            descricao="Inativo, sai do seletor do pedido. Pedidos antigos seguem ligados a ele."
          />
        </div>
        <ModalRodape>
          <Botao variante="secundaria" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao variante="principal" onClick={salvar}>
            <Icone nome="check" size={15} />
            {criativo ? "Salvar criativo" : "Cadastrar criativo"}
          </Botao>
        </ModalRodape>
      </ModalConteudo>
    </Modal>
  );
}

/* ================================================================
   Linha de WhatsApp
   ================================================================ */

export function ModalLinha({
  linha,
  aberto,
  aoFechar,
}: {
  linha: LinhaWhatsApp | null;
  aberto: boolean;
  aoFechar: () => void;
}) {
  if (!aberto) return null;
  return <FormularioLinha key={linha?.id ?? "nova"} linha={linha} aoFechar={aoFechar} />;
}

function FormularioLinha({
  linha,
  aoFechar,
}: {
  linha: LinhaWhatsApp | null;
  aoFechar: () => void;
}) {
  const { linhas, salvarLinha } = useCadastros();
  const { colaboradores } = useEquipe();
  const vendedores = colaboradores.filter((c) => c.setor === "vendas" && c.ativo);
  const [nome, setNome] = useState(linha?.nome ?? `WPP${linhas.length + 1}`);
  const [numero, setNumero] = useState(linha ? mascaraTelefone(linha.numero) : "");
  const [vendedoresIds, setVendedoresIds] = useState(linha?.vendedoresIds ?? []);
  const [ativa, setAtiva] = useState(linha?.ativa ?? true);
  const [erros, setErros] = useState<Erros>({});

  async function salvar() {
    const e: Erros = {};
    const nomeLimpo = nome.trim().toUpperCase();
    if (!nomeLimpo) e.nome = "Dê um nome curto, como WPP3.";
    if (linhas.some((l) => l.id !== linha?.id && l.nome.toUpperCase() === nomeLimpo)) {
      e.nome = `Já existe uma linha ${nomeLimpo}.`;
    }
    const d = digitos(numero);
    if (d.length < 10) e.numero = "Informe o número com DDD.";
    setErros(e);
    if (Object.keys(e).length > 0) return;

    if (!(await salvarLinha({ id: linha?.id, nome: nomeLimpo, numero: d, vendedoresIds, ativa }))) return;
    toast.success(linha ? "Linha atualizada" : "Linha cadastrada", {
      description:
        vendedoresIds.length > 0
          ? `Pedidos de quem atende ${nomeLimpo} saem ligados a ela.`
          : `${nomeLimpo} ainda não tem vendedor atendendo.`,
    });
    aoFechar();
  }

  return (
    <Modal open onOpenChange={(v) => !v && aoFechar()}>
      <ModalConteudo larguraMaxima="max-w-md">
        <ModalCabecalho
          titulo={linha ? "Editar linha" : "Nova linha de WhatsApp"}
          descricao="O número que recebe as conversas dos anúncios."
        />
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
            <Campo rotulo="Nome" obrigatorio erro={erros.nome}>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="WPP3" />
            </Campo>
            <Campo rotulo="Número" obrigatorio erro={erros.numero}>
              <Input
                value={numero}
                onChange={(e) => setNumero(mascaraTelefone(e.target.value))}
                inputMode="tel"
                placeholder="(11) 98700-0000"
                className="tabular"
              />
            </Campo>
          </div>
          <Campo rotulo="Vendedores que atendem" ajuda="O pedido do vendedor sai ligado a esta linha.">
            <SelecaoMultipla
              opcoes={vendedores.map((v) => ({ valor: v.id, rotulo: v.nome }))}
              valores={vendedoresIds}
              aoMudar={setVendedoresIds}
              vazio="Nenhum vendedor ativo cadastrado."
            />
          </Campo>
          <CampoAtivo
            ativo={ativa}
            aoMudar={setAtiva}
            rotulo="Linha ativa"
            descricao="Inativa, não recebe criativos novos."
          />
        </div>
        <ModalRodape>
          <Botao variante="secundaria" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao variante="principal" onClick={salvar}>
            <Icone nome="check" size={15} />
            {linha ? "Salvar linha" : "Cadastrar linha"}
          </Botao>
        </ModalRodape>
      </ModalConteudo>
    </Modal>
  );
}
