"use client";

import { useState } from "react";
import type { Meta, Metrica, Operador, PeriodoMeta, SetorPontuavel } from "@/lib/types";
import { hoje } from "@/lib/periodos";
import { descreverCondicao, DEFINICAO_METRICA } from "@/lib/metricas";
import { useEquipe } from "@/lib/providers/equipe";
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
import { ModalConfirmacao } from "@/components/shared/modal-confirmacao";
import { CampoAtivo } from "@/components/config/modais-catalogo";
import {
  campoDaMetrica,
  CampoCondicao,
  CampoPeriodo,
  valorDaMetrica,
} from "@/components/config/modais-premiacao";

/**
 * Meta: uma métrica, um alvo e uma janela, para um setor inteiro ou para uma
 * pessoa. A vigência decide de quando em diante ela vale — mudar a meta não
 * mexe no que já passou.
 */
export function ModalMeta({
  meta,
  colaboradorId,
  aberto,
  aoFechar,
}: {
  meta: Meta | null;
  /** Pré-seleciona a pessoa quando a meta nasce na gaveta do colaborador. */
  colaboradorId: string | null;
  aberto: boolean;
  aoFechar: () => void;
}) {
  if (!aberto) return null;
  return (
    <Formulario
      key={meta?.id ?? `nova-${colaboradorId}`}
      meta={meta}
      colaboradorFixo={meta?.colaboradorId ?? colaboradorId}
      aoFechar={aoFechar}
    />
  );
}

