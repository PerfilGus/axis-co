"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Centavos } from "@/lib/types";
import {
  digitos,
  formatBRL,
  mascaraCEP,
  mascaraCPF,
  mascaraTelefone,
  parseBRL,
} from "@/lib/format";
import { buscarCep, cepValido } from "@/lib/cep";
import { useSessao } from "@/lib/providers/sessao";
import { usePedidos, type RascunhoPedido } from "@/lib/providers/pedidos";
import { opcoesCriativo } from "@/lib/mock/marketing";
import { useCadastros } from "@/lib/providers/cadastros";
import { Icone } from "@/components/icone";
import { Botao } from "@/components/ui/button";
import { Card, CardConteudo, CardDescricao, CardTitulo } from "@/components/ui/card";
import { Campo, Label } from "@/components/ui/label";
import { Input, Textarea } from "@/components/ui/input";
import { Caixa } from "@/components/ui/checkbox";
import {
  Selecao,
  SelecaoConteudo,
  SelecaoGatilho,
  SelecaoItem,
  SelecaoValor,
} from "@/components/ui/select";
import { EnvioArquivo, type ArquivoSelecionado } from "@/components/shared/envio-arquivo";
import { toast } from "@/components/ui/toast";

const UFS = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB",
  "PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
];

type Erros = Record<string, string>;

function Secao({
  titulo,
  descricao,
  children,
  acao,
}: {
  titulo: string;
  descricao: string;
  children: React.ReactNode;
  acao?: React.ReactNode;
}) {
  return (
    <Card>
      <CardConteudo className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <CardTitulo>{titulo}</CardTitulo>
            <CardDescricao>{descricao}</CardDescricao>
          </div>
          {acao}
        </div>
        {children}
      </CardConteudo>
    </Card>
  );
}

/**
 * Formulário de novo pedido.
 *
 * O vendedor não define preço: o valor vem do kit. Se precisar de outro valor,
 * ele pede um ajuste, e o pedido nasce com o selo de ajuste pendente até o
 * Admin decidir. O vendedor também não escolhe a si mesmo: a autoria vem do
 * login.
 */
