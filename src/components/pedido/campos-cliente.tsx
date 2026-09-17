"use client";

import { useState } from "react";
import type { Cliente } from "@/lib/types";
import { digitos, mascaraCEP, mascaraCPF, mascaraTelefone } from "@/lib/format";
import { buscarCep, cepValido } from "@/lib/cep";
import { Icone } from "@/components/icone";
import { Botao } from "@/components/ui/button";
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

const UFS = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB",
  "PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
];

export interface DadosClienteForm {
  nome: string;
  telefone: string;
  cpf: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  referencia: string;
}

export type ErrosCliente = Partial<Record<keyof DadosClienteForm, string>>;

export const CLIENTE_VAZIO: DadosClienteForm = {
  nome: "",
  telefone: "",
  cpf: "",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
  referencia: "",
};

/** Preenche o formulário a partir de um cliente com dados completos. */
export function formDoCliente(c: Omit<Cliente, "id" | "criadoEm">): DadosClienteForm {
  return {
    nome: c.nome,
    telefone: mascaraTelefone(c.telefone),
    cpf: c.cpf ? mascaraCPF(c.cpf) : "",
    cep: mascaraCEP(c.endereco.cep),
    logradouro: c.endereco.logradouro,
    numero: c.endereco.numero,
    complemento: c.endereco.complemento ?? "",
    bairro: c.endereco.bairro,
    cidade: c.endereco.cidade,
    uf: c.endereco.uf,
    referencia: c.endereco.referencia ?? "",
  };
}

export function validarCliente(d: DadosClienteForm): ErrosCliente {
  const e: ErrosCliente = {};
  if (d.nome.trim().length < 3) e.nome = "Informe o nome completo do cliente.";
  if (digitos(d.telefone).length < 10) e.telefone = "Telefone com DDD, 10 ou 11 dígitos.";
  if (d.cpf && digitos(d.cpf).length !== 11) e.cpf = "CPF precisa ter 11 dígitos.";
  if (!cepValido(d.cep)) e.cep = "Informe um CEP de 8 dígitos.";
  if (!d.logradouro.trim()) e.logradouro = "Informe a rua.";
  if (!d.numero.trim()) e.numero = "Informe o número.";
  if (!d.bairro.trim()) e.bairro = "Informe o bairro.";
  if (!d.cidade.trim()) e.cidade = "Informe a cidade.";
  if (!d.uf) e.uf = "Informe a UF.";
  return e;
}

export function clienteDoForm(d: DadosClienteForm, observacoes: string | null = null): Omit<Cliente, "id" | "criadoEm"> {
  return {
    nome: d.nome.trim(),
    telefone: digitos(d.telefone),
    cpf: d.cpf ? digitos(d.cpf) : null,
    endereco: {
      cep: digitos(d.cep),
      logradouro: d.logradouro.trim(),
      numero: d.numero.trim(),
      complemento: d.complemento.trim() || null,
      bairro: d.bairro.trim(),
      cidade: d.cidade.trim(),
      uf: d.uf,
      referencia: d.referencia.trim() || null,
    },
    observacoes,
  };
}

/**
 * Nome, contato e endereço do cliente, com o endereço preenchido pelo CEP.
 * Usado na criação do pedido e na edição pelo Admin.
 */
