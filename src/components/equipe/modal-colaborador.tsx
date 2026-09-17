"use client";

import { useMemo, useState } from "react";
import type { Colaborador, Setor } from "@/lib/types";
import {
  bpsParaCampo,
  centavosParaCampo,
  digitos,
  formatBps,
  formatBRL,
  formatPercentual,
  mascaraTelefone,
  parseBRL,
  parsePercentual,
} from "@/lib/format";
import { comissaoVendedor, contaVendedor } from "@/lib/comissoes";
import { taxaFrustracao } from "@/lib/desempenho";
import { useEquipe } from "@/lib/providers/equipe";
import { usePedidos } from "@/lib/providers/pedidos";
import { Icone } from "@/components/icone";
import { Botao } from "@/components/ui/button";
import { Modal, ModalCabecalho, ModalConteudo, ModalRodape } from "@/components/ui/dialog";
import { Campo, Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { ControleSegmentado } from "@/components/shared/controles";
import { EnvioImagem } from "@/components/shared/envio-imagem";
import { ModalConfirmacao } from "@/components/shared/modal-confirmacao";
import { SelecaoMultipla } from "@/components/shared/selecao-multipla";
import { CampoAtivo } from "@/components/config/modais-catalogo";
import { gerarSenhaProvisoria, problemaDaSenha } from "@/lib/senha";

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** O exemplo da regra, sempre com os mesmos R$ 100.000,00 enviados. */
const EXEMPLO_ENVIADO = 10_000_000;

function Secao({ titulo, descricao, children }: { titulo: string; descricao?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t border-border pt-5 first:border-t-0 first:pt-0">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-sm font-medium">{titulo}</h3>
        {descricao && <p className="text-xs text-muted-fg">{descricao}</p>}
      </div>
      {children}
    </section>
  );
}

export function ModalColaborador({
  colaborador,
  aberto,
  aoFechar,
}: {
  colaborador: Colaborador | null;
  aberto: boolean;
  aoFechar: () => void;
}) {
  if (!aberto) return null;
  return <Formulario key={colaborador?.id ?? "novo"} colaborador={colaborador} aoFechar={aoFechar} />;
}

function Formulario({ colaborador, aoFechar }: { colaborador: Colaborador | null; aoFechar: () => void }) {
  const { colaboradores, salvarColaborador } = useEquipe();
  const { pedidos } = usePedidos();

  const [avatarUrl, setAvatarUrl] = useState(colaborador?.avatarUrl ?? null);
  const [nome, setNome] = useState(colaborador?.nome ?? "");
  const [email, setEmail] = useState(colaborador?.email ?? "");
  const [telefone, setTelefone] = useState(colaborador ? mascaraTelefone(colaborador.telefone) : "");
  const [setor, setSetor] = useState<Setor>(colaborador?.setor === "financeiro" ? "financeiro" : "vendas");
  const [salario, setSalario] = useState(centavosParaCampo(colaborador?.salarioFixo ?? null));
  const [dia, setDia] = useState(colaborador ? String(colaborador.diaPagamento) : "5");
  const [pix, setPix] = useState(colaborador?.chavePix ?? "");
  const [comissao, setComissao] = useState(
    colaborador && colaborador.comissaoBps > 0 ? bpsParaCampo(colaborador.comissaoBps) : "",
  );
  const [frustrado, setFrustrado] = useState(bpsParaCampo(colaborador?.frustradoBps ?? null));
  const [vendedores, setVendedores] = useState(colaborador?.vendedoresAtribuidos ?? []);
  const [ativo, setAtivo] = useState(colaborador?.ativo ?? true);
  const [senha, setSenha] = useState(() => (colaborador ? "" : gerarSenhaProvisoria()));
  const [salvando, setSalvando] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [confirmandoReducao, setConfirmandoReducao] = useState(false);

  const comissaoBps = parsePercentual(comissao) ?? 0;
  const frustradoBps = parsePercentual(frustrado) ?? 0;

  const opcoesVendedores = colaboradores
    .filter((c) => c.setor === "vendas" && (c.ativo || vendedores.includes(c.id)))
    .map((c) => {
      const outro = colaboradores.find(
        (x) => x.id !== colaborador?.id && x.setor === "financeiro" && x.vendedoresAtribuidos.includes(c.id),
      );
      return { valor: c.id, rotulo: c.nome, detalhe: outro ? `com ${outro.apelido}` : undefined };
    });

  // Frustração real da carteira que está sendo montada, antes de salvar.
  const frustracaoCarteira = useMemo(
    () => taxaFrustracao(pedidos.filter((p) => vendedores.includes(p.vendedorId))),
    [pedidos, vendedores],
  );
  const pedidosCarteira = pedidos.filter((p) => vendedores.includes(p.vendedorId)).length;

  const reduzindoFrustrado =
    colaborador?.setor === "vendas" &&
    setor === "vendas" &&
    colaborador.frustradoBps !== null &&
    frustradoBps < colaborador.frustradoBps;

  function validar(): boolean {
    const e: Record<string, string> = {};
    if (!nome.trim()) e.nome = "Informe o nome.";
    if (!RE_EMAIL.test(email.trim())) e.email = "Informe um e-mail válido. É o login.";
    else if (
      colaboradores.some((c) => c.id !== colaborador?.id && c.email.toLowerCase() === email.trim().toLowerCase())
    ) {
      e.email = "Este e-mail já é login de outra pessoa.";
    }
    const salarioCentavos = salario.trim() === "" ? 0 : parseBRL(salario);
    if (salarioCentavos === null || salarioCentavos < 0) e.salario = "Valor inválido.";
    const diaNumero = Number(dia);
    if (!(diaNumero >= 1 && diaNumero <= 28)) e.dia = "Um dia de 1 a 28.";
    if (!(comissaoBps > 0) || comissaoBps > 10_000) e.comissao = "Informe a % de comissão.";
    if (!colaborador) {
      const problema = problemaDaSenha(senha, email.trim());
      if (problema) e.senha = problema;
    }
    if (setor === "vendas" && (frustrado.trim() === "" || frustradoBps < 0 || frustradoBps >= 10_000)) {
      e.frustrado = "Informe a % de frustrado, de 0 a 99.";
    }
    setErros(e);
    return Object.keys(e).length === 0;
  }

  function tentarSalvar() {
    if (!validar()) return;
    // Reduzir o frustrado aumenta a comissão de alguém: pede confirmação.
    if (reduzindoFrustrado) {
      setConfirmandoReducao(true);
      return;
    }
    salvar();
  }

  async function salvar() {
    setSalvando(true);
    const salvo = await salvarColaborador(
      {
      id: colaborador?.id,
      nome: nome.trim(),
      email: email.trim().toLowerCase(),
      telefone: digitos(telefone),
      setor: setor === "financeiro" ? "financeiro" : "vendas",
      avatarUrl,
      ativo,
      vendedoresAtribuidos: vendedores,
      salarioFixo: salario.trim() === "" ? 0 : (parseBRL(salario) ?? 0),
      diaPagamento: Number(dia),
      chavePix: pix.trim() || null,
      comissaoBps,
      frustradoBps: setor === "vendas" ? frustradoBps : null,
      },
      colaborador ? null : senha,
    );
    setSalvando(false);
    if (!salvo) return;
    toast.success(colaborador ? "Colaborador atualizado" : "Colaborador cadastrado", {
      description: colaborador
        ? `As regras novas de ${salvo.apelido} já valem para o fechamento em aberto.`
        : `Passe para ${salvo.apelido} o login ${salvo.email} e a senha provisória. Ela será trocada no primeiro acesso.`,
      duration: 12_000,
    });
    aoFechar();
  }

  return (
    <Modal open onOpenChange={(v) => !v && aoFechar()}>
      <ModalConteudo larguraMaxima="max-w-2xl">
        <ModalCabecalho
          titulo={colaborador ? `Editar ${colaborador.nome}` : "Novo colaborador"}
          descricao="Cadastro, remuneração e as regras de comissão do setor."
        />

        <div className="flex flex-col gap-5">
          <Secao titulo="Quem é">
            <EnvioImagem nome={nome} url={avatarUrl} aoMudar={setAvatarUrl} rotulo="Enviar foto" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo rotulo="Nome" obrigatorio erro={erros.nome}>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" autoFocus />
              </Campo>
              <Campo rotulo="E-mail de login" obrigatorio erro={erros.email}>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nome@axis.com.br"
                />
              </Campo>
              {!colaborador && (
                <Campo
                  rotulo="Senha provisória"
                  obrigatorio
                  erro={erros.senha}
                  ajuda="Anote e passe à pessoa. Ela troca no primeiro acesso."
                >
                  <div className="flex gap-2">
                    <Input
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      className="tabular"
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <Botao
                      type="button"
                      variante="secundaria"
                      tamanho="icone"
                      aria-label="Gerar outra senha"
                      onClick={() => setSenha(gerarSenhaProvisoria())}
                    >
                      <Icone nome="atualizar" size={16} />
                    </Botao>
                  </div>
                </Campo>
              )}
              <Campo rotulo="Telefone" ajuda="Opcional.">
                <Input
                  value={telefone}
                  onChange={(e) => setTelefone(mascaraTelefone(e.target.value))}
                  inputMode="tel"
                  placeholder="(11) 90000-0000"
                  className="tabular"
                />
              </Campo>
              <div className="flex flex-col gap-1.5">
                <Label>Setor</Label>
                <ControleSegmentado
                  valor={setor}
                  aoMudar={setSetor}
                  opcoes={[
                    { valor: "vendas", rotulo: "Vendas", icone: "pedidos" },
                    { valor: "financeiro", rotulo: "Financeiro", icone: "cobranca" },
                  ]}
                />
              </div>
            </div>
          </Secao>

          <Secao titulo="Remuneração fixa">
            <div className="grid gap-4 sm:grid-cols-3">
              <Campo rotulo="Salário fixo" erro={erros.salario}>
                <Input
                  value={salario}
                  onChange={(e) => setSalario(e.target.value)}
                  inputMode="decimal"
                  placeholder="R$ 0,00"
                  className="tabular"
                />
              </Campo>
              <Campo rotulo="Dia de pagamento" erro={erros.dia} ajuda="Do mês seguinte.">
                <Input
                  value={dia}
                  onChange={(e) => setDia(e.target.value.replace(/\D/g, "").slice(0, 2))}
                  inputMode="numeric"
                  className="tabular"
                />
              </Campo>
              <Campo rotulo="Chave Pix">
                <Input value={pix} onChange={(e) => setPix(e.target.value)} placeholder="E-mail, CPF ou telefone" />
              </Campo>
            </div>
          </Secao>

          {setor === "vendas" ? (
            <Secao
              titulo="Comissão de vendedor"
              descricao="Metas deste colaborador contam pedidos agendados, menos os cancelados."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo rotulo="% de comissão" obrigatorio erro={erros.comissao}>
                  <Input
                    value={comissao}
                    onChange={(e) => setComissao(e.target.value)}
                    inputMode="decimal"
                    placeholder="3"
                    className="tabular"
                  />
                </Campo>
                <Campo
                  rotulo="% de frustrado fixo"
                  obrigatorio
                  erro={erros.frustrado}
                  ajuda={
                    colaborador?.frustradoBps != null
                      ? `Hoje: ${formatBps(colaborador.frustradoBps, 1)}. Reduzir pede confirmação.`
                      : "Combinado com o vendedor; não acompanha a frustração real."
                  }
                >
                  <Input
                    value={frustrado}
                    onChange={(e) => setFrustrado(e.target.value)}
                    inputMode="decimal"
                    placeholder="30"
                    className="tabular"
                  />
                </Campo>
              </div>

              <div className="flex flex-col gap-2 rounded-[var(--radius-card-sm)] border border-border bg-surface-2 px-4 py-3">
                <p className="text-[13px]">
                  <span className="font-medium">comissão</span> = faturamento bruto dos pedidos enviados no
                  período × (1 − % frustrado) × % comissão
                </p>
                <p className="text-xs text-muted-fg">
                  Cancelados não entram: nunca foram enviados.
                </p>
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-border pt-2 text-[13px]">
                  <span className="tabular text-muted-fg">
                    Exemplo: {contaVendedor(EXEMPLO_ENVIADO, frustradoBps, comissaoBps)}
                  </span>
                  <span className="tabular font-medium">
                    = {formatBRL(comissaoVendedor(EXEMPLO_ENVIADO, frustradoBps, comissaoBps))}
                  </span>
                </div>
              </div>
            </Secao>
          ) : (
            <Secao
              titulo="Comissão de cobrador"
              descricao="Metas deste colaborador contam pedidos pagos dos vendedores atribuídos."
            >
              <Campo
                rotulo="% de comissão sobre o valor recebido"
                obrigatorio
                erro={erros.comissao}
                className="sm:max-w-xs"
              >
                <Input
                  value={comissao}
                  onChange={(e) => setComissao(e.target.value)}
                  inputMode="decimal"
                  placeholder="1,5"
                  className="tabular"
                />
              </Campo>
              <Campo rotulo="Vendedores atribuídos" ajuda="Define quais pedidos este cobrador vê e cobra.">
                <SelecaoMultipla
                  opcoes={opcoesVendedores}
                  valores={vendedores}
                  aoMudar={setVendedores}
                  vazio="Nenhum vendedor cadastrado."
                />
              </Campo>
              <div className="flex items-center justify-between gap-4 rounded-[var(--radius-card-sm)] border border-border bg-surface-2 px-4 py-3">
                <div className="flex flex-col">
                  <span className="text-[13px] font-medium">Frustração real da carteira</span>
                  <span className="text-xs text-muted-fg">
                    Cancelados, reembolsados e inadimplentes sobre {pedidosCarteira} pedidos.
                  </span>
                </div>
                <span className="tabular text-xl font-medium">
                  {frustracaoCarteira === null ? "—" : formatPercentual(frustracaoCarteira)}
                </span>
              </div>
            </Secao>
          )}

          <CampoAtivo
            ativo={ativo}
            aoMudar={setAtivo}
            rotulo="Colaborador ativo"
            descricao="Inativo, perde o acesso e sai do ranking. O histórico fica."
          />
        </div>

        <ModalRodape>
          <Botao variante="secundaria" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao variante="principal" onClick={tentarSalvar} disabled={salvando}>
            <Icone nome="check" size={15} />
            {colaborador ? "Salvar colaborador" : "Cadastrar colaborador"}
          </Botao>
        </ModalRodape>

        <ModalConfirmacao
          aberto={confirmandoReducao}
          titulo="Reduzir o frustrado?"
          mensagem="O frustrado menor aumenta a comissão deste vendedor já no fechamento em aberto."
          itens={
            colaborador?.frustradoBps != null
              ? [
                  `${colaborador.nome}`,
                  `Frustrado: de ${formatBps(colaborador.frustradoBps, 1)} para ${formatBps(frustradoBps, 1)}`,
                  `Em R$ 100.000,00 enviados: de ${formatBRL(
                    comissaoVendedor(EXEMPLO_ENVIADO, colaborador.frustradoBps, comissaoBps),
                  )} para ${formatBRL(comissaoVendedor(EXEMPLO_ENVIADO, frustradoBps, comissaoBps))}`,
                ]
              : []
          }
          rotuloConfirmar="Reduzir o frustrado"
          aoCancelar={() => setConfirmandoReducao(false)}
          aoConfirmar={() => {
            setConfirmandoReducao(false);
            salvar();
          }}
        />
      </ModalConteudo>
    </Modal>
  );
}
