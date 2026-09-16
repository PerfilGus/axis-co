"use client";

import { useState } from "react";
import type { Conquista, GatilhoConquista, Nivel } from "@/lib/types";
import { centavosParaCampo, formatBRL, parseBRL } from "@/lib/format";
import { useEquipe } from "@/lib/providers/equipe";
import { Icone, type NomeIcone } from "@/components/icone";
import { Botao } from "@/components/ui/button";
import { Modal, ModalCabecalho, ModalConteudo, ModalRodape } from "@/components/ui/dialog";
import { Campo } from "@/components/ui/label";
import { Input, Textarea } from "@/components/ui/input";
import {
  Selecao,
  SelecaoConteudo,
  SelecaoGatilho,
  SelecaoItem,
  SelecaoValor,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { CampoAtivo } from "./modais-catalogo";

type Erros = Record<string, string>;

export const ROTULO_GATILHO: Record<GatilhoConquista, { rotulo: string; icone: NomeIcone }> = {
  meta_diaria: { rotulo: "Meta diária batida", icone: "metas" },
  meta_semanal: { rotulo: "Meta semanal batida", icone: "tendencia" },
  meta_mensal: { rotulo: "Meta mensal batida", icone: "medalha" },
  domingo_feriado: { rotulo: "Trabalho em domingo ou feriado", icone: "calendario" },
  dias_trabalhados: { rotulo: "Dias trabalhados", icone: "relogio" },
  marco: { rotulo: "Marco único", icone: "aparencia" },
};

/* ================================================================
   Nível
   ================================================================ */

export function ModalNivel({
  nivel,
  aberto,
  aoFechar,
}: {
  nivel: Nivel | null;
  aberto: boolean;
  aoFechar: () => void;
}) {
  if (!aberto) return null;
  return <FormularioNivel key={nivel?.id ?? "novo"} nivel={nivel} aoFechar={aoFechar} />;
}

function FormularioNivel({ nivel, aoFechar }: { nivel: Nivel | null; aoFechar: () => void }) {
  const { niveis, salvarNivel, nomeDe } = useEquipe();
  const [nome, setNome] = useState(nivel?.nome ?? "");
  const [pontos, setPontos] = useState(nivel ? String(nivel.pontosNecessarios) : "");
  const [bonus, setBonus] = useState(centavosParaCampo(nivel?.bonus ?? null));
  const [erros, setErros] = useState<Erros>({});

  function salvar() {
    const e: Erros = {};
    const minimo = Number(pontos);
    if (!nome.trim()) e.nome = "Dê um nome ao nível.";
    if (pontos === "" || !Number.isFinite(minimo)) e.pontos = "Informe a pontuação mínima.";
    if (niveis.some((n) => n.id !== nivel?.id && n.pontosNecessarios === minimo)) {
      e.pontos = "Outro nível já começa nessa pontuação.";
    }
    const bonusCentavos = bonus.trim() === "" ? 0 : parseBRL(bonus);
    if (bonusCentavos === null || bonusCentavos < 0) e.bonus = "Valor inválido.";
    setErros(e);
    if (Object.keys(e).length > 0 || bonusCentavos === null) return;

    const liberados = salvarNivel({
      id: nivel?.id,
      nome: nome.trim(),
      pontosNecessarios: minimo,
      bonus: bonusCentavos,
      ordem: nivel?.ordem ?? niveis.length + 1,
      icone: nivel?.icone ?? "medalha",
    });
    toast.success(nivel ? "Nível atualizado" : "Nível criado", {
      description:
        liberados.length > 0
          ? `${liberados.map((b) => nomeDe(b.colaboradorId)).join(", ")} já alcançou e teve o bônus liberado.`
          : "A trilha foi reordenada pela pontuação mínima.",
    });
    aoFechar();
  }

  return (
    <Modal open onOpenChange={(v) => !v && aoFechar()}>
      <ModalConteudo larguraMaxima="max-w-md">
        <ModalCabecalho
          titulo={nivel ? `Editar ${nivel.nome}` : "Novo nível"}
          descricao="Quem chega à pontuação sobe de nível e tem o bônus liberado."
        />
        <div className="flex flex-col gap-4">
          <Campo rotulo="Nome" obrigatorio erro={erros.nome}>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ouro" autoFocus />
          </Campo>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Pontuação mínima" obrigatorio erro={erros.pontos}>
              <Input
                value={pontos}
                onChange={(e) => setPontos(e.target.value.replace(/\D/g, "").slice(0, 7))}
                inputMode="numeric"
                placeholder="1500"
                className="tabular"
              />
            </Campo>
            <Campo rotulo="Bônus ao alcançar" erro={erros.bonus} ajuda="Vazio = sem bônus.">
              <Input
                value={bonus}
                onChange={(e) => setBonus(e.target.value)}
                inputMode="decimal"
                placeholder="R$ 0,00"
                className="tabular"
              />
            </Campo>
          </div>
          <p className="text-xs text-muted-fg">
            Baixar a pontuação pode fazer alguém subir na hora. Ninguém é rebaixado, e o bônus de
            um nível só é liberado uma vez.
          </p>
        </div>
        <ModalRodape>
          <Botao variante="secundaria" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao variante="principal" onClick={salvar}>
            <Icone nome="check" size={15} />
            {nivel ? "Salvar nível" : "Criar nível"}
          </Botao>
        </ModalRodape>
      </ModalConteudo>
    </Modal>
  );
}

/* ================================================================
   Conquista
   ================================================================ */

export function ModalConquista({
  conquista,
  aberto,
  aoFechar,
}: {
  conquista: Conquista | null;
  aberto: boolean;
  aoFechar: () => void;
}) {
  if (!aberto) return null;
  return <FormularioConquista key={conquista?.id ?? "nova"} conquista={conquista} aoFechar={aoFechar} />;
}

function FormularioConquista({
  conquista,
  aoFechar,
}: {
  conquista: Conquista | null;
  aoFechar: () => void;
}) {
  const { salvarConquista } = useEquipe();
  const [nome, setNome] = useState(conquista?.nome ?? "");
  const [descricao, setDescricao] = useState(conquista?.descricao ?? "");
  const [gatilho, setGatilho] = useState<GatilhoConquista>(conquista?.gatilho ?? "meta_diaria");
  const [pontos, setPontos] = useState(conquista ? String(conquista.pontos) : "");
  const [criterio, setCriterio] = useState(conquista?.criterio ?? "");
  const [ativa, setAtiva] = useState(conquista?.ativa ?? true);
  const [erros, setErros] = useState<Erros>({});

  function salvar() {
    const e: Erros = {};
    if (!nome.trim()) e.nome = "Dê um nome à conquista.";
    if (!(Number(pontos) > 0)) e.pontos = "Quantos pontos ela vale?";
    setErros(e);
    if (Object.keys(e).length > 0) return;

    const salvo = salvarConquista({
      id: conquista?.id,
      nome: nome.trim(),
      descricao: descricao.trim(),
      gatilho,
      icone: ROTULO_GATILHO[gatilho].icone,
      pontos: Number(pontos),
      repetivel: gatilho !== "marco",
      criterio: criterio.trim() || ROTULO_GATILHO[gatilho].rotulo,
      ativa,
    });
    toast.success(conquista ? "Conquista atualizada" : "Conquista criada", {
      description: `${salvo.nome} vale ${salvo.pontos} pontos${salvo.repetivel ? " cada vez" : ""}.`,
    });
    aoFechar();
  }

  return (
    <Modal open onOpenChange={(v) => !v && aoFechar()}>
      <ModalConteudo larguraMaxima="max-w-md">
        <ModalCabecalho
          titulo={conquista ? "Editar conquista" : "Nova conquista"}
          descricao="Conquistas somam pontos, e os pontos sobem o colaborador de nível."
        />
        <div className="flex flex-col gap-4">
          <Campo rotulo="Nome" obrigatorio erro={erros.nome}>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Plantão" autoFocus />
          </Campo>
          <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
            <Campo rotulo="Quando pontua">
              <Selecao value={gatilho} onValueChange={(v) => setGatilho(v as GatilhoConquista)}>
                <SelecaoGatilho>
                  <SelecaoValor />
                </SelecaoGatilho>
                <SelecaoConteudo>
                  {(Object.keys(ROTULO_GATILHO) as GatilhoConquista[]).map((g) => (
                    <SelecaoItem key={g} value={g}>
                      {ROTULO_GATILHO[g].rotulo}
                    </SelecaoItem>
                  ))}
                </SelecaoConteudo>
              </Selecao>
            </Campo>
            <Campo rotulo="Pontos" obrigatorio erro={erros.pontos}>
              <Input
                value={pontos}
                onChange={(e) => setPontos(e.target.value.replace(/\D/g, "").slice(0, 5))}
                inputMode="numeric"
                placeholder="50"
                className="tabular"
              />
            </Campo>
          </div>
          <p className="-mt-2 text-xs text-muted-fg">
            {gatilho === "marco"
              ? "Marco único: pontua uma vez só por colaborador."
              : "Pontua toda vez que acontece."}
          </p>
          <Campo rotulo="Critério" ajuda="Opcional. Como a equipe entende a regra.">
            <Input
              value={criterio}
              onChange={(e) => setCriterio(e.target.value)}
              placeholder="Atividade registrada em domingo ou feriado"
            />
          </Campo>
          <Campo rotulo="Descrição" ajuda="Opcional. Aparece para o colaborador.">
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} className="min-h-16" />
          </Campo>
          <CampoAtivo
            ativo={ativa}
            aoMudar={setAtiva}
            rotulo="Conquista ativa"
            descricao="Inativa, deixa de pontuar. Os pontos já ganhos ficam."
          />
        </div>
        <ModalRodape>
          <Botao variante="secundaria" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao variante="principal" onClick={salvar}>
            <Icone nome="check" size={15} />
            {conquista ? "Salvar conquista" : "Criar conquista"}
          </Botao>
        </ModalRodape>
      </ModalConteudo>
    </Modal>
  );
}

/** `R$ 800,00` ou `Sem bônus`. */
export function rotuloBonus(valor: number): string {
  return valor > 0 ? formatBRL(valor) : "Sem bônus";
}