function Formulario({
  meta,
  colaboradorFixo,
  aoFechar,
}: {
  meta: Meta | null;
  colaboradorFixo: string | null;
  aoFechar: () => void;
}) {
  const { colaboradores, salvarMeta, excluirMeta } = useEquipe();
  const pessoas = colaboradores.filter((c) => c.ativo && c.setor !== "administracao");
  const doColaborador = pessoas.find((c) => c.id === colaboradorFixo) ?? null;

  const [alvoDe, setAlvoDe] = useState<"setor" | "pessoa">(
    meta?.colaboradorId || colaboradorFixo ? "pessoa" : "setor",
  );
  const [colaboradorId, setColaboradorId] = useState(meta?.colaboradorId ?? colaboradorFixo ?? "");
  const [setor, setSetor] = useState<SetorPontuavel | null>(
    meta?.setor ?? ((doColaborador?.setor as SetorPontuavel | undefined) ?? "vendas"),
  );
  const [nome, setNome] = useState(meta?.nome ?? "");
  const [metrica, setMetrica] = useState<Metrica>(meta?.metrica ?? "agendados");
  const [operador, setOperador] = useState<Operador>(
    meta ? DEFINICAO_METRICA[meta.metrica].sentido : "maior_igual",
  );
  const [valor, setValor] = useState(meta ? campoDaMetrica(meta.metrica, meta.alvo) : "");
  const [periodo, setPeriodo] = useState<PeriodoMeta>(meta?.periodo ?? "diaria");
  const [vigenteDesde, setVigenteDesde] = useState(meta?.vigenteDesde ?? hoje());
  const [vigenteAte, setVigenteAte] = useState(meta?.vigenteAte ?? "");
  const [ativa, setAtiva] = useState(meta?.ativa ?? true);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [excluindo, setExcluindo] = useState(false);

  const setorEfetivo =
    alvoDe === "pessoa"
      ? ((pessoas.find((c) => c.id === colaboradorId)?.setor ?? null) as SetorPontuavel | null)
      : setor;
  const numero = valorDaMetrica(metrica, valor);

  async function salvar() {
    const e: Record<string, string> = {};
    if (!nome.trim()) e.nome = "Dê um nome à meta.";
    if (alvoDe === "pessoa" && !colaboradorId) e.colaboradorId = "Escolha o colaborador.";
    if (alvoDe === "setor" && !setor) e.setor = "Escolha o setor.";
    if (numero === null) e.valor = "Informe o alvo da meta.";
    if (vigenteAte && vigenteAte < vigenteDesde) e.vigenteAte = "O fim vem depois do começo.";
    setErros(e);
    if (Object.keys(e).length > 0 || numero === null) return;

    const salva = await salvarMeta({
      id: meta?.id,
      nome: nome.trim(),
      metrica,
      alvo: numero,
      periodo,
      setor: alvoDe === "setor" ? setor : null,
      colaboradorId: alvoDe === "pessoa" ? colaboradorId : null,
      vigenteDesde,
      vigenteAte: vigenteAte || null,
      ativa,
    });
    if (!salva) return;
    toast.success(meta ? "Meta atualizada" : "Meta criada", {
      description: `${salva.nome}: ${descreverCondicao(salva.metrica, operador, salva.alvo)}.`,
    });
    aoFechar();
  }

  return (
    <Modal open onOpenChange={(v) => !v && aoFechar()}>
      <ModalConteudo larguraMaxima="max-w-lg">
        <ModalCabecalho
          titulo={meta ? "Editar meta" : "Nova meta"}
          descricao="Vale a partir da vigência. Alterar a meta não recalcula janelas já fechadas."
        />
        <div className="flex flex-col gap-4">
          <Campo rotulo="Nome" obrigatorio erro={erros.nome}>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Meta do dia"
              autoFocus
            />
          </Campo>

          <Campo rotulo="Para quem" erro={erros.colaboradorId ?? erros.setor}>
            <div className="flex flex-col gap-3">
              <Selecao
                value={alvoDe === "setor" ? `setor:${setor ?? "vendas"}` : `pessoa:${colaboradorId}`}
                onValueChange={(v) => {
                  const [tipo, id] = v.split(":");
                  if (tipo === "setor") {
                    setAlvoDe("setor");
                    setSetor(id as SetorPontuavel);
                  } else {
                    setAlvoDe("pessoa");
                    setColaboradorId(id);
                  }
                }}
              >
                <SelecaoGatilho>
                  <SelecaoValor placeholder="Escolha o alvo" />
                </SelecaoGatilho>
                <SelecaoConteudo>
                  <SelecaoItem value="setor:vendas">Todos os vendedores</SelecaoItem>
                  <SelecaoItem value="setor:financeiro">Todo o financeiro</SelecaoItem>
                  {pessoas.map((c) => (
                    <SelecaoItem key={c.id} value={`pessoa:${c.id}`}>
                      {c.nome}
                    </SelecaoItem>
                  ))}
                </SelecaoConteudo>
              </Selecao>
            </div>
          </Campo>

          <CampoCondicao
            setor={setorEfetivo}
            metrica={metrica}
            operador={operador}
            valor={valor}
            erro={erros.valor}
            somenteMetas
            aoMudar={(d) => {
              setMetrica(d.metrica);
              setOperador(d.operador);
              setValor(d.valor);
            }}
          />

          <CampoPeriodo
            valor={periodo}
            aoMudar={setPeriodo}
            ajuda="A janela em que a meta é conferida."
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Vale a partir de" obrigatorio>
              <Input
                type="date"
                value={vigenteDesde}
                onChange={(e) => setVigenteDesde(e.target.value || hoje())}
                className="tabular"
              />
            </Campo>
            <Campo rotulo="Até" erro={erros.vigenteAte} ajuda="Vazio = sem fim.">
              <Input
                type="date"
                value={vigenteAte}
                onChange={(e) => setVigenteAte(e.target.value)}
                className="tabular"
              />
            </Campo>
          </div>

          <CampoAtivo
            ativo={ativa}
            aoMudar={setAtiva}
            rotulo="Meta ativa"
            descricao="Inativa, some da Minha área e deixa de liberar recompensa."
          />
        </div>
        <ModalRodape>
          {meta && (
            <Botao variante="fantasma" className="mr-auto" onClick={() => setExcluindo(true)}>
              <Icone nome="excluir" size={15} />
              Excluir
            </Botao>
          )}
          <Botao variante="secundaria" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao variante="principal" onClick={salvar}>
            <Icone nome="check" size={15} />
            {meta ? "Salvar meta" : "Criar meta"}
          </Botao>
        </ModalRodape>
      </ModalConteudo>

      <ModalConfirmacao
        aberto={excluindo}
        titulo="Excluir meta"
        mensagem="O histórico de quem bateu continua; a meta deixa de ser conferida."
        perigo
        icone="excluir"
        rotuloConfirmar="Excluir"
        aoCancelar={() => setExcluindo(false)}
        aoConfirmar={async () => {
          if (meta && (await excluirMeta(meta.id))) {
            toast.success("Meta excluída");
            aoFechar();
          }
          setExcluindo(false);
        }}
      />
    </Modal>
  );
}
