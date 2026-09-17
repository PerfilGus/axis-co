"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { AdicionalPontos, Kit, RegraPontuacao, SetorPontuavel } from "@/lib/types";
import {
  bpsParaCampo,
  centavosParaCampo,
  formatBps,
  formatBRL,
  formatNumero,
  parseBRL,
  parsePercentual,
} from "@/lib/format";
import { formatData } from "@/lib/format";
import { hoje, isoDoDia, somarDias } from "@/lib/periodos";
import { regraAgendada, regraVigente, REGRA_PADRAO, simular } from "@/lib/pontos";
import { useCadastros } from "@/lib/providers/cadastros";
import { useEquipe } from "@/lib/providers/equipe";
import { Icone } from "@/components/icone";
import { Botao } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Campo, Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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

/**
 * Regra de pontuação de um setor e o simulador ao lado.
 *
 * Salvar cria uma versão com data de vigência — o passado não é recalculado.
 * O simulador usa exatamente as funções do motor (`lib/pontos.ts`), então o
 * número mostrado aqui é o que o pedido vai gerar depois.
 */

const ROTULO_ADICIONAL: Record<AdicionalPontos, string> = {
  nenhum: "Só o valor fixo",
  faixa_valor: "Fixo + faixa de valor do pedido",
  kit: "Fixo + pontos por kit",
};

interface FaixaEditavel {
  minimo: string;
  pontos: string;
}

function paraFormulario(regra: RegraPontuacao | null) {
  return {
    pontosFixos: String(regra?.pontosFixos ?? REGRA_PADRAO.pontosFixos),
    adicional: regra?.adicional ?? REGRA_PADRAO.adicional,
    faixas: (regra?.faixasValor ?? []).map((f) => ({
      minimo: centavosParaCampo(f.minimo),
      pontos: String(f.pontos),
    })),
    porKit: Object.fromEntries((regra?.pontosPorKit ?? []).map((k) => [k.kitId, String(k.pontos)])),
    penalidade: bpsParaCampo(regra?.penalidadeBps ?? REGRA_PADRAO.penalidadeBps),
    queda: bpsParaCampo(regra?.quedaNivelBps ?? REGRA_PADRAO.quedaNivelBps),
  };
}

export function EditorPontuacao() {
  const { regras, niveis, salvarRegra, excluirRegra } = useEquipe();
  const { kits } = useCadastros();
  const [setor, setSetor] = useState<SetorPontuavel>("vendas");

  const dia = hoje();
  const vigente = regraVigente(regras, setor, dia);
  const agendada = regraAgendada(regras, setor, dia);

  return (
    <div className="flex flex-col gap-4">
      <ControleSegmentado
        valor={setor}
        aoMudar={setSetor}
        opcoes={[
          { valor: "vendas", rotulo: "Vendedor", icone: "pedidos" },
          { valor: "financeiro", rotulo: "Financeiro", icone: "cobranca" },
        ]}
      />
      <Formulario
        key={`${setor}-${vigente?.id ?? "nova"}-${agendada?.id ?? ""}`}
        setor={setor}
        vigente={vigente}
        agendada={agendada}
        kits={kits}
        niveis={niveis}
        salvar={salvarRegra}
        excluir={excluirRegra}
      />
    </div>
  );
}

