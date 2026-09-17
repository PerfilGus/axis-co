"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Conquista, Metrica, Nivel, Operador, PeriodoMeta, SetorPontuavel } from "@/lib/types";
import { ROTULO_PERIODO_META } from "@/lib/types";
import { centavosParaCampo, formatBRL, parseBRL } from "@/lib/format";
import { ehChaveCor, type ChaveCor } from "@/lib/cores";
import {
  DEFINICAO_METRICA,
  descreverCondicao,
  metricasDoSetor,
  ROTULO_OPERADOR,
} from "@/lib/metricas";
import { useEquipe } from "@/lib/providers/equipe";
import { Icone, type NomeIcone } from "@/components/icone";
import { Botao } from "@/components/ui/button";
import { Modal, ModalCabecalho, ModalConteudo, ModalRodape } from "@/components/ui/dialog";
import { Campo, Label } from "@/components/ui/label";
import { Input, Textarea } from "@/components/ui/input";
import {
  Selecao,
  SelecaoConteudo,
  SelecaoGatilho,
  SelecaoItem,
  SelecaoValor,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { ControleSegmentado } from "@/components/shared/controles";
import { ModalConfirmacao } from "@/components/shared/modal-confirmacao";
import { SeletorCor } from "@/components/shared/seletor-cor";
import { CampoAtivo } from "./modais-catalogo";

type Erros = Record<string, string>;

/** Ícones que servem para nível e conquista. */
export const ICONES_PREMIACAO: NomeIcone[] = [
  "medalha",
  "ranking",
  "metas",
  "tendencia",
  "escudo",
  "relogio",
  "calendario",
  "dinheiro",
  "pix",
  "pedidos",
  "cobranca",
  "checkCircle",
];

export function SeletorIcone({
  valor,
  aoMudar,
}: {
  valor: NomeIcone;
  aoMudar: (icone: NomeIcone) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Ícone" className="flex flex-wrap gap-2">
      {ICONES_PREMIACAO.map((icone) => (
        <button
          key={icone}
          type="button"
          role="radio"
          aria-checked={icone === valor}
          aria-label={icone}
          onClick={() => aoMudar(icone)}
          className={cn(
            "flex size-11 items-center justify-center rounded-full border-2 transition-colors",
            icone === valor
              ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
              : "border-transparent bg-surface-2 text-muted-fg hover:text-fg",
          )}
        >
          <Icone nome={icone} size={18} />
        </button>
      ))}
    </div>
  );
}

/** `R$ 800,00` ou `Sem bônus`. */
export function rotuloBonus(valor: number): string {
  return valor > 0 ? formatBRL(valor) : "Sem bônus";
}

/** Escolha de setor usada em conquistas, metas e recompensas. */
export function CampoSetor({
  valor,
  aoMudar,
  rotulo = "Para quem",
}: {
  valor: SetorPontuavel | null;
  aoMudar: (setor: SetorPontuavel | null) => void;
  rotulo?: string;
}) {
  return (
    <Campo rotulo={rotulo}>
      <ControleSegmentado
        valor={valor ?? "todos"}
        aoMudar={(v) => aoMudar(v === "todos" ? null : (v as SetorPontuavel))}
        opcoes={[
          { valor: "todos", rotulo: "Todos" },
          { valor: "vendas", rotulo: "Vendedores" },
          { valor: "financeiro", rotulo: "Financeiro" },
        ]}
      />
    </Campo>
  );
}

/**
 * Métrica + condição + valor: o mesmo trio na conquista, na meta e na
 * recompensa, para uma regra nunca significar coisas diferentes em telas
 * diferentes.
 */
export function CampoCondicao({
  setor,
  metrica,
  operador,
  valor,
  erro,
  somenteMetas = false,
  aoMudar,
}: {
  setor: SetorPontuavel | null;
  metrica: Metrica;
  operador: Operador;
  valor: string;
  erro?: string;
  somenteMetas?: boolean;
  aoMudar: (dados: { metrica: Metrica; operador: Operador; valor: string }) => void;
}) {
  const disponiveis = metricasDoSetor(setor, somenteMetas);
  const def = DEFINICAO_METRICA[metrica];
  const dica =
    def.unidade === "dinheiro" ? "R$ 1.000,00" : def.unidade === "taxa" ? "20%" : "10";

  return (
    <div className="flex flex-col gap-3">
      <Campo rotulo="O que conta" ajuda={def.descricao}>
        <Selecao
          value={metrica}
          onValueChange={(v) =>
            aoMudar({
              metrica: v as Metrica,
              operador: DEFINICAO_METRICA[v as Metrica].sentido,
              valor: "",
            })
          }
        >
          <SelecaoGatilho>
            <SelecaoValor />
          </SelecaoGatilho>
          <SelecaoConteudo>
            {disponiveis.map((m) => (
              <SelecaoItem key={m.chave} value={m.chave}>
                {m.rotulo}
              </SelecaoItem>
            ))}
          </SelecaoConteudo>
        </Selecao>
      </Campo>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
        <Campo rotulo="Condição">
          <Selecao
            value={operador}
            onValueChange={(v) => aoMudar({ metrica, operador: v as Operador, valor })}
          >
            <SelecaoGatilho>
              <SelecaoValor />
            </SelecaoGatilho>
            <SelecaoConteudo>
              {(Object.keys(ROTULO_OPERADOR) as Operador[]).map((o) => (
                <SelecaoItem key={o} value={o}>
                  {ROTULO_OPERADOR[o]}
                </SelecaoItem>
              ))}
            </SelecaoConteudo>
          </Selecao>
        </Campo>
        <Campo rotulo="Valor" obrigatorio erro={erro}>
          <Input
            value={valor}
            onChange={(e) => aoMudar({ metrica, operador, valor: e.target.value })}
            inputMode={def.unidade === "quantidade" ? "numeric" : "decimal"}
            className="tabular"
            placeholder={dica}
          />
        </Campo>
      </div>
    </div>
  );
}

/** Texto do campo → número na unidade da métrica. */
export function valorDaMetrica(metrica: Metrica, texto: string): number | null {
  const def = DEFINICAO_METRICA[metrica];
  if (def.unidade === "dinheiro") return parseBRL(texto);
  if (def.unidade === "taxa") {
    const limpo = texto.replace(/[^\d,.]/g, "").replace(",", ".");
    if (limpo === "") return null;
    const numero = Number(limpo);
    return Number.isFinite(numero) ? Math.round(numero * 100) : null;
  }
  const numero = Number(texto.replace(/\D/g, ""));
  return Number.isFinite(numero) && texto.trim() !== "" ? numero : null;
}

/** Número na unidade da métrica → texto do campo. */
export function campoDaMetrica(metrica: Metrica, valor: number): string {
  const def = DEFINICAO_METRICA[metrica];
  if (def.unidade === "dinheiro") return centavosParaCampo(valor);
  if (def.unidade === "taxa") return String(valor / 100).replace(".", ",");
  return String(valor);
}

export const PERIODOS: PeriodoMeta[] = ["diaria", "semanal", "mensal"];

export function CampoPeriodo({
  valor,
  aoMudar,
  rotulo = "Janela",
  ajuda,
}: {
  valor: PeriodoMeta;
  aoMudar: (periodo: PeriodoMeta) => void;
  rotulo?: string;
  ajuda?: string;
}) {
  return (
    <Campo rotulo={rotulo} ajuda={ajuda}>
      <ControleSegmentado
        valor={valor}
        aoMudar={aoMudar}
        opcoes={PERIODOS.map((p) => ({ valor: p, rotulo: ROTULO_PERIODO_META[p] }))}
      />
    </Campo>
  );
}

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
  const { niveis, salvarNivel, excluirNivel, nomeDe } = useEquipe();
  const [nome, setNome] = useState(nivel?.nome ?? "");
  const [pontos, setPontos] = useState(nivel ? String(nivel.pontosNecessarios) : "");
  const [bonus, setBonus] = useState(centavosParaCampo(nivel?.bonus ?? null));
  const [beneficio, setBeneficio] = useState(nivel?.beneficio ?? "");
  const [icone, setIcone] = useState<NomeIcone>((nivel?.icone as NomeIcone) ?? "medalha");
  const [cor, setCor] = useState<ChaveCor | null>(
    nivel?.cor && ehChaveCor(nivel.cor) ? nivel.cor : null,
  );
  const [erros, setErros] = useState<Erros>({});
  const [excluindo, setExcluindo] = useState(false);

  async function salvar() {
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

    const liberados = await salvarNivel({
      id: nivel?.id,
      nome: nome.trim(),
      pontosNecessarios: minimo,
      bonus: bonusCentavos,
      ordem: nivel?.ordem ?? niveis.length + 1,
      icone,
      cor,
      beneficio: beneficio.trim(),
    });
    if (!liberados) return;
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
      <ModalConteudo larguraMaxima="max-w-lg">
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
          <Campo rotulo="Benefício do nível" ajuda="Opcional. Aparece para o colaborador.">
            <Input
              value={beneficio}
              onChange={(e) => setBeneficio(e.target.value)}
              placeholder="Folga no aniversário"
            />
          </Campo>
          <div className="flex flex-col gap-2">
            <Label>Ícone</Label>
            <SeletorIcone valor={icone} aoMudar={setIcone} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Cor do nível</Label>
            <SeletorCor valor={cor} aoMudar={setCor} rotulo="Cor do nível" />
          </div>
          <p className="text-xs text-muted-fg">
            Perdendo pontos, alguém pode cair de nível — a tolerância fica na aba Pontuação. O
            bônus de um nível é pago uma vez só.
          </p>
        </div>
        <ModalRodape>
          {nivel && (
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
            {nivel ? "Salvar nível" : "Criar nível"}
          </Botao>
        </ModalRodape>
      </ModalConteudo>

      <ModalConfirmacao
        aberto={excluindo}
        titulo="Excluir nível"
        mensagem="Quem está nele é reavaliado pela pontuação. Nível que já liberou bônus não pode ser excluído."
        perigo
        icone="excluir"
        rotuloConfirmar="Excluir"
        aoCancelar={() => setExcluindo(false)}
        aoConfirmar={async () => {
          if (nivel && (await excluirNivel(nivel.id))) {
            toast.success("Nível excluído");
            aoFechar();
          }
          setExcluindo(false);
        }}
      />
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
  const { salvarConquista, excluirConquista } = useEquipe();
  const [nome, setNome] = useState(conquista?.nome ?? "");
  const [descricao, setDescricao] = useState(conquista?.descricao ?? "");
  const [setor, setSetor] = useState<SetorPontuavel | null>(conquista?.setor ?? null);
  const [metrica, setMetrica] = useState<Metrica>(conquista?.metrica ?? "agendados");
  const [operador, setOperador] = useState<Operador>(conquista?.operador ?? "maior_igual");
  const [valor, setValor] = useState(
    conquista ? campoDaMetrica(conquista.metrica, conquista.valor) : "",
  );
  const [periodo, setPeriodo] = useState<PeriodoMeta>(conquista?.periodo ?? "diaria");
  const [pontos, setPontos] = useState(conquista ? String(conquista.pontos) : "");
  const [repetivel, setRepetivel] = useState(conquista?.repetivel ?? true);
  const [icone, setIcone] = useState<NomeIcone>((conquista?.icone as NomeIcone) ?? "medalha");
  const [ativa, setAtiva] = useState(conquista?.ativa ?? true);
  const [erros, setErros] = useState<Erros>({});
  const [excluindo, setExcluindo] = useState(false);

  const numero = valorDaMetrica(metrica, valor);

  async function salvar() {
    const e: Erros = {};
    if (!nome.trim()) e.nome = "Dê um nome à conquista.";
    if (numero === null) e.valor = "Informe o valor da condição.";
    if (!(Number(pontos) > 0)) e.pontos = "Quantos pontos ela vale?";
    setErros(e);
    if (Object.keys(e).length > 0 || numero === null) return;

    const salvo = await salvarConquista({
      id: conquista?.id,
      nome: nome.trim(),
      descricao: descricao.trim(),
      icone,
      metrica,
      operador,
      valor: numero,
      periodo,
      setor,
      pontos: Number(pontos),
      repetivel,
      ativa,
    });
    if (!salvo) return;
    toast.success(conquista ? "Conquista atualizada" : "Conquista criada", {
      description: `${salvo.nome} vale ${salvo.pontos} pontos${salvo.repetivel ? " a cada janela" : ", uma vez só"}.`,
    });
    aoFechar();
  }

  return (
    <Modal open onOpenChange={(v) => !v && aoFechar()}>
      <ModalConteudo larguraMaxima="max-w-lg">
        <ModalCabecalho
          titulo={conquista ? "Editar conquista" : "Nova conquista"}
          descricao="A conquista é conferida quando a janela fecha; os pontos entram no extrato."
        />
        <div className="flex flex-col gap-4">
          <Campo rotulo="Nome" obrigatorio erro={erros.nome}>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Dia cheio" autoFocus />
          </Campo>

          <CampoSetor
            valor={setor}
            aoMudar={(novo) => {
              setSetor(novo);
              const permitidas = metricasDoSetor(novo).map((m) => m.chave);
              if (!permitidas.includes(metrica)) {
                setMetrica(permitidas[0] ?? "pontos");
                setValor("");
              }
            }}
          />

          <CampoCondicao
            setor={setor}
            metrica={metrica}
            operador={operador}
            valor={valor}
            erro={erros.valor}
            aoMudar={(d) => {
              setMetrica(d.metrica);
              setOperador(d.operador);
              setValor(d.valor);
            }}
          />

          <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
            <CampoPeriodo valor={periodo} aoMudar={setPeriodo} />
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

          <div className="flex flex-col gap-2">
            <Label>Ícone</Label>
            <SeletorIcone valor={icone} aoMudar={setIcone} />
          </div>

          <Campo rotulo="Descrição" ajuda="Opcional. Aparece para o colaborador.">
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} className="min-h-16" />
          </Campo>

          <CampoAtivo
            ativo={repetivel}
            aoMudar={setRepetivel}
            rotulo="Repetível"
            descricao="Pontua uma vez por janela. Desligada, pontua uma vez na vida."
          />
          <CampoAtivo
            ativo={ativa}
            aoMudar={setAtiva}
            rotulo="Conquista ativa"
            descricao="Inativa, deixa de pontuar. Os pontos já ganhos ficam."
          />
          <p className="text-xs text-muted-fg">
            Fica assim: {descreverCondicao(metrica, operador, numero ?? 0)},{" "}
            {periodo === "diaria" ? "no dia" : periodo === "semanal" ? "na semana" : "no mês"}.
          </p>
        </div>
        <ModalRodape>
          {conquista && (
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
            {conquista ? "Salvar conquista" : "Criar conquista"}
          </Botao>
        </ModalRodape>
      </ModalConteudo>

      <ModalConfirmacao
        aberto={excluindo}
        titulo="Excluir conquista"
        mensagem="Só dá para excluir conquista que ninguém ganhou. Se alguém já ganhou, desative."
        perigo
        icone="excluir"
        rotuloConfirmar="Excluir"
        aoCancelar={() => setExcluindo(false)}
        aoConfirmar={async () => {
          if (conquista && (await excluirConquista(conquista.id))) {
            toast.success("Conquista excluída");
            aoFechar();
          }
          setExcluindo(false);
        }}
      />
    </Modal>
  );
}
