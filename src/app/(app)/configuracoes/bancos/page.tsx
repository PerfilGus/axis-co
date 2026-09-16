"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { BancoPlataforma, PeriodoFranquia, TaxaForma } from "@/lib/types";
import { formatBRL, formatBps } from "@/lib/format";
import { boletosNoPeriodo } from "@/lib/taxas";
import { useCadastros } from "@/lib/providers/cadastros";
import { usePedidos } from "@/lib/providers/pedidos";
import { Icone } from "@/components/icone";
import { Botao } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Interruptor } from "@/components/ui/switch";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { EstadoVazio } from "@/components/shared/estado-vazio";
import { Miniatura } from "@/components/shared/envio-imagem";
import { SeloTom } from "@/components/shared/selo-status";
import { ModalBanco, ModalPlataforma } from "@/components/config/modais-bancos";

const NESTA_JANELA: Record<PeriodoFranquia, string> = {
  semanal: "nesta semana",
  mensal: "neste mês",
  anual: "neste ano",
};

type Edicao = { tipo: "banco" | "plataforma"; registro: BancoPlataforma | null } | null;

function TaxaResumo({ rotulo, taxa, icone }: { rotulo: string; taxa: TaxaForma; icone: "codigo" | "pix" | "cartao" }) {
  const valor = !taxa.ativa
    ? "Não oferece"
    : [taxa.bps > 0 ? formatBps(taxa.bps) : null, taxa.fixa > 0 ? formatBRL(taxa.fixa) : null]
        .filter(Boolean)
        .join(" + ") || "Sem taxa";
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="flex items-center gap-1.5 text-[11px] text-muted-fg">
        <Icone nome={icone} size={12} />
        {rotulo}
      </span>
      <span className={cn("tabular truncate text-[13px] font-medium", !taxa.ativa && "text-muted-fg/60")}>
        {valor}
      </span>
    </div>
  );
}

/**
 * Contador de boletos da franquia. A barra enche até o fim da franquia e fica
 * no tom de alerta quando os boletos passam a pagar tarifa.
 */
function Franquia({ banco, emitidos }: { banco: BancoPlataforma; emitidos: number }) {
  const { quantidade, periodo } = banco.franquiaBoleto;
  if (!banco.boleto.ativa || banco.boleto.fixa === 0) {
    return <p className="text-xs text-muted-fg">Boleto sem tarifa: nenhuma franquia para acompanhar.</p>;
  }
  if (quantidade === 0) {
    return (
      <p className="text-xs text-muted-fg">
        Sem franquia: todo boleto paga {formatBRL(banco.boleto.fixa)}.{" "}
        <span className="tabular">{emitidos}</span> emitidos {NESTA_JANELA[periodo]}.
      </p>
    );
  }
  const pct = Math.min(emitidos / quantidade, 1);
  const estourou = emitidos >= quantidade;
  const restam = Math.max(quantidade - emitidos, 0);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-muted-fg">
          Boletos {NESTA_JANELA[periodo]}
        </span>
        <span className="tabular font-medium">
          {emitidos} de {quantidade} grátis
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{
            width: `${pct * 100}%`,
            backgroundColor: estourou ? "var(--st-laranja-fg)" : "var(--st-verde-fg)",
          }}
        />
      </div>
      <span className="text-[11px] text-muted-fg">
        {estourou
          ? `Franquia esgotada: os próximos pagam ${formatBRL(banco.boleto.fixa)} cada.`
          : `Ainda cabem ${restam} ${restam === 1 ? "boleto" : "boletos"} sem tarifa.`}
      </span>
    </div>
  );
}