function Formulario({
  setor,
  vigente,
  agendada,
  kits,
  niveis,
  salvar,
  excluir,
}: {
  setor: SetorPontuavel;
  vigente: RegraPontuacao | null;
  agendada: RegraPontuacao | null;
  kits: Kit[];
  niveis: ReturnType<typeof useEquipe>["niveis"];
  salvar: ReturnType<typeof useEquipe>["salvarRegra"];
  excluir: ReturnType<typeof useEquipe>["excluirRegra"];
}) {
  const base = agendada ?? vigente;
  const inicial = paraFormulario(base);
  const [pontosFixos, setPontosFixos] = useState(inicial.pontosFixos);
  const [adicional, setAdicional] = useState<AdicionalPontos>(inicial.adicional);
  const [faixas, setFaixas] = useState<FaixaEditavel[]>(inicial.faixas);
  const [porKit, setPorKit] = useState<Record<string, string>>(inicial.porKit);
  const [penalidade, setPenalidade] = useState(inicial.penalidade);
  const [queda, setQueda] = useState(inicial.queda);
  const [vigenteDesde, setVigenteDesde] = useState(agendada?.vigenteDesde ?? hoje());
  const [erros, setErros] = useState<Record<string, string>>({});
  const [confirmando, setConfirmando] = useState(false);
  const [cancelando, setCancelando] = useState(false);

  const kitsAtivos = kits.filter((k) => k.ativo);

  const regraDoFormulario = useMemo(() => {
    const penalidadeBps = parsePercentual(penalidade) ?? 0;
    const quedaNivelBps = parsePercentual(queda) ?? 0;
    return {
      pontosFixos: Number(pontosFixos) || 0,
      adicional,
      faixasValor: faixas
        .map((f) => ({ minimo: parseBRL(f.minimo) ?? 0, pontos: Number(f.pontos) || 0 }))
        .sort((a, b) => a.minimo - b.minimo),
      pontosPorKit: Object.entries(porKit)
        .filter(([, v]) => Number(v) > 0)
        .map(([kitId, v]) => ({ kitId, pontos: Number(v) })),
      penalidadeBps,
      quedaNivelBps,
    };
  }, [pontosFixos, adicional, faixas, porKit, penalidade, queda]);

  function validar(): boolean {
    const e: Record<string, string> = {};
    if (!(Number(pontosFixos) >= 0)) e.pontosFixos = "Informe quantos pontos o pedido vale.";
    const p = parsePercentual(penalidade);
    if (p === null || p < 0 || p > 10_000) e.penalidade = "Use um percentual de 0 a 100.";
    const q = parsePercentual(queda);
    if (q === null || q < 0 || q > 10_000) e.queda = "Use um percentual de 0 a 100.";
    if (vigenteDesde < hoje()) e.vigenteDesde = "A vigência começa hoje ou depois.";
    if (adicional === "faixa_valor" && regraDoFormulario.faixasValor.length === 0) {
      e.faixas = "Cadastre pelo menos uma faixa, ou escolha só o valor fixo.";
    }
    setErros(e);
    return Object.keys(e).length === 0;
  }

  async function gravar() {
    const salva = await salvar({ ...regraDoFormulario, setor, vigenteDesde });
    if (!salva) return;
    setConfirmando(false);
    toast.success(
      salva.vigenteDesde <= hoje() ? "Pontuação atualizada" : "Pontuação agendada",
      {
        description:
          salva.vigenteDesde <= hoje()
            ? "Vale para os eventos de hoje em diante. O que já foi lançado não muda."
            : `Passa a valer em ${formatData(isoDoDia(salva.vigenteDesde))}.`,
      },
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
      <Card className="flex flex-col gap-5 p-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-medium tracking-tight">
            Pontos por pedido · {setor === "vendas" ? "vendedor" : "financeiro"}
          </h2>
          <p className="text-[13px] text-muted-fg">
            {setor === "vendas"
              ? "O vendedor ganha ao agendar. Cancelado estorna tudo; frustrado tira a porcentagem abaixo."
              : "O cobrador ganha quando o pedido é pago. Cancelado não gera nada; frustrado tira a porcentagem do que valeria pago."}
          </p>
          {vigente ? (
            <p className="text-xs text-muted-fg">
              Valendo desde {formatData(isoDoDia(vigente.vigenteDesde))}
              {agendada && ` · nova versão marcada para ${formatData(isoDoDia(agendada.vigenteDesde))}`}
            </p>
          ) : (
            <p className="text-xs text-[var(--accent)]">
              Ainda sem regra: nada pontua até você salvar a primeira.
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Pontos por pedido" obrigatorio erro={erros.pontosFixos}>
            <Input
              value={pontosFixos}
              onChange={(e) => setPontosFixos(e.target.value.replace(/\D/g, "").slice(0, 5))}
              inputMode="numeric"
              className="tabular"
              placeholder="10"
            />
          </Campo>
          <Campo
            rotulo="Penalidade do frustrado"
            obrigatorio
            erro={erros.penalidade}
            ajuda="Quanto o pedido frustrado tira dos pontos."
          >
            <Input
              value={penalidade}
              onChange={(e) => setPenalidade(e.target.value)}
              inputMode="decimal"
              className="tabular"
              placeholder="50%"
            />
          </Campo>
        </div>

        <Campo rotulo="Além do valor fixo">
          <Selecao value={adicional} onValueChange={(v) => setAdicional(v as AdicionalPontos)}>
            <SelecaoGatilho>
              <SelecaoValor />
            </SelecaoGatilho>
            <SelecaoConteudo>
              {(Object.keys(ROTULO_ADICIONAL) as AdicionalPontos[]).map((a) => (
                <SelecaoItem key={a} value={a}>
                  {ROTULO_ADICIONAL[a]}
                </SelecaoItem>
              ))}
            </SelecaoConteudo>
          </Selecao>
        </Campo>

        {adicional === "faixa_valor" && (
          <div className="flex flex-col gap-2">
            <Label>Faixas por valor do pedido</Label>
            {erros.faixas && <p className="text-xs text-[var(--st-vermelho-fg)]">{erros.faixas}</p>}
            {faixas.map((faixa, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={faixa.minimo}
                  onChange={(e) =>
                    setFaixas((atual) => atual.map((f, j) => (j === i ? { ...f, minimo: e.target.value } : f)))
                  }
                  inputMode="decimal"
                  className="tabular"
                  placeholder="A partir de R$ 0,00"
                />
                <Input
                  value={faixa.pontos}
                  onChange={(e) =>
                    setFaixas((atual) =>
                      atual.map((f, j) =>
                        j === i ? { ...f, pontos: e.target.value.replace(/\D/g, "").slice(0, 5) } : f,
                      ),
                    )
                  }
                  inputMode="numeric"
                  className="tabular w-24"
                  placeholder="+ pts"
                />
                <Botao
                  variante="fantasma"
                  tamanho="iconeSm"
                  aria-label="Remover faixa"
                  onClick={() => setFaixas((atual) => atual.filter((_, j) => j !== i))}
                >
                  <Icone nome="remover" size={14} />
                </Botao>
              </div>
            ))}
            <Botao
              variante="secundaria"
              tamanho="sm"
              className="self-start"
              onClick={() => setFaixas((atual) => [...atual, { minimo: "", pontos: "" }])}
            >
              <Icone nome="adicionar" size={14} />
              Adicionar faixa
            </Botao>
          </div>
        )}

        {adicional === "kit" && (
          <div className="flex flex-col gap-2">
            <Label>Pontos por kit</Label>
            {kitsAtivos.length === 0 ? (
              <p className="text-[13px] text-muted-fg">Nenhum kit ativo cadastrado.</p>
            ) : (
              kitsAtivos.map((kit) => (
                <div key={kit.id} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 flex-1 truncate text-[13px]">
                    {kit.nome}
                    <span className="tabular text-muted-fg"> · {formatBRL(kit.precoTabela)}</span>
                  </span>
                  <Input
                    value={porKit[kit.id] ?? ""}
                    onChange={(e) =>
                      setPorKit((atual) => ({
                        ...atual,
                        [kit.id]: e.target.value.replace(/\D/g, "").slice(0, 5),
                      }))
                    }
                    inputMode="numeric"
                    className="tabular w-24"
                    placeholder="+ pts"
                  />
                </div>
              ))
            )}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            rotulo="Tolerância de queda de nível"
            obrigatorio
            erro={erros.queda}
            ajuda="Perdendo pontos, cai quem ficar com esse progresso ou menos na faixa do nível anterior."
          >
            <Input
              value={queda}
              onChange={(e) => setQueda(e.target.value)}
              inputMode="decimal"
              className="tabular"
              placeholder="80%"
            />
          </Campo>
          <Campo rotulo="Vale a partir de" obrigatorio erro={erros.vigenteDesde}>
            <Input
              type="date"
              value={vigenteDesde}
              min={hoje()}
              onChange={(e) => setVigenteDesde(e.target.value || hoje())}
              className="tabular"
            />
          </Campo>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Botao variante="principal" onClick={() => validar() && setConfirmando(true)}>
            <Icone nome="check" size={15} />
            {vigenteDesde <= hoje() ? "Salvar e valer hoje" : "Agendar versão"}
          </Botao>
          <Botao variante="secundaria" onClick={() => setVigenteDesde(somarDias(hoje(), 1))}>
            Começar amanhã
          </Botao>
          {agendada && (
            <Botao variante="fantasma" onClick={() => setCancelando(true)}>
              Cancelar versão agendada
            </Botao>
          )}
        </div>
      </Card>

      <Simulador setor={setor} regra={regraDoFormulario} kits={kitsAtivos} niveis={niveis} />

      <ModalConfirmacao
        aberto={confirmando}
        titulo={vigenteDesde <= hoje() ? "Passar a valer hoje" : "Agendar nova pontuação"}
        mensagem="Vale para os eventos a partir da vigência. Nada do que já foi lançado é recalculado."
        itens={[
          `${setor === "vendas" ? "Vendedor" : "Financeiro"}: ${regraDoFormulario.pontosFixos} pontos por pedido`,
          `Frustrado perde ${formatBps(regraDoFormulario.penalidadeBps, 0)} dos pontos`,
          `Vigência a partir de ${formatData(isoDoDia(vigenteDesde))}`,
        ]}
        icone="metas"
        rotuloConfirmar="Salvar pontuação"
        aoCancelar={() => setConfirmando(false)}
        aoConfirmar={gravar}
      />

      <ModalConfirmacao
        aberto={cancelando}
        titulo="Cancelar a versão agendada"
        mensagem="A regra que já está valendo continua como está."
        perigo
        icone="excluir"
        rotuloConfirmar="Cancelar versão"
        aoCancelar={() => setCancelando(false)}
        aoConfirmar={async () => {
          if (agendada && (await excluir(agendada.id))) {
            toast.success("Versão agendada cancelada");
          }
          setCancelando(false);
        }}
      />
    </div>
  );
}

/* ================================================================
   Simulador
   ================================================================ */

function Simulador({
  setor,
  regra,
  kits,
  niveis,
}: {
  setor: SetorPontuavel;
  regra: Parameters<typeof simular>[0]["regra"];
  kits: Kit[];
  niveis: ReturnType<typeof useEquipe>["niveis"];
}) {
  const [agendados, setAgendados] = useState("20");
  const [pagos, setPagos] = useState("14");
  const [cancelados, setCancelados] = useState("3");
  const [frustrados, setFrustrados] = useState("3");
  const [valor, setValor] = useState(centavosParaCampo(kits[0]?.precoTabela ?? 19_900));
  const [kitId, setKitId] = useState(kits[0]?.id ?? "");
  const [pontosIniciais, setPontosIniciais] = useState("0");

  const trilha = [...niveis].sort((a, b) => a.ordem - b.ordem);
  const resultado = simular({
    setor,
    regra,
    pedido: { valorTotal: parseBRL(valor) ?? 0, itens: kitId ? [{ kitId, quantidade: 1 }] : [] },
    agendados: Number(agendados) || 0,
    pagos: Number(pagos) || 0,
    cancelados: Number(cancelados) || 0,
    frustrados: Number(frustrados) || 0,
    pontosIniciais: Number(pontosIniciais) || 0,
    niveis: trilha,
    nivelAtualId: trilha[0]?.id ?? null,
  });

  const numero = (valor: string, set: (v: string) => void, rotulo: string) => (
    <Campo rotulo={rotulo}>
      <Input
        value={valor}
        onChange={(e) => set(e.target.value.replace(/\D/g, "").slice(0, 4))}
        inputMode="numeric"
        className="tabular"
      />
    </Campo>
  );

  return (
    <Card className="flex flex-col gap-5 p-5">
      <div className="flex flex-col gap-1">
        <h2 className="flex items-center gap-2 text-base font-medium tracking-tight">
          <Icone nome="tendencia" size={17} className="text-[var(--accent)]" />
          Simulador
        </h2>
        <p className="text-[13px] text-muted-fg">
          Um mês hipotético com a regra acima, antes de salvar.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {setor === "vendas" && numero(agendados, setAgendados, "Agendados")}
        {numero(pagos, setPagos, "Pagos")}
        {setor === "vendas" && numero(cancelados, setCancelados, "Cancelados")}
        {numero(frustrados, setFrustrados, "Frustrados")}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Valor do pedido" ajuda="Usado nas faixas por valor.">
          <Input
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            inputMode="decimal"
            className="tabular"
          />
        </Campo>
        {kits.length > 0 && (
          <Campo rotulo="Kit" ajuda="Usado na pontuação por kit.">
            <Selecao value={kitId} onValueChange={setKitId}>
              <SelecaoGatilho>
                <SelecaoValor placeholder="Sem kit" />
              </SelecaoGatilho>
              <SelecaoConteudo>
                {kits.map((k) => (
                  <SelecaoItem key={k.id} value={k.id}>
                    {k.nome}
                  </SelecaoItem>
                ))}
              </SelecaoConteudo>
            </Selecao>
          </Campo>
        )}
        <Campo rotulo="Pontos já acumulados" ajuda="Para ver em que nível a pessoa termina.">
          <Input
            value={pontosIniciais}
            onChange={(e) => setPontosIniciais(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            className="tabular"
          />
        </Campo>
      </div>

      {resultado.aviso && (
        <p className="flex items-start gap-2 text-xs text-[var(--st-bronze-fg)]">
          <Icone nome="alerta" size={13} className="mt-0.5 shrink-0" />
          {resultado.aviso}
        </p>
      )}

      <ul className="flex flex-col rounded-[var(--radius-card-sm)] bg-surface-2 px-4 py-2">
        <li className="flex items-baseline justify-between gap-4 border-b border-border py-2 text-[13px]">
          <span className="text-muted-fg">Cada pedido vale</span>
          <span className="tabular font-medium">{formatNumero(resultado.porPedido)} pts</span>
        </li>
        {resultado.linhas.map((linha) => (
          <li
            key={linha.rotulo}
            className="flex items-baseline justify-between gap-4 border-b border-border py-2 text-[13px] last:border-b-0"
          >
            <span className="min-w-0">
              <span className="text-muted-fg">{linha.rotulo}</span>
              <span className="tabular block text-xs text-muted-fg/80">{linha.conta}</span>
            </span>
            <span className={cn("tabular font-medium", linha.pontos < 0 && "text-[var(--st-vermelho-fg)]")}>
              {linha.pontos > 0 ? "+" : ""}
              {formatNumero(linha.pontos)}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col">
          <span className="tabular text-[26px] leading-none font-medium tracking-tight">
            {resultado.total > 0 ? "+" : ""}
            {formatNumero(resultado.total)}
          </span>
          <span className="mt-1 text-[11px] text-muted-fg">pontos no período</span>
        </div>
        <div className="flex flex-col items-end text-right">
          <span className="text-sm font-medium">
            {resultado.nivel ? resultado.nivel.nome : "Sem trilha de níveis"}
          </span>
          <span className="tabular text-[11px] text-muted-fg">
            saldo de {formatNumero(resultado.saldoFinal)} pts
            {resultado.bonus > 0 && ` · bônus de ${formatBRL(resultado.bonus)}`}
          </span>
        </div>
      </div>
    </Card>
  );
}
