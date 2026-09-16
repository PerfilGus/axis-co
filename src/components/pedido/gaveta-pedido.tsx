"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Pedido } from "@/lib/types";
import {
  formatBRL,
  formatCEP,
  formatCPF,
  formatData,
  formatDataHora,
  formatTelefone,
} from "@/lib/format";
import { CICLO_PEDIDO, estiloDoTom, STATUS_AJUSTE, STATUS_PEDIDO } from "@/lib/status";
import { ROTULO_FORMA } from "@/lib/taxas";
import { useSessao } from "@/lib/providers/sessao";
import { usePedidos } from "@/lib/providers/pedidos";
import { useEquipe } from "@/lib/providers/equipe";
import { useCadastros } from "@/lib/providers/cadastros";
import { codigoCompleto } from "@/lib/mock/marketing";
import { Icone } from "@/components/icone";
import { Botao } from "@/components/ui/button";
import {
  Gaveta,
  GavetaCabecalho,
  GavetaConteudo,
  GavetaCorpo,
  GavetaRodape,
} from "@/components/ui/drawer";
import { ControleSegmentado } from "@/components/shared/controles";
import { EnvioArquivo } from "@/components/shared/envio-arquivo";
import { IndicadorEtapas } from "@/components/shared/etapas";
import { SeloFonte, SeloStatusPedido, SeloTom } from "@/components/shared/selo-status";
import { EstadoVazio } from "@/components/shared/estado-vazio";
import { toast } from "@/components/ui/toast";
import { LinhaDoTempo } from "./linha-do-tempo";
import { ModalSolicitacao } from "./modal-solicitacao";

type Aba = "resumo" | "linha" | "anexos";

function Secao({
  titulo,
  acao,
  children,
}: {
  titulo: string;
  acao?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[11px] font-medium tracking-wide text-muted-fg">
          {titulo}
        </h3>
        {acao}
      </div>
      {children}
    </section>
  );
}

function Linha({
  rotulo,
  valor,
  destaque,
  cor,
}: {
  rotulo: string;
  valor: React.ReactNode;
  destaque?: boolean;
  cor?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="text-[13px] text-muted-fg">{rotulo}</span>
      <span
        className={cn(
          "text-right text-[13px]",
          destaque ? "tabular font-medium" : "",
        )}
        style={cor ? { color: cor } : undefined}
      >
        {valor}
      </span>
    </div>
  );
}

/**
 * Detalhe do pedido em gaveta: resumo, linha do tempo e anexos.
 *
 * Nesta fase nada é persistido — as ações mostram o retorno na interface e
 * atualizam apenas o estado local.
 */