export function CamposCliente({
  dados,
  aoMudar,
  erros,
  aoLimparErro,
}: {
  dados: DadosClienteForm;
  aoMudar: (dados: DadosClienteForm) => void;
  erros: ErrosCliente;
  aoLimparErro: (campo: keyof DadosClienteForm, mensagem?: string) => void;
}) {
  const [buscandoCep, setBuscandoCep] = useState(false);
  const mudar = (campo: keyof DadosClienteForm, valor: string) => aoMudar({ ...dados, [campo]: valor });

  async function preencherPeloCep(cep = dados.cep) {
    if (!cepValido(cep)) {
      aoLimparErro("cep", "CEP precisa ter 8 dígitos.");
      return;
    }
    setBuscandoCep(true);
    const resultado = await buscarCep(cep);
    setBuscandoCep(false);
    if (!resultado.ok) {
      aoLimparErro("cep", resultado.erro);
      return;
    }
    aoLimparErro("cep");
    const e = resultado.endereco;
    aoMudar({
      ...dados,
      cep,
      logradouro: e.logradouro || dados.logradouro,
      bairro: e.bairro || dados.bairro,
      cidade: e.cidade || dados.cidade,
      uf: e.uf || dados.uf,
      complemento: dados.complemento || e.complemento || "",
    });
    toast.success("Endereço preenchido", {
      description: "Confira o número e o complemento com o cliente.",
    });
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Campo rotulo="Nome completo" obrigatorio erro={erros.nome} className="lg:col-span-2">
        <Input
          value={dados.nome}
          onChange={(e) => mudar("nome", e.target.value)}
          placeholder="Maria de Souza"
          autoComplete="off"
        />
      </Campo>
      <Campo rotulo="Telefone" obrigatorio erro={erros.telefone}>
        <Input
          value={dados.telefone}
          onChange={(e) => mudar("telefone", mascaraTelefone(e.target.value))}
          placeholder="(11) 98765-4321"
          inputMode="numeric"
          autoComplete="off"
        />
      </Campo>
      <Campo rotulo="CPF" ajuda="Opcional, mas ajuda na cobrança." erro={erros.cpf}>
        <Input
          value={dados.cpf}
          onChange={(e) => mudar("cpf", mascaraCPF(e.target.value))}
          placeholder="000.000.000-00"
          inputMode="numeric"
          autoComplete="off"
        />
      </Campo>

      <Campo rotulo="CEP" obrigatorio erro={erros.cep} ajuda="O endereço se preenche sozinho.">
        <div className="flex gap-2">
          <Input
            value={dados.cep}
            onChange={(e) => {
              const cep = mascaraCEP(e.target.value);
              mudar("cep", cep);
              // Completou os 8 dígitos: busca na hora, sem esperar sair do campo.
              if (digitos(cep).length === 8 && digitos(dados.cep).length !== 8) void preencherPeloCep(cep);
            }}
            placeholder="01310-100"
            inputMode="numeric"
            autoComplete="off"
          />
          <Botao
            type="button"
            variante="secundaria"
            tamanho="icone"
            aria-label="Buscar endereço pelo CEP"
            onClick={() => preencherPeloCep()}
            disabled={buscandoCep}
          >
            <Icone nome={buscandoCep ? "atualizar" : "busca"} />
          </Botao>
        </div>
      </Campo>

      <Campo rotulo="Rua" obrigatorio erro={erros.logradouro} className="lg:col-span-2">
        <Input value={dados.logradouro} onChange={(e) => mudar("logradouro", e.target.value)} />
      </Campo>
      <Campo rotulo="Número" obrigatorio erro={erros.numero}>
        <Input value={dados.numero} onChange={(e) => mudar("numero", e.target.value)} inputMode="text" />
      </Campo>
      <Campo rotulo="Complemento" erro={erros.complemento}>
        <Input
          value={dados.complemento}
          onChange={(e) => mudar("complemento", e.target.value)}
          placeholder="Apto 42, bloco B"
        />
      </Campo>
      <Campo rotulo="Bairro" obrigatorio erro={erros.bairro}>
        <Input value={dados.bairro} onChange={(e) => mudar("bairro", e.target.value)} />
      </Campo>
      <Campo rotulo="Cidade" obrigatorio erro={erros.cidade}>
        <Input value={dados.cidade} onChange={(e) => mudar("cidade", e.target.value)} />
      </Campo>
      <Campo rotulo="UF" obrigatorio erro={erros.uf}>
        <Selecao value={dados.uf} onValueChange={(v) => mudar("uf", v)}>
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
          value={dados.referencia}
          onChange={(e) => mudar("referencia", e.target.value)}
          placeholder="Portão verde, ao lado da padaria"
        />
      </Campo>
    </div>
  );
}