export function FormularioPedido() {
  const router = useRouter();
  const { usuario } = useSessao();
  const { criar } = usePedidos();
  const { kits, produtos, criativos, linhas } = useCadastros();
  // Kit à venda: ativo e com todos os produtos ativos.
  const kitsVendaveis = kits.filter(
    (k) =>
      k.ativo &&
      k.itens.every((i) => produtos.find((p) => p.id === i.produtoId)?.ativo),
  );
  const [salvando, iniciarSalvamento] = useTransition();

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cpf, setCpf] = useState("");
  const [cep, setCep] = useState("");
  const [logradouro, setLogradouro] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");
  const [referencia, setReferencia] = useState("");

  const [kitId, setKitId] = useState("");
  const [criativoId, setCriativoId] = useState("");

  const [comAjuste, setComAjuste] = useState(false);
  const [tipoAjuste, setTipoAjuste] = useState<"desconto" | "acrescimo">("desconto");
  const [valorAjuste, setValorAjuste] = useState("");
  const [motivoAjuste, setMotivoAjuste] = useState("");

  const [confirmacaoPorTexto, setConfirmacaoPorTexto] = useState(false);
  const [print, setPrint] = useState<ArquivoSelecionado[]>([]);
  const [audio, setAudio] = useState<ArquivoSelecionado[]>([]);

  const [observacoes, setObservacoes] = useState("");

  const [buscandoCep, setBuscandoCep] = useState(false);
  const [erros, setErros] = useState<Erros>({});

  const kit = kits.find((k) => k.id === kitId) ?? null;
  const ajusteCentavos: Centavos | null = parseBRL(valorAjuste);
  const valorFinal =
    kit && comAjuste && ajusteCentavos
      ? tipoAjuste === "desconto"
        ? kit.precoTabela - ajusteCentavos
        : kit.precoTabela + ajusteCentavos
      : (kit?.precoTabela ?? null);

  async function preencherPeloCep() {
    if (!cepValido(cep)) {
      setErros((e) => ({ ...e, cep: "CEP precisa ter 8 dígitos." }));
      return;
    }
    setBuscandoCep(true);
    const resultado = await buscarCep(cep);
    setBuscandoCep(false);

    if (!resultado.ok) {
      setErros((e) => ({ ...e, cep: resultado.erro }));
      return;
    }
    setErros((e) => {
      const resto = { ...e };
      delete resto.cep;
      return resto;
    });
    setLogradouro(resultado.endereco.logradouro);
    setBairro(resultado.endereco.bairro);
    setCidade(resultado.endereco.cidade);
    setUf(resultado.endereco.uf);
    toast.success("Endereço preenchido", {
      description: "Confira o número e o complemento com o cliente.",
    });
  }

  function validar(): Erros {
    const e: Erros = {};
    if (nome.trim().length < 3) e.nome = "Informe o nome completo do cliente.";
    if (digitos(telefone).length < 10) e.telefone = "Telefone com DDD, 10 ou 11 dígitos.";
    if (cpf && digitos(cpf).length !== 11) e.cpf = "CPF precisa ter 11 dígitos.";
    if (!cepValido(cep)) e.cep = "Informe um CEP de 8 dígitos.";
    if (!logradouro.trim()) e.logradouro = "Informe a rua.";
    if (!numero.trim()) e.numero = "Informe o número.";
    if (!bairro.trim()) e.bairro = "Informe o bairro.";
    if (!cidade.trim()) e.cidade = "Informe a cidade.";
    if (!uf) e.uf = "Informe a UF.";
    if (!kitId) e.kit = "Escolha o kit fechado com o cliente.";
    if (!criativoId) e.criativo = "Escolha o criativo de origem.";

    if (comAjuste) {
      if (!ajusteCentavos || ajusteCentavos <= 0) {
        e.valorAjuste = "Informe o valor do ajuste.";
      } else if (valorFinal !== null && valorFinal <= 0) {
        e.valorAjuste = "O desconto não pode zerar o pedido.";
      }
      if (motivoAjuste.trim().length < 5) {
        e.motivoAjuste = "Explique o motivo: é o que o Admin vai analisar.";
      }
    }

    if (print.length === 0) {
      e.print = "O print da confirmação é obrigatório.";
    }
    if (!confirmacaoPorTexto && audio.length === 0) {
      e.audio =
        "Anexe o áudio ou marque que o cliente confirmou por texto.";
    }

    return e;
  }

  function salvar() {
    const encontrados = validar();
    setErros(encontrados);

    if (Object.keys(encontrados).length > 0) {
      toast.error("Faltou preencher alguma coisa", {
        description: `${Object.keys(encontrados).length} campo(s) precisam de atenção.`,
      });
      return;
    }

    const rascunho: RascunhoPedido = {
      cliente: {
        nome: nome.trim(),
        telefone: digitos(telefone),
        cpf: cpf ? digitos(cpf) : null,
        endereco: {
          cep: digitos(cep),
          logradouro: logradouro.trim(),
          numero: numero.trim(),
          complemento: complemento.trim() || null,
          bairro: bairro.trim(),
          cidade: cidade.trim(),
          uf,
          referencia: referencia.trim() || null,
        },
        observacoes: null,
      },
      kitId,
      criativoId,
      observacoes,
      confirmacaoPorTexto,
      ajuste:
        comAjuste && ajusteCentavos
          ? { tipo: tipoAjuste, valor: ajusteCentavos, motivo: motivoAjuste.trim() }
          : null,
      anexos: [
        ...print.map((a) => ({
          nome: a.nome,
          tipo: "print_confirmacao" as const,
          tamanhoBytes: a.tamanho,
          mime: a.tipo || "image/png",
        })),
        ...audio.map((a) => ({
          nome: a.nome,
          tipo: "audio_confirmacao" as const,
          tamanhoBytes: a.tamanho,
          mime: a.tipo || "audio/ogg",
        })),
      ],
    };

    iniciarSalvamento(() => {
      const pedido = criar(rascunho, usuario.id);
      toast.success(`Pedido ${pedido.codigo} criado`, {
        description: comAjuste
          ? "Segue com ajuste pendente até o Admin decidir."
          : "Já está na fila de autorização de envio.",
      });
      router.push("/operacao/pedidos");
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Secao
        titulo="Cliente"
        descricao="Quem recebe e paga na entrega. Confira o endereço com ele na ligação."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Campo rotulo="Nome completo" obrigatorio erro={erros.nome} className="lg:col-span-2">
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Maria de Souza"
              autoComplete="off"
            />
          </Campo>
          <Campo rotulo="Telefone" obrigatorio erro={erros.telefone}>
            <Input
              value={telefone}
              onChange={(e) => setTelefone(mascaraTelefone(e.target.value))}
              placeholder="(11) 98765-4321"
              inputMode="numeric"
            />
          </Campo>
          <Campo rotulo="CPF" ajuda="Opcional, mas ajuda na cobrança." erro={erros.cpf}>
            <Input
              value={cpf}
              onChange={(e) => setCpf(mascaraCPF(e.target.value))}
              placeholder="000.000.000-00"
              inputMode="numeric"
            />
          </Campo>

          <Campo rotulo="CEP" obrigatorio erro={erros.cep}>
            <div className="flex gap-2">
              <Input
                value={cep}
                onChange={(e) => setCep(mascaraCEP(e.target.value))}
                onBlur={() => cepValido(cep) && preencherPeloCep()}
                placeholder="01310-100"
                inputMode="numeric"
              />
              <Botao
                variante="secundaria"
                tamanho="icone"
                aria-label="Buscar endereço pelo CEP"
                onClick={preencherPeloCep}
                disabled={buscandoCep}
              >
                <Icone nome={buscandoCep ? "atualizar" : "busca"} />
              </Botao>
            </div>
          </Campo>

          <Campo rotulo="Rua" obrigatorio erro={erros.logradouro} className="lg:col-span-2">
            <Input value={logradouro} onChange={(e) => setLogradouro(e.target.value)} />
          </Campo>
          <Campo rotulo="Número" obrigatorio erro={erros.numero}>
            <Input value={numero} onChange={(e) => setNumero(e.target.value)} />
          </Campo>
          <Campo rotulo="Complemento" erro={erros.complemento}>
            <Input
              value={complemento}
              onChange={(e) => setComplemento(e.target.value)}
              placeholder="Apto 42, bloco B"
            />
          </Campo>
          <Campo rotulo="Bairro" obrigatorio erro={erros.bairro}>
            <Input value={bairro} onChange={(e) => setBairro(e.target.value)} />
          </Campo>
          <Campo rotulo="Cidade" obrigatorio erro={erros.cidade}>
            <Input value={cidade} onChange={(e) => setCidade(e.target.value)} />
          </Campo>
          <Campo rotulo="UF" obrigatorio erro={erros.uf}>
            <Selecao value={uf} onValueChange={setUf}>
              <SelecaoGatilho>
                <SelecaoValor placeholder="Escolha" />
              </SelecaoGatilho>
              <SelecaoConteudo>
                {UFS.map((sigla) => (
                  <SelecaoItem key={sigla} value={sigla}>
                    {sigla}
                  </SelecaoItem>
                ))}
              </SelecaoConteudo>
            </Selecao>
          </Campo>
          <Campo
            rotulo="Ponto de referência"
            ajuda="Ajuda o carteiro a achar o endereço."
            className="lg:col-span-3"
          >
            <Input
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              placeholder="Portão verde, ao lado da padaria"
            />
          </Campo>
        </div>
      </Secao>

      <Secao
        titulo="Kit e origem"
        descricao="O valor é o do kit. Para sair diferente disso, peça um ajuste abaixo."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Kit" obrigatorio erro={erros.kit}>
            <Selecao value={kitId} onValueChange={setKitId}>
              <SelecaoGatilho>
                <SelecaoValor placeholder="Escolha o kit" />
              </SelecaoGatilho>
              <SelecaoConteudo>
                {kitsVendaveis.map((k) => (
                  <SelecaoItem key={k.id} value={k.id}>
                    {k.nome} — {formatBRL(k.precoTabela)}
                  </SelecaoItem>
                ))}
              </SelecaoConteudo>
            </Selecao>
          </Campo>

          <Campo
            rotulo="Criativo de origem"
            obrigatorio
            erro={erros.criativo}
            ajuda="Código e linha do anúncio que trouxe o lead."
          >
            <Selecao value={criativoId} onValueChange={setCriativoId}>
              <SelecaoGatilho>
                <SelecaoValor placeholder="Escolha o criativo" />
              </SelecaoGatilho>
              <SelecaoConteudo>
                {opcoesCriativo(criativos, linhas).map((opcao) => (
                  <SelecaoItem key={opcao.valor} value={opcao.valor}>
                    {opcao.rotulo}
                  </SelecaoItem>
                ))}
              </SelecaoConteudo>
            </Selecao>
          </Campo>
        </div>

        {kit && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card-sm)] border border-border bg-surface-2 px-4 py-3">
            <div className="flex flex-col">
              <span className="text-[13px] text-muted-fg">{kit.descricao}</span>
              <span className="text-[11px] text-muted-fg/80">
                Frete estimado de {formatBRL(kit.freteEstimado)}.
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              {comAjuste && ajusteCentavos && valorFinal !== null && (
                <span className="tabular text-[13px] text-muted-fg line-through">
                  {formatBRL(kit.precoTabela)}
                </span>
              )}
              <span className="tabular text-xl font-medium">
                {formatBRL(valorFinal ?? kit.precoTabela)}
              </span>
            </div>
          </div>
        )}
      </Secao>

      <Secao
        titulo="Ajuste de valor"
        descricao="Quem aprova é o Admin. Até lá o pedido fica com o selo de ajuste pendente."
        acao={
          <Botao
            variante={comAjuste ? "secundaria" : "contorno"}
            tamanho="sm"
            onClick={() => setComAjuste((v) => !v)}
          >
            <Icone nome={comAjuste ? "fechar" : "adicionar"} size={14} />
            {comAjuste ? "Remover ajuste" : "Pedir ajuste"}
          </Botao>
        }
      >
        {comAjuste ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Campo rotulo="Tipo">
              <Selecao
                value={tipoAjuste}
                onValueChange={(v) => setTipoAjuste(v as "desconto" | "acrescimo")}
              >
                <SelecaoGatilho>
                  <SelecaoValor />
                </SelecaoGatilho>
                <SelecaoConteudo>
                  <SelecaoItem value="desconto">Desconto</SelecaoItem>
                  <SelecaoItem value="acrescimo">Acréscimo</SelecaoItem>
                </SelecaoConteudo>
              </Selecao>
            </Campo>
            <Campo rotulo="Valor do ajuste" obrigatorio erro={erros.valorAjuste}>
              <Input
                value={valorAjuste}
                onChange={(e) => setValorAjuste(e.target.value)}
                placeholder="20,00"
                inputMode="decimal"
              />
            </Campo>
            <Campo
              rotulo="Motivo"
              obrigatorio
              erro={erros.motivoAjuste}
              className="lg:col-span-3"
            >
              <Textarea
                value={motivoAjuste}
                onChange={(e) => setMotivoAjuste(e.target.value)}
                placeholder="Cliente só fecha por este valor; é recompra."
                className="min-h-20"
              />
            </Campo>
          </div>
        ) : (
          <p className="text-[13px] text-muted-fg">
            Sem ajuste: o pedido sai pelo valor de tabela do kit.
          </p>
        )}
      </Secao>

      <Secao
        titulo="Confirmação do cliente"
        descricao="Sem essas provas o envio não pode ser autorizado."
      >
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label>
              Print da confirmação<span className="text-[var(--accent)]"> *</span>
            </Label>
            <EnvioArquivo
              aceita="image/*"
              rotulo="Arraste o print da conversa"
              aoSelecionar={setPrint}
            />
            {erros.print && (
              <p className="text-xs text-[var(--st-vermelho-fg)]">{erros.print}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label>
              Áudio de confirmação
              {!confirmacaoPorTexto && <span className="text-[var(--accent)]"> *</span>}
            </Label>
            <div
              className={cn(
                "transition-opacity",
                confirmacaoPorTexto && "pointer-events-none opacity-45",
              )}
            >
              <EnvioArquivo
                aceita="audio/*"
                rotulo="Arraste o áudio do cliente"
                aoSelecionar={setAudio}
              />
            </div>
            {erros.audio && (
              <p className="text-xs text-[var(--st-vermelho-fg)]">{erros.audio}</p>
            )}
          </div>
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-card-sm)] border border-border bg-surface-2 p-4">
          <Caixa
            checked={confirmacaoPorTexto}
            onCheckedChange={(v) => {
              setConfirmacaoPorTexto(v === true);
              if (v === true) setAudio([]);
            }}
            className="mt-0.5"
          />
          <span className="flex flex-col gap-0.5">
            <span className="text-[13px] font-medium">
              Cliente confirmou por texto
            </span>
            <span className="text-[13px] text-muted-fg">
              Dispensa o áudio. O print continua obrigatório.
            </span>
          </span>
        </label>
      </Secao>

      <Secao
        titulo="Observações"
        descricao="O que o time precisa saber sobre este pedido."
      >
        <Textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          placeholder="Cliente pediu para entregar depois das 14h."
        />
      </Secao>

      <div className="flex flex-wrap items-center justify-end gap-2 pb-2">
        <span className="mr-auto text-[11px] text-muted-fg">
          Vendedor: {usuario.nome} · vem do login, não é um campo.
        </span>
        <Botao variante="secundaria" onClick={() => router.back()} disabled={salvando}>
          <Icone nome="fechar" size={15} />
          Descartar
        </Botao>
        <Botao variante="principal" onClick={salvar} disabled={salvando}>
          <Icone nome="check" size={16} />
          Salvar pedido
        </Botao>
      </div>
    </div>
  );
}
