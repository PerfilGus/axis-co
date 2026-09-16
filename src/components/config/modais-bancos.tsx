"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { BancoPlataforma, PeriodoFranquia, TaxaForma } from "@/lib/types";
import { ROTULO_FRANQUIA, SEM_TAXA } from "@/lib/types";
import {
  bpsParaCampo,
  centavosParaCampo,
  formatBRL,
  formatBps,
  parseBRL,
  parsePercentual,
} from "@/lib/format";
import { resumoTaxas } from "@/lib/taxas";
import { useCadastros } from "@/lib/providers/cadastros";
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
import { IndicadorEtapas } from "@/components/shared/etapas";
import { EnvioImagem } from "@/components/shared/envio-imagem";
import { CampoAtivo } from "./modais-catalogo";

type Erros = Record<string, string>;

const CORES = ["#f97316", "#e11d48", "#7c3aed", "#2563eb", "#0ea5e9", "#22c55e", "#eab308", "#64748b"];

/** Uma pergunta de sim ou não, em dois botões grandes. */
function Pergunta({
  pergunta,
  valor,
  aoMudar,
  sim = "Sim",
  nao = "Não",
}: {
  pergunta: string;
  valor: boolean;
  aoMudar: (valor: boolean) => void;
  sim?: string;
  nao?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-medium text-muted-fg">{pergunta}</span>
      <div className="grid grid-cols-2 gap-2">
        {[
          { v: true, rotulo: sim },
          { v: false, rotulo: nao },
        ].map((opcao) => (
          <button
            key={String(opcao.v)}
            type="button"
            aria-pressed={valor === opcao.v}
            onClick={() => aoMudar(opcao.v)}
            className={cn(
              "flex h-11 items-center justify-center gap-2 rounded-full border text-sm font-medium transition-colors",
              valor === opcao.v
                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-fg"
                : "border-border text-muted-fg hover:border-border-strong hover:text-fg",
            )}
          >
            {valor === opcao.v && <Icone nome="check" size={14} />}
            {opcao.rotulo}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Estado editável de uma taxa: textos dos campos. */
interface CamposTaxa {
  temTaxa: boolean;
  percentual: string;
  fixa: string;
}

function camposDe(taxa: TaxaForma): CamposTaxa {
  return {
    temTaxa: taxa.bps > 0 || taxa.fixa > 0,
    percentual: taxa.bps > 0 ? bpsParaCampo(taxa.bps) : "",
    fixa: taxa.fixa > 0 ? centavosParaCampo(taxa.fixa) : "",
  };
}

function taxaDe(campos: CamposTaxa, ativa: boolean): TaxaForma {
  if (!ativa) return SEM_TAXA;
  if (!campos.temTaxa) return { ativa: true, bps: 0, fixa: 0 };
  return {
    ativa: true,
    bps: parsePercentual(campos.percentual) ?? 0,
    fixa: parseBRL(campos.fixa) ?? 0,
  };
}

function CamposPercentualFixo({
  campos,
  aoMudar,
  erro,
  mostrarPercentual = true,
}: {
  campos: CamposTaxa;
  aoMudar: (campos: CamposTaxa) => void;
  erro?: string;
  mostrarPercentual?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className={cn("grid gap-4", mostrarPercentual && "sm:grid-cols-2")}>
        {mostrarPercentual && (
          <Campo rotulo="Percentual sobre o valor">
            <Input
              value={campos.percentual}
              onChange={(e) => aoMudar({ ...campos, percentual: e.target.value })}
              inputMode="decimal"
              placeholder="0,00 %"
              className="tabular"
            />
          </Campo>
        )}
        <Campo rotulo={mostrarPercentual ? "Valor fixo por transação" : "Valor fixo por boleto"}>
          <Input
            value={campos.fixa}
            onChange={(e) => aoMudar({ ...campos, fixa: e.target.value })}
            inputMode="decimal"
            placeholder="R$ 0,00"
            className="tabular"
          />
        </Campo>
      </div>
      {erro && <p className="text-xs text-[var(--st-vermelho-fg)]">{erro}</p>}
    </div>
  );
}

function SeletorCor({ cor, aoMudar }: { cor: string; aoMudar: (cor: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {CORES.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`Cor ${c}`}
          aria-pressed={cor === c}
          onClick={() => aoMudar(c)}
          className={cn(
            "flex size-8 items-center justify-center rounded-full border-2 transition-colors",
            cor === c ? "border-fg" : "border-transparent",
          )}
        >
          <span className="size-6 rounded-full" style={{ backgroundColor: c }} />
        </button>
      ))}
    </div>
  );
}

/* ================================================================
   Banco — formulário em etapas
   ================================================================ */

const ETAPAS = [
  { chave: "banco", rotulo: "Banco" },
  { chave: "boleto", rotulo: "Boleto" },
  { chave: "pix", rotulo: "Pix" },
  { chave: "cartao", rotulo: "Cartão" },
  { chave: "revisao", rotulo: "Revisão" },
];

export function ModalBanco({
  banco,
  aberto,
  aoFechar,
}: {
  banco: BancoPlataforma | null;
  aberto: boolean;
  aoFechar: () => void;
}) {
  if (!aberto) return null;
  return <FormularioBanco key={banco?.id ?? "novo"} banco={banco} aoFechar={aoFechar} />;
}

function FormularioBanco({
  banco,
  aoFechar,
}: {
  banco: BancoPlataforma | null;
  aoFechar: () => void;
}) {
  const { salvarBanco } = useCadastros();
  const [etapa, setEtapa] = useState(0);
  const [erros, setErros] = useState<Erros>({});

  const [nome, setNome] = useState(banco?.nome ?? "");
  const [identificador, setIdentificador] = useState(banco?.identificador ?? "");
  const [iconeUrl, setIconeUrl] = useState(banco?.iconeUrl ?? null);
  const [cor, setCor] = useState(banco?.cor ?? CORES[3]);
  const [ativo, setAtivo] = useState(banco?.ativo ?? true);

  const [boleto, setBoleto] = useState(camposDe(banco?.boleto ?? SEM_TAXA));
  const [temFranquia, setTemFranquia] = useState((banco?.franquiaBoleto.quantidade ?? 0) > 0);
  const [franquia, setFranquia] = useState(
    banco && banco.franquiaBoleto.quantidade > 0 ? String(banco.franquiaBoleto.quantidade) : "",
  );
  const [periodoFranquia, setPeriodoFranquia] = useState<PeriodoFranquia>(
    banco?.franquiaBoleto.periodo ?? "mensal",
  );
  const [pix, setPix] = useState(camposDe(banco?.pix ?? SEM_TAXA));
  const [ofereceCartao, setOfereceCartao] = useState(banco?.cartao.ativa ?? false);
  const [cartao, setCartao] = useState({ ...camposDe(banco?.cartao ?? SEM_TAXA), temTaxa: true });

  function montar(): Omit<BancoPlataforma, "id" | "saldo" | "fonte" | "atualizadoEm"> {
    return {
      nome: nome.trim(),
      tipo: "banco",
      identificador: identificador.trim(),
      iconeUrl,
      cor,
      ativo,
      boleto: taxaDe({ ...boleto, percentual: "" }, true),
      franquiaBoleto: {
        quantidade: boleto.temTaxa && temFranquia ? Number(franquia) || 0 : 0,
        periodo: periodoFranquia,
      },
      pix: taxaDe(pix, true),
      cartao: taxaDe(cartao, ofereceCartao),
    };
  }

  /** Valida só a etapa atual; cada uma segura o avanço. */
  function validar(indice: number): boolean {
    const e: Erros = {};
    if (indice === 0 && !nome.trim()) e.nome = "Informe o nome do banco.";
    if (indice === 1) {
      if (boleto.temTaxa && !(parseBRL(boleto.fixa) ?? 0)) {
        e.boleto = "Informe a tarifa por boleto, ou responda que não tem taxa.";
      }
      if (boleto.temTaxa && temFranquia && !(Number(franquia) > 0)) {
        e.franquia = "Quantos boletos saem sem taxa?";
      }
    }
    if (indice === 2 && pix.temTaxa && !(parsePercentual(pix.percentual) ?? 0) && !(parseBRL(pix.fixa) ?? 0)) {
      e.pix = "Informe o percentual, o valor fixo ou os dois.";
    }
    if (
      indice === 3 &&
      ofereceCartao &&
      !(parsePercentual(cartao.percentual) ?? 0) &&
      !(parseBRL(cartao.fixa) ?? 0)
    ) {
      e.cartao = "Informe o percentual e o valor fixo do link de cartão.";
    }
    setErros(e);
    return Object.keys(e).length === 0;
  }

  function avancar() {
    if (!validar(etapa)) return;
    setEtapa((i) => Math.min(i + 1, ETAPAS.length - 1));
  }

  function salvar() {
    for (let i = 0; i < ETAPAS.length - 1; i++) {
      if (!validar(i)) {
        setEtapa(i);
        return;
      }
    }
    const salvo = salvarBanco({ id: banco?.id, ...montar() });
    toast.success(banco ? "Banco atualizado" : "Banco cadastrado", {
      description: `${salvo.nome}: ${resumoTaxas(salvo)}.`,
    });
    aoFechar();
  }

  const previa: BancoPlataforma = {
    ...montar(),
    id: banco?.id ?? "previa",
    saldo: banco?.saldo ?? 0,
    fonte: "manual",
    atualizadoEm: "",
  };

  return (
    <Modal open onOpenChange={(v) => !v && aoFechar()}>
      <ModalConteudo larguraMaxima="max-w-xl">
        <ModalCabecalho
          titulo={banco ? `Editar ${banco.nome}` : "Novo banco"}
          descricao="As taxas daqui calculam o líquido de cada recebimento."
        />
        <IndicadorEtapas etapas={ETAPAS} atual={etapa} className="mb-6" />

        <div className="flex min-h-64 flex-col gap-4">
          {etapa === 0 && (
            <>
              <EnvioImagem nome={nome} url={iconeUrl} cor={cor} aoMudar={setIconeUrl} rotulo="Enviar ícone" />
              <Campo rotulo="Nome" obrigatorio erro={erros.nome}>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Banco Inter PJ" autoFocus />
              </Campo>
              <Campo rotulo="Agência e conta" ajuda="Opcional. Ajuda a conferir o extrato.">
                <Input
                  value={identificador}
                  onChange={(e) => setIdentificador(e.target.value)}
                  placeholder="Ag. 0001 / CC 12345-6"
                />
              </Campo>
              {!iconeUrl && (
                <Campo rotulo="Cor das iniciais">
                  <SeletorCor cor={cor} aoMudar={setCor} />
                </Campo>
              )}
            </>
          )}

          {etapa === 1 && (
            <>
              <Pergunta
                pergunta="O boleto tem taxa?"
                valor={boleto.temTaxa}
                aoMudar={(temTaxa) => setBoleto({ ...boleto, temTaxa })}
              />
              {boleto.temTaxa && (
                <>
                  <CamposPercentualFixo
                    campos={boleto}
                    aoMudar={setBoleto}
                    erro={erros.boleto}
                    mostrarPercentual={false}
                  />
                  <Pergunta
                    pergunta="Tem franquia de boletos gratuitos?"
                    valor={temFranquia}
                    aoMudar={setTemFranquia}
                  />
                  {temFranquia && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Campo rotulo="Boletos sem taxa" erro={erros.franquia}>
                        <Input
                          value={franquia}
                          onChange={(e) => setFranquia(e.target.value.replace(/\D/g, "").slice(0, 5))}
                          inputMode="numeric"
                          placeholder="100"
                          className="tabular"
                        />
                      </Campo>
                      <Campo rotulo="A franquia renova">
                        <Selecao
                          value={periodoFranquia}
                          onValueChange={(v) => setPeriodoFranquia(v as PeriodoFranquia)}
                        >
                          <SelecaoGatilho>
                            <SelecaoValor />
                          </SelecaoGatilho>
                          <SelecaoConteudo>
                            {(Object.keys(ROTULO_FRANQUIA) as PeriodoFranquia[]).map((p) => (
                              <SelecaoItem key={p} value={p}>
                                {ROTULO_FRANQUIA[p][0].toUpperCase() + ROTULO_FRANQUIA[p].slice(1)}
                              </SelecaoItem>
                            ))}
                          </SelecaoConteudo>
                        </Selecao>
                      </Campo>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {etapa === 2 && (
            <>
              <Pergunta
                pergunta="O Pix tem taxa?"
                valor={pix.temTaxa}
                aoMudar={(temTaxa) => setPix({ ...pix, temTaxa })}
              />
              {pix.temTaxa && (
                <>
                  <CamposPercentualFixo campos={pix} aoMudar={setPix} erro={erros.pix} />
                  <p className="text-xs text-muted-fg">
                    Preencha o percentual, o valor fixo ou os dois.
                  </p>
                </>
              )}
            </>
          )}

          {etapa === 3 && (
            <>
              <Pergunta
                pergunta="O banco oferece link de cartão?"
                valor={ofereceCartao}
                aoMudar={setOfereceCartao}
              />
              {ofereceCartao ? (
                <CamposPercentualFixo campos={cartao} aoMudar={setCartao} erro={erros.cartao} />
              ) : (
                <p className="text-[13px] text-muted-fg">
                  Sem link de cartão, este banco não aparece quando o cobrador escolhe essa forma.
                </p>
              )}
            </>
          )}

          {etapa === 4 && (
            <>
              <ul className="flex flex-col divide-y divide-border rounded-[var(--radius-card-sm)] border border-border bg-surface-2 px-4">
                {[
                  ["Banco", previa.nome || "—"],
                  [
                    "Boleto",
                    previa.boleto.fixa > 0 ? `${formatBRL(previa.boleto.fixa)} por boleto` : "Sem taxa",
                  ],
                  [
                    "Franquia",
                    previa.franquiaBoleto.quantidade > 0 && previa.boleto.fixa > 0
                      ? `${previa.franquiaBoleto.quantidade} boletos grátis ${ROTULO_FRANQUIA[previa.franquiaBoleto.periodo]}`
                      : "Sem franquia",
                  ],
                  ["Pix", descreverTaxa(previa.pix)],
                  ["Link de cartão", previa.cartao.ativa ? descreverTaxa(previa.cartao) : "Não oferece"],
                ].map(([rotulo, valor]) => (
                  <li key={rotulo} className="flex justify-between gap-4 py-2.5 text-[13px]">
                    <span className="text-muted-fg">{rotulo}</span>
                    <span className="tabular text-right font-medium">{valor}</span>
                  </li>
                ))}
              </ul>
              <CampoAtivo
                ativo={ativo}
                aoMudar={setAtivo}
                rotulo="Banco ativo"
                descricao="Inativo, não aparece para registrar pagamentos."
              />
            </>
          )}
        </div>

        <ModalRodape className="sm:justify-between">
          <Botao
            variante="secundaria"
            onClick={() => (etapa === 0 ? aoFechar() : setEtapa(etapa - 1))}
          >
            {etapa === 0 ? "Cancelar" : "Voltar"}
          </Botao>
          {etapa < ETAPAS.length - 1 ? (
            <Botao variante="principal" onClick={avancar}>
              Continuar
              <Icone nome="avancar" size={15} />
            </Botao>
          ) : (
            <Botao variante="principal" onClick={salvar}>
              <Icone nome="check" size={15} />
              {banco ? "Salvar banco" : "Cadastrar banco"}
            </Botao>
          )}
        </ModalRodape>
      </ModalConteudo>
    </Modal>
  );
}

function descreverTaxa(taxa: TaxaForma): string {
  const partes: string[] = [];
  if (taxa.bps > 0) partes.push(formatBps(taxa.bps));
  if (taxa.fixa > 0) partes.push(formatBRL(taxa.fixa));
  return partes.length > 0 ? partes.join(" + ") : "Sem taxa";
}

/* ================================================================
   Plataforma — só link de cartão
   ================================================================ */

export function ModalPlataforma({
  plataforma,
  aberto,
  aoFechar,
}: {
  plataforma: BancoPlataforma | null;
  aberto: boolean;
  aoFechar: () => void;
}) {
  if (!aberto) return null;
  return (
    <FormularioPlataforma key={plataforma?.id ?? "nova"} plataforma={plataforma} aoFechar={aoFechar} />
  );
}

function FormularioPlataforma({
  plataforma,
  aoFechar,
}: {
  plataforma: BancoPlataforma | null;
  aoFechar: () => void;
}) {
  const { salvarBanco } = useCadastros();
  const [nome, setNome] = useState(plataforma?.nome ?? "");
  const [identificador, setIdentificador] = useState(plataforma?.identificador ?? "");
  const [iconeUrl, setIconeUrl] = useState(plataforma?.iconeUrl ?? null);
  const [cor, setCor] = useState(plataforma?.cor ?? CORES[4]);
  const [ativo, setAtivo] = useState(plataforma?.ativo ?? true);
  const [cartao, setCartao] = useState({ ...camposDe(plataforma?.cartao ?? SEM_TAXA), temTaxa: true });
  const [erros, setErros] = useState<Erros>({});

  function salvar() {
    const e: Erros = {};
    if (!nome.trim()) e.nome = "Informe o nome da plataforma.";
    if (!(parsePercentual(cartao.percentual) ?? 0) && !(parseBRL(cartao.fixa) ?? 0)) {
      e.cartao = "Informe a taxa de cartão: percentual e valor fixo por transação.";
    }
    setErros(e);
    if (Object.keys(e).length > 0) return;

    const salvo = salvarBanco({
      id: plataforma?.id,
      nome: nome.trim(),
      tipo: "plataforma",
      identificador: identificador.trim(),
      iconeUrl,
      cor,
      ativo,
      // Plataforma não tem boleto nem Pix.
      boleto: SEM_TAXA,
      franquiaBoleto: { quantidade: 0, periodo: "mensal" },
      pix: SEM_TAXA,
      cartao: taxaDe(cartao, true),
    });
    toast.success(plataforma ? "Plataforma atualizada" : "Plataforma cadastrada", {
      description: `${salvo.nome}: ${resumoTaxas(salvo)}.`,
    });
    aoFechar();
  }

  return (
    <Modal open onOpenChange={(v) => !v && aoFechar()}>
      <ModalConteudo larguraMaxima="max-w-lg">
        <ModalCabecalho
          titulo={plataforma ? `Editar ${plataforma.nome}` : "Nova plataforma"}
          descricao="Plataforma recebe só por link de cartão: não tem boleto nem Pix."
        />
        <div className="flex flex-col gap-4">
          <EnvioImagem nome={nome} url={iconeUrl} cor={cor} aoMudar={setIconeUrl} rotulo="Enviar ícone" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Nome" obrigatorio erro={erros.nome}>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="VendLiber" autoFocus />
            </Campo>
            <Campo rotulo="Identificador" ajuda="Opcional. Código do lojista.">
              <Input value={identificador} onChange={(e) => setIdentificador(e.target.value)} placeholder="Lojista 44812" />
            </Campo>
          </div>
          {!iconeUrl && (
            <Campo rotulo="Cor das iniciais">
              <SeletorCor cor={cor} aoMudar={setCor} />
            </Campo>
          )}
          <CamposPercentualFixo campos={cartao} aoMudar={setCartao} erro={erros.cartao} />
          <CampoAtivo
            ativo={ativo}
            aoMudar={setAtivo}
            rotulo="Plataforma ativa"
            descricao="Inativa, não aparece para registrar pagamentos."
          />
        </div>
        <ModalRodape>
          <Botao variante="secundaria" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao variante="principal" onClick={salvar}>
            <Icone nome="check" size={15} />
            {plataforma ? "Salvar plataforma" : "Cadastrar plataforma"}
          </Botao>
        </ModalRodape>
      </ModalConteudo>
    </Modal>
  );
}