export function GavetaPedido({
  pedido,
  aberto,
  aoFechar,
}: {
  pedido: Pedido | null;
  aberto: boolean;
  aoFechar: () => void;
}) {
  const [aba, setAba] = useState<Aba>("resumo");
  const [solicitando, setSolicitando] = useState(false);
  const { podeEditarPedido, podeExcluirPedido, podeAprovarAjuste, usuario } =
    useSessao();
  const { decidirAjuste, excluir } = usePedidos();
  const { nomeDe: nomeColaborador } = useEquipe();
  const { criativos, linhas, bancos } = useCadastros();

  if (!pedido) return null;

  const def = STATUS_PEDIDO[pedido.status];
  const estilo = estiloDoTom(def.tom);
  const noCiclo = CICLO_PEDIDO.indexOf(pedido.status);
  const interrompido = noCiclo === -1;
  const etapaAtual = interrompido
    ? pedido.status === "cancelado"
      ? 1
      : CICLO_PEDIDO.length - 2
    : noCiclo;

  const criativo = criativos.find((c) => c.id === pedido.criativoId) ?? null;
  const linha = linhas.find((l) => l.id === pedido.linhaWhatsappId) ?? null;
  const banco = bancos.find((b) => b.id === pedido.cobranca.bancoId) ?? null;
  const temAjustePendente = pedido.ajustes.some((a) => a.status === "pendente");
  const endereco = pedido.cliente.endereco;
  const total = pedido.valorTotal + pedido.frete;

  return (
    <Gaveta open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <GavetaConteudo larguraMaxima="sm:max-w-2xl">
        <GavetaCabecalho
          titulo={
            <span className="flex items-center gap-3">
              <span className="tabular">{pedido.codigo}</span>
              <SeloStatusPedido status={pedido.status} />
              {temAjustePendente && <SeloTom tom="bronze">Ajuste pendente</SeloTom>}
            </span>
          }
          descricao={
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>{pedido.cliente.nome}</span>
              <span aria-hidden>·</span>
              <span>
                {endereco.cidade}/{endereco.uf}
              </span>
              <span aria-hidden>·</span>
              <span>Criado em {formatData(pedido.criadoEm)}</span>
            </span>
          }
        />

        <GavetaCorpo className="flex flex-col gap-6">
          <div className="flex flex-col gap-5">
            <IndicadorEtapas
              etapas={CICLO_PEDIDO.map((s) => ({
                chave: s,
                rotulo: STATUS_PEDIDO[s].rotulo,
              }))}
              atual={etapaAtual}
              interrompida={
                interrompido
                  ? { rotulo: def.rotulo, cor: estilo.cor }
                  : null
              }
            />
            <p className="text-[13px] text-muted-fg">{def.descricao}</p>
          </div>

          <ControleSegmentado
            tamanho="sm"
            valor={aba}
            aoMudar={setAba}
            opcoes={[
              { valor: "resumo", rotulo: "Resumo", icone: "documento" },
              { valor: "linha", rotulo: "Linha do tempo", icone: "relogio" },
              {
                valor: "anexos",
                rotulo: "Anexos",
                icone: "anexo",
                contador: pedido.anexos.length,
              },
            ]}
          />

          {aba === "resumo" && (
            <div className="flex flex-col gap-7">
              <Secao
                titulo="Cliente"
                acao={<SeloFonte fonte={pedido.fonte} integracao="VendLiber" />}
              >
                <div className="rounded-[var(--radius-card-sm)] border border-border bg-surface-2 px-4 py-2">
                  <Linha rotulo="Nome" valor={pedido.cliente.nome} />
                  <Linha
                    rotulo="Telefone"
                    valor={formatTelefone(pedido.cliente.telefone)}
                  />
                  <Linha rotulo="CPF" valor={formatCPF(pedido.cliente.cpf)} />
                  <Linha
                    rotulo="Endereço"
                    valor={
                      <span className="block max-w-72">
                        {endereco.logradouro}, {endereco.numero}
                        {endereco.complemento ? `, ${endereco.complemento}` : ""}
                        <br />
                        {endereco.bairro} · {endereco.cidade}/{endereco.uf}
                        <br />
                        CEP {formatCEP(endereco.cep)}
                      </span>
                    }
                  />
                  {endereco.referencia && (
                    <Linha rotulo="Referência" valor={endereco.referencia} />
                  )}
                </div>
              </Secao>

              <Secao titulo="Pedido">
                <div className="rounded-[var(--radius-card-sm)] border border-border bg-surface-2 px-4 py-2">
                  {pedido.itens.map((item) => (
                    <Linha
                      key={item.kitId}
                      rotulo={`${item.quantidade}× ${item.kitNome}`}
                      valor={formatBRL(item.precoUnitario * item.quantidade)}
                      destaque
                    />
                  ))}
                  <Linha rotulo="Frete" valor={formatBRL(pedido.frete)} destaque />
                  <div className="my-1 h-px bg-border" />
                  <Linha rotulo="Total" valor={formatBRL(total)} destaque />
                </div>
                <div className="rounded-[var(--radius-card-sm)] border border-border bg-surface-2 px-4 py-2">
                  <Linha rotulo="Vendedor" valor={nomeColaborador(pedido.vendedorId)} />
                  <Linha
                    rotulo="Criativo"
                    valor={criativo ? `${codigoCompleto(criativo)} · ${criativo.nome}` : "Não identificado"}
                  />
                  <Linha rotulo="Linha de WhatsApp" valor={linha?.nome ?? "—"} />
                  {pedido.agendadoPara && (
                    <Linha
                      rotulo="Agendado para"
                      valor={formatData(pedido.agendadoPara)}
                    />
                  )}
                  {pedido.autorizadoEm && (
                    <Linha
                      rotulo="Autorizado"
                      valor={`${formatDataHora(pedido.autorizadoEm)} por ${nomeColaborador(pedido.autorizadoPor)}`}
                    />
                  )}
                </div>
                {pedido.observacoes && (
                  <p className="rounded-[var(--radius-card-sm)] border border-border bg-surface-2 px-4 py-3 text-[13px] text-muted-fg">
                    {pedido.observacoes}
                  </p>
                )}
              </Secao>

              <Secao
                titulo="Rastreio"
                acao={
                  pedido.rastreio ? (
                    <SeloFonte fonte={pedido.rastreio.fonte} integracao="Correios" />
                  ) : undefined
                }
              >
                {pedido.rastreio ? (
                  <div className="rounded-[var(--radius-card-sm)] border border-border bg-surface-2 px-4 py-2">
                    <Linha
                      rotulo="Código"
                      valor={<span className="tabular">{pedido.rastreio.codigo}</span>}
                    />
                    <Linha rotulo="Serviço" valor={pedido.rastreio.servico} />
                    <Linha
                      rotulo="Postado em"
                      valor={formatData(pedido.rastreio.postadoEm)}
                    />
                    <Linha
                      rotulo="Previsão"
                      valor={formatData(pedido.rastreio.previsaoEntrega)}
                    />
                    <Linha
                      rotulo="Entregue em"
                      valor={formatData(pedido.rastreio.entregueEm)}
                    />
                  </div>
                ) : (
                  <EstadoVazio
                    compacto
                    icone="rastreio"
                    titulo="Sem código de rastreio"
                    descricao="O código é gerado quando o Admin autoriza o envio."
                  />
                )}
              </Secao>

              <Secao titulo="Cobrança">
                <div className="rounded-[var(--radius-card-sm)] border border-border bg-surface-2 px-4 py-2">
                  <Linha
                    rotulo="Responsável"
                    valor={nomeColaborador(pedido.cobranca.responsavelId)}
                  />
                  <Linha
                    rotulo="Tentativas"
                    valor={<span className="tabular">{pedido.cobranca.tentativas}</span>}
                  />
                  <Linha
                    rotulo="Última tentativa"
                    valor={formatData(pedido.cobranca.ultimaTentativaEm)}
                  />
                  <Linha
                    rotulo="Próximo contato"
                    valor={formatData(pedido.cobranca.proximoContatoEm)}
                  />
                  <Linha
                    rotulo="Forma de pagamento"
                    valor={ROTULO_FORMA[pedido.cobranca.formaPagamento]}
                  />
                  {pedido.cobranca.pagoEm && (
                    <Linha
                      rotulo="Pago em"
                      valor={`${formatData(pedido.cobranca.pagoEm)}${banco ? ` · ${banco.nome}` : ""}`}
                    />
                  )}
                  {pedido.cobranca.observacoes && (
                    <Linha rotulo="Observação" valor={pedido.cobranca.observacoes} />
                  )}
                </div>
              </Secao>

              <Secao titulo="Custos gerados">
                {pedido.custos.total > 0 ? (
                  <div className="rounded-[var(--radius-card-sm)] border border-border bg-surface-2 px-4 py-2">
                    <Linha
                      rotulo="Frete"
                      valor={formatBRL(pedido.custos.frete)}
                      destaque
                      cor="var(--st-vermelho-fg)"
                    />
                    <Linha
                      rotulo="Pote"
                      valor={formatBRL(pedido.custos.pote)}
                      destaque
                      cor="var(--st-vermelho-fg)"
                    />
                    <div className="my-1 h-px bg-border" />
                    <Linha
                      rotulo="Total"
                      valor={formatBRL(pedido.custos.total)}
                      destaque
                      cor="var(--st-vermelho-fg)"
                    />
                  </div>
                ) : (
                  <p className="rounded-[var(--radius-card-sm)] border border-border bg-surface-2 px-4 py-3 text-[13px] text-muted-fg">
                    {pedido.status === "cancelado"
                      ? "Cancelado antes do envio: custo zero, conta como frustrado."
                      : "Nenhum custo gerado até aqui."}
                  </p>
                )}
              </Secao>

              <Secao titulo="Ajustes de valor">
                {pedido.ajustes.length === 0 ? (
                  <p className="rounded-[var(--radius-card-sm)] border border-border bg-surface-2 px-4 py-3 text-[13px] text-muted-fg">
                    Nenhum ajuste pedido neste pedido.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {pedido.ajustes.map((ajuste) => {
                      const st = STATUS_AJUSTE[ajuste.status];
                      return (
                        <div
                          key={ajuste.id}
                          className="flex flex-col gap-2 rounded-[var(--radius-card-sm)] border border-border bg-surface-2 p-4"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <SeloTom tom={st.tom}>{st.rotulo}</SeloTom>
                            <span className="tabular text-[13px] text-muted-fg line-through">
                              {formatBRL(ajuste.valorAnterior)}
                            </span>
                            <Icone nome="avancar" size={12} className="text-muted-fg" />
                            <span className="tabular text-[13px] font-medium">
                              {formatBRL(ajuste.valorSolicitado)}
                            </span>
                          </div>
                          <p className="text-[13px] text-muted-fg">{ajuste.motivo}</p>
                          <p className="text-[11px] text-muted-fg/80">
                            Pedido por {nomeColaborador(ajuste.solicitadoPor)} em{" "}
                            {formatDataHora(ajuste.solicitadoEm)}
                          </p>
                          {ajuste.status === "pendente" && podeAprovarAjuste && (
                            <div className="flex gap-2 pt-1">
                              <Botao
                                variante="principal"
                                tamanho="sm"
                                onClick={() => {
                                  decidirAjuste(pedido.id, ajuste.id, "aprovado", usuario.id, null);
                                  if (ajuste.tipo === "exclusao") {
                                    excluir(pedido.id);
                                    aoFechar();
                                  }
                                  toast.success("Solicitação aprovada", {
                                    description: pedido.codigo + " foi atualizado.",
                                  });
                                }}
                              >
                                <Icone nome="check" size={14} />
                                Aprovar
                              </Botao>
                              <Botao
                                variante="secundaria"
                                tamanho="sm"
                                onClick={() => {
                                  decidirAjuste(pedido.id, ajuste.id, "recusado", usuario.id, null);
                                  toast("Solicitação recusada", {
                                    description: pedido.codigo + " segue como estava.",
                                  });
                                }}
                              >
                                Recusar
                              </Botao>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Secao>
            </div>
          )}

          {aba === "linha" && <LinhaDoTempo eventos={pedido.linhaDoTempo} />}

          {aba === "anexos" && (
            <div className="flex flex-col gap-5">
              {pedido.anexos.length > 0 && (
                <ul className="flex flex-col gap-2">
                  {pedido.anexos.map((anexo) => (
                    <li
                      key={anexo.id}
                      className="flex items-center gap-3 rounded-full border border-border bg-surface-2 py-2 pr-4 pl-3.5"
                    >
                      <Icone nome="anexo" size={15} className="text-muted-fg" />
                      <span className="min-w-0 flex-1 truncate text-[13px]">
                        {anexo.nome}
                      </span>
                      <span className="text-[11px] text-muted-fg">
                        {formatData(anexo.criadoEm)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <EnvioArquivo
                rotulo="Anexar comprovante ou foto da entrega"
                aoSelecionar={(arquivos) =>
                  arquivos.length > 0 &&
                  toast.success("Arquivo pronto para envio", {
                    description: "Nada sobe ainda: o upload real entra com o backend.",
                  })
                }
              />
            </div>
          )}
        </GavetaCorpo>

        <GavetaRodape>
          {!podeEditarPedido && (
            <span className="mr-auto text-[11px] text-muted-fg">
              Vendedor não edita nem exclui: a mudança passa pelo Admin.
            </span>
          )}
          <Botao variante="secundaria" onClick={() => setSolicitando(true)}>
            <Icone nome="editar" size={15} />
            {podeEditarPedido ? "Editar pedido" : "Solicitar alteração"}
          </Botao>
          {podeExcluirPedido && (
            <Botao
              variante="perigo"
              onClick={() => {
                excluir(pedido.id);
                aoFechar();
                toast("Pedido excluído", {
                  description: pedido.codigo + " saiu da lista desta sessão.",
                });
              }}
            >
              <Icone nome="excluir" size={15} />
              Excluir
            </Botao>
          )}
        </GavetaRodape>
      </GavetaConteudo>

      <ModalSolicitacao
        pedido={pedido}
        aberto={solicitando}
        aoFechar={() => setSolicitando(false)}
      />
    </Gaveta>
  );
}
