"use client";

import { useState } from "react";
import type {
  CondicaoRecompensa,
  Metrica,
  Operador,
  PeriodoMeta,
  Recompensa,
  SetorPontuavel,
} from "@/lib/types";
import { centavosParaCampo, parseBRL } from "@/lib/format";
import { hoje } from "@/lib/periodos";
import { DEFINICAO_METRICA } from "@/lib/metricas";
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
import { ControleSegmentado } from "@/components/shared/controles";
import { CampoAtivo } from "./modais-catalogo";
import {
  campoDaMetrica,
  CampoCondicao,
  CampoPeriodo,
  valorDaMetrica,
} from "./modais-premiacao";

/**
 * Recompensa: um bônus em dinheiro liberado quando a condição fecha na janela.
 * Entra no fechamento do mês em que a janela terminou, junto com a comissão.
 */
export function ModalRecompensa({
  recompensa,
  aberto,
  aoFechar,
}: {
  recompensa: Recompensa | null;
  aberto: boolean;
  aoFechar: () => void;
}) {
  if (!aberto) return null;
  return <Formulario key={recompensa?.id ?? "nova"} recompensa={recompensa} aoFechar={aoFechar} />;
}

function Formulario({
  recompensa,
  aoFechar,
}: {
  recompensa: Recompensa | null;
  aoFechar: () => void;
}) {
  const { colaboradores, metas, salvarRecompensa, excluirRecompensa } = useEquipe();
  const pessoas = colaboradores.filter((c) => c.ativo && c.setor !== "administracao");

  const condicaoInicial = recompensa?.condicao;
  const [tipo, setTipo] = useState<CondicaoRecompensa["tipo"]>(condicaoInicial?.tipo ?? "meta");
  const [metaId, setMetaId] = useState(
    condicaoInicial?.tipo === "meta" ? condicaoInicial.metaId : (metas[0]?.id ?? ""),
  );
  const [metrica, setMetrica] = useState<Metrica>(
    condicaoInicial?.tipo === "metrica" ? condicaoInicial.metrica : "pontos",
  );
  const [operador, setOperador] = useState<Operador>(
    condicaoInicial?.tipo === "metrica" ? condicaoInicial.operador : "maior_igual",
  );
  const [valorCondicao, setValorCondicao] = useState(
    condicaoInicial?.tipo === "metrica"
      ? campoDaMetrica(condicaoInicial.metrica, condicaoInicial.valor)
      : "",
  );
  const [nome, setNome] = useState(recompensa?.nome ?? "");
  const [valor, setValor] = useState(centavosParaCampo(recompensa?.valor ?? null));
  const [periodo, setPeriodo] = useState<PeriodoMeta>(recompensa?.periodo ?? "mensal");
  const [alvoDe, setAlvoDe] = useState<"setor" | "pessoa">(recompensa?.colaboradorId ? "pessoa" : "setor");
  const [setor, setSetor] = useState<SetorPontuavel | null>(recompensa?.setor ?? null);
  const [colaboradorId, setColaboradorId] = useState(recompensa?.colaboradorId ?? "");
  const [vigenteDesde, setVigenteDesde] = useState(recompensa?.vigenteDesde ?? hoje());
  const [vigenteAte, setVigenteAte] = useState(recompensa?.vigenteAte ?? "");
  const [ativa, setAtiva] = useState(recompensa?.ativa ?? true);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [excluindo, setExcluindo] = useState(false);

  const meta = metas.find((m) => m.id === metaId) ?? null;
  const setorEfetivo =
    alvoDe === "pessoa"
      ? ((pessoas.find((c) => c.id === colaboradorId)?.setor ?? null) as SetorPontuavel | null)
      : setor;

  async function salvar() {
    const e: Record<string, string> = {};
    const centavos = parseBRL(valor);
    const numero = valorDaMetrica(metrica, valorCondicao);
    if (!nome.trim()) e.nome = "Dê um nome à recompensa.";
    if (centavos === null || centavos <= 0) e.valor = "Informe o valor do bônus.";
    if (tipo === "meta" && !metaId) e.metaId = "Escolha a meta.";
    if (tipo === "metrica" && numero === null) e.condicao = "Informe o valor da condição.";
    if (alvoDe === "pessoa" && !colaboradorId) e.colaboradorId = "Escolha o colaborador.";
    if (vigenteAte && vigenteAte < vigenteDesde) e.vigenteAte = "O fim vem depois do começo.";
    setErros(e);
    if (Object.keys(e).length > 0 || centavos === null) return;

    const condicao: CondicaoRecompensa =
      tipo === "meta"
        ? { tipo: "meta", metaId }
        : { tipo: "metrica", metrica, operador, valor: numero ?? 0 };

    const salva = await salvarRecompensa({
      id: recompensa?.id,
      nome: nome.trim(),
      valor: centavos,
      condicao,
      periodo: tipo === "meta" && meta ? meta.periodo : periodo,
      setor: alvoDe === "setor" ? setor : null,
      colaboradorId: alvoDe === "pessoa" ? colaboradorId : null,
      vigenteDesde,
      vigenteAte: vigenteAte || null,
      ativa,
    });
    if (!salva) return;
    toast.success(recompensa ? "Recompensa atualizada" : "Recompensa criada", {
      description: "Libera quando a janela fecha e entra no fechamento do mês.",
    });
    aoFechar();
  }

  return (
    <Modal open onOpenChange={(v) => !v && aoFechar()}>
      <ModalConteudo larguraMaxima="max-w-lg">
        <ModalCabecalho
          titulo={recompensa ? "Editar recompensa" : "Nova recompensa"}
          descricao="Bônus em dinheiro, conferido quando a janela fecha."
        />
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
            <Campo rotulo="Nome" obrigatorio erro={erros.nome}>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Bônus da meta do mês"
                autoFocus
              />
            </Campo>
            <Campo rotulo="Valor" obrigatorio erro={erros.valor}>
              <Input
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                inputMode="decimal"
                placeholder="R$ 200,00"
                className="tabular"
              />
            </Campo>
          </div>

          <Campo rotulo="Libera quando">
            <ControleSegmentado
              valor={tipo}
              aoMudar={(v) => setTipo(v as CondicaoRecompensa["tipo"])}
              opcoes={[
                { valor: "meta", rotulo: "Bater uma meta" },
                { valor: "metrica", rotulo: "Atingir uma métrica" },
              ]}
            />
          </Campo>

          {tipo === "meta" ? (
            <Campo
              rotulo="Meta"
              obrigatorio
              erro={erros.metaId}
              ajuda={meta ? `Janela: ${meta.periodo === "diaria" ? "diária" : meta.periodo === "semanal" ? "semanal" : "mensal"}, igual à da meta.` : "Cadastre uma meta antes."}
            >
              <Selecao value={metaId} onValueChange={setMetaId}>
                <SelecaoGatilho>
                  <SelecaoValor placeholder="Escolha a meta" />
                </SelecaoGatilho>
                <SelecaoConteudo>
                  {metas.map((m) => (
                    <SelecaoItem key={m.id} value={m.id}>
                      {m.nome}
                    </SelecaoItem>
                  ))}
                </SelecaoConteudo>
              </Selecao>
            </Campo>
          ) : (
            <>
              <CampoCondicao
                setor={setorEfetivo}
                metrica={metrica}
                operador={operador}
                valor={valorCondicao}
                erro={erros.condicao}
                aoMudar={(d) => {
                  setMetrica(d.metrica);
                  setOperador(d.operador);
                  setValorCondicao(d.valor);
                }}
              />
              <CampoPeriodo valor={periodo} aoMudar={setPeriodo} />
            </>
          )}

          <Campo rotulo="Para quem" erro={erros.colaboradorId}>
            <Selecao
              value={
                alvoDe === "setor"
                  ? setor
                    ? `setor:${setor}`
                    : "setor:todos"
                  : `pessoa:${colaboradorId}`
              }
              onValueChange={(v) => {
                const [t, id] = v.split(":");
                if (t === "setor") {
                  setAlvoDe("setor");
                  setSetor(id === "todos" ? null : (id as SetorPontuavel));
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
                <SelecaoItem value="setor:todos">Todo mundo</SelecaoItem>
                <SelecaoItem value="setor:vendas">Todos os vendedores</SelecaoItem>
                <SelecaoItem value="setor:financeiro">Todo o financeiro</SelecaoItem>
                {pessoas.map((c) => (
                  <SelecaoItem key={c.id} value={`pessoa:${c.id}`}>
                    {c.nome}
                  </SelecaoItem>
                ))}
              </SelecaoConteudo>
            </Selecao>
          </Campo>

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
            rotulo="Recompensa ativa"
            descricao="Inativa, deixa de liberar. O que já foi liberado continua a pagar."
          />
          {tipo === "metrica" && (
            <p className="text-xs text-muted-fg">
              {DEFINICAO_METRICA[metrica].descricao}
            </p>
          )}
        </div>
        <ModalRodape>
          {recompensa && (
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
            {recompensa ? "Salvar recompensa" : "Criar recompensa"}
          </Botao>
        </ModalRodape>
      </ModalConteudo>

      <ModalConfirmacao
        aberto={excluindo}
        titulo="Excluir recompensa"
        mensagem="Só dá para excluir recompensa que ninguém ganhou. Se alguém já ganhou, desative."
        perigo
        icone="excluir"
        rotuloConfirmar="Excluir"
        aoCancelar={() => setExcluindo(false)}
        aoConfirmar={async () => {
          if (recompensa && (await excluirRecompensa(recompensa.id))) {
            toast.success("Recompensa excluída");
            aoFechar();
          }
          setExcluindo(false);
        }}
      />
    </Modal>
  );
}