function CartaoCasa({
  casa,
  emitidos,
  aoEditar,
  aoAlternar,
}: {
  casa: BancoPlataforma;
  emitidos: number;
  aoEditar: () => void;
  aoAlternar: () => void;
}) {
  const banco = casa.tipo === "banco";
  return (
    <Card className={cn("flex flex-col gap-4 p-5", !casa.ativo && "opacity-70")}>
      <div className="flex items-start gap-3">
        <Miniatura nome={casa.nome} url={casa.iconeUrl} cor={casa.cor} tamanho={44} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium">{casa.nome}</span>
            {!casa.ativo && (
              <SeloTom tom="cinza" ponto={false}>
                Inativo
              </SeloTom>
            )}
          </div>
          <span className="truncate text-xs text-muted-fg">
            {banco ? "Banco" : "Plataforma"}
            {casa.identificador ? ` · ${casa.identificador}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Interruptor
            checked={casa.ativo}
            onCheckedChange={aoAlternar}
            aria-label={casa.ativo ? `Desativar ${casa.nome}` : `Ativar ${casa.nome}`}
          />
          <Botao variante="fantasma" tamanho="iconeSm" aria-label={`Editar ${casa.nome}`} onClick={aoEditar}>
            <Icone nome="editar" size={14} />
          </Botao>
        </div>
      </div>

      <div
        className={cn(
          "grid gap-3 rounded-[var(--radius-card-sm)] bg-surface-2 px-4 py-3",
          banco ? "grid-cols-3" : "grid-cols-1",
        )}
      >
        {banco && <TaxaResumo rotulo="Boleto" taxa={casa.boleto} icone="codigo" />}
        {banco && <TaxaResumo rotulo="Pix" taxa={casa.pix} icone="pix" />}
        <TaxaResumo rotulo="Link de cartão" taxa={casa.cartao} icone="cartao" />
      </div>

      {banco ? (
        <Franquia banco={casa} emitidos={emitidos} />
      ) : (
        <p className="text-xs text-muted-fg">Plataforma não emite boleto nem recebe Pix.</p>
      )}
    </Card>
  );
}

export default function PaginaConfiguracoesBancos() {
  const { bancos, alternarAtivo } = useCadastros();
  const { pedidos } = usePedidos();
  const [edicao, setEdicao] = useState<Edicao>(null);

  const casasBanco = bancos.filter((b) => b.tipo === "banco");
  const plataformas = bancos.filter((b) => b.tipo === "plataforma");

  const secao = (titulo: string, lista: BancoPlataforma[], tipo: "banco" | "plataforma") => (
    <section className="flex flex-col gap-3">
      <h2 className="text-[13px] font-medium text-muted-fg">
        {titulo} · {lista.length}
      </h2>
      {lista.length === 0 ? (
        <EstadoVazio
          compacto
          icone={tipo === "banco" ? "bancos" : "loja"}
          titulo={tipo === "banco" ? "Nenhum banco cadastrado" : "Nenhuma plataforma cadastrada"}
          descricao={
            tipo === "banco"
              ? "Sem banco, não há onde registrar pagamentos por Pix e boleto."
              : "Sem plataforma, o link de cartão fica só com os bancos que o oferecem."
          }
          acao={
            <Botao variante="secundaria" tamanho="sm" onClick={() => setEdicao({ tipo, registro: null })}>
              Cadastrar
            </Botao>
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {lista.map((casa) => (
            <CartaoCasa
              key={casa.id}
              casa={casa}
              emitidos={casa.tipo === "banco" ? boletosNoPeriodo(pedidos, casa) : 0}
              aoEditar={() => setEdicao({ tipo, registro: casa })}
              aoAlternar={() => alternarAtivo("banco", casa.id)}
            />
          ))}
        </div>
      )}
    </section>
  );

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Bancos e plataformas"
        descricao="Onde o dinheiro entra e quanto cada casa fica de cada recebimento."
        extras={
          <Botao variante="secundaria" onClick={() => setEdicao({ tipo: "plataforma", registro: null })}>
            <Icone nome="loja" size={15} />
            Nova plataforma
          </Botao>
        }
        acao={
          <Botao variante="principal" onClick={() => setEdicao({ tipo: "banco", registro: null })}>
            <Icone nome="adicionar" size={16} />
            Novo banco
          </Botao>
        }
      />

      {secao("Bancos", casasBanco, "banco")}
      {secao("Plataformas", plataformas, "plataforma")}

      <p className="text-xs text-muted-fg">
        O contador de boletos sai dos pagamentos registrados na Cobrança. As taxas são do cadastro,
        conferidas com o extrato; a leitura automática entra com a integração bancária.
      </p>

      <ModalBanco
        aberto={edicao?.tipo === "banco"}
        banco={edicao?.tipo === "banco" ? edicao.registro : null}
        aoFechar={() => setEdicao(null)}
      />
      <ModalPlataforma
        aberto={edicao?.tipo === "plataforma"}
        plataforma={edicao?.tipo === "plataforma" ? edicao.registro : null}
        aoFechar={() => setEdicao(null)}
      />
    </div>
  );
}
