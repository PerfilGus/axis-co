"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { StatusRastreio } from "@/lib/types";
import { STATUS_RASTREIO, ORDEM_SECOES_RASTREIO } from "@/lib/status";
import { usePedidos } from "@/lib/providers/pedidos";
import { useCadastros } from "@/lib/providers/cadastros";
import {
  agruparEmSecoes,
  rastreaveis,
  rastreiosVisiveis,
  type AbaRastreio,
  type OrdemRastreio,
} from "@/lib/rastreio/lista";
import { baixarCsv } from "@/lib/rastreio/csv";
import { Icone } from "@/components/icone";
import { Botao } from "@/components/ui/button";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { ControleSegmentado } from "@/components/shared/controles";
import { EstadoVazio } from "@/components/shared/estado-vazio";
import { ModalConfirmacao } from "@/components/shared/modal-confirmacao";
import {
  Selecao,
  SelecaoConteudo,
  SelecaoGatilho,
  SelecaoItem,
  SelecaoValor,
} from "@/components/ui/select";
import { CartaoRastreio } from "@/components/rastreio/cartao-rastreio";
import { PainelRastreio } from "@/components/rastreio/painel-rastreio";
import { toast } from "@/components/ui/toast";

/**
 * Rastreio — migração do projeto axis-tracking.
 *
 * O inventário da tela original e a marcação do que foi portado estão em
 * `referencia/axis-tracking/INVENTARIO.md`. As mudanças em relação ao
 * original, todas anotadas lá:
 *
 * - Não há inclusão manual: os objetos vêm dos pedidos autorizados.
 * - Não há exclusão: aqui o pedido é o registro financeiro, e tirá-lo da lista
 *   é arquivar — manual e reversível (§12 do inventário).
 * - "Atualizar rastreios" chama o servidor, que responde sem novidade enquanto
 *   a integração com os Correios não está conectada.
 */

/** Ciclo automático de 1 minuto, como no original. */
const INTERVALO_ATUALIZACAO_MS = 60_000;

export default function PaginaRastreio() {
  const {
    pedidos,
    arquivarRastreio,
    limparDestaque,
    redefinirDestaques,
    atualizarRastreios,
    revelarDados,
  } = usePedidos();
  const { kits } = useCadastros();

  const [aba, setAba] = useState<AbaRastreio>("transito");
  const [filtro, setFiltro] = useState<StatusRastreio | "todos">("todos");
  const [ordem, setOrdem] = useState<OrdemRastreio>("atualizacao");
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [selecionando, setSelecionando] = useState(false);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [confirmando, setConfirmando] = useState(false);
  const [atualizando, setAtualizando] = useState(false);

  const todos = useMemo(() => rastreaveis(pedidos), [pedidos]);
  const emTransito = todos.filter((p) => !p.rastreio.arquivado).length;
  const arquivados = todos.length - emTransito;

  const visiveis = useMemo(
    () => rastreiosVisiveis(pedidos, aba, filtro),
    [pedidos, aba, filtro],
  );
  const secoes = useMemo(
    () => agruparEmSecoes(visiveis, ordem),
    [visiveis, ordem],
  );

  const aberto = abertoId
    ? (todos.find((p) => p.id === abertoId) ?? null)
    : null;

  /* ---------------- ações ---------------- */

  // Abrir um pedido consome o destaque; clicar de novo no mesmo fecha o painel.
  function abrirOuFechar(id: string) {
    if (selecionando) {
      setMarcados((atual) => {
        const proximo = new Set(atual);
        if (proximo.has(id)) proximo.delete(id);
        else proximo.add(id);
        return proximo;
      });
      return;
    }
    if (abertoId === id) {
      setAbertoId(null);
      return;
    }
    setAbertoId(id);
    limparDestaque(id);
  }

  const executarAtualizacao = useCallback(
    async ({ silencioso }: { silencioso: boolean }) => {
      // Dois ciclos não se sobrepõem.
      if (atualizando) return;
      setAtualizando(true);

      const resultado = await atualizarRastreios();
      setAtualizando(false);
      if (!resultado) return;

      if (resultado.atualizados > 0) {
        toast.success(
          `${resultado.atualizados} rastreio${resultado.atualizados === 1 ? "" : "s"} atualizado${resultado.atualizados === 1 ? "" : "s"}`,
        );
      } else if (!silencioso) {
        toast("Nenhuma novidade nos rastreios", {
          description: resultado.integrado
            ? undefined
            : "A integração com os Correios ainda não está conectada.",
        });
      }
    },
    [atualizando, atualizarRastreios],
  );

  function alternarSelecao() {
    if (!selecionando) {
      setSelecionando(true);
      setMarcados(new Set());
      setAbertoId(null);
      return;
    }
    if (marcados.size > 0) setConfirmando(true);
  }

  function sairDaSelecao() {
    setSelecionando(false);
    setMarcados(new Set());
  }

  async function confirmarArquivamento() {
    const ids = [...marcados];
    const paraArquivar = aba === "transito";
    const total = await arquivarRastreio(ids, paraArquivar);
    setConfirmando(false);
    if (total === null) return;
    sairDaSelecao();
    toast.success(
      `${total} pedido${total === 1 ? "" : "s"} movido${total === 1 ? "" : "s"} para ${paraArquivar ? "Arquivados" : "Em Trânsito"}`,
    );
  }

  async function arquivarUm() {
    if (!aberto) return;
    const paraArquivar = !aberto.rastreio.arquivado;
    if ((await arquivarRastreio([aberto.id], paraArquivar)) === null) return;
    setAbertoId(null);
    toast.success(
      paraArquivar
        ? "Pedido movido para Arquivados"
        : "Pedido movido para Em Trânsito",
    );
  }

  /* ---------------- ciclo automático ---------------- */

  // Pausa com a aba em segundo plano, com modal aberto e durante a seleção —
  // repintar nessas horas rola a lista de quem está lendo ou perde a seleção.
  const pausado = confirmando || selecionando;

  // O ciclo é montado uma vez só; estas referências levam o estado de agora
  // para dentro dele sem remontar o intervalo a cada render.
  const atualizacaoRef = useRef(executarAtualizacao);
  const pausadoRef = useRef(pausado);
  useEffect(() => {
    atualizacaoRef.current = executarAtualizacao;
    pausadoRef.current = pausado;
  });

  useEffect(() => {
    const ciclo = window.setInterval(() => {
      if (document.hidden || pausadoRef.current) return;
      atualizacaoRef.current({ silencioso: true });
    }, INTERVALO_ATUALIZACAO_MS);

    // Voltar para a aba mostra o estado de agora, sem esperar o próximo ciclo.
    // Só conta como "voltar" se a aba chegou a ficar oculta: o navegador também
    // dispara este evento ao abrir a página, e aí não há o que atualizar.
    let esteveOculta = false;
    const aoVoltar = () => {
      if (document.hidden) {
        esteveOculta = true;
        return;
      }
      if (!esteveOculta || pausadoRef.current) return;
      esteveOculta = false;
      atualizacaoRef.current({ silencioso: true });
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      window.clearInterval(ciclo);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, []);

  /* ---------------- render ---------------- */

  const rotuloLote = aba === "transito" ? "Arquivar" : "Desarquivar";

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo={aba === "transito" ? "Em Trânsito" : "Arquivados"}
        descricao="Objetos em circulação e o que já chegou ao cliente."
        extras={
          <span className="tabular hidden rounded-full bg-surface-2 px-3 py-1.5 text-[12px] text-muted-fg sm:inline-flex">
            {visiveis.length} pedido{visiveis.length === 1 ? "" : "s"}
          </span>
        }
        acao={
          <Botao
            variante="principal"
            onClick={() => executarAtualizacao({ silencioso: false })}
            disabled={atualizando}
          >
            <Icone
              nome="atualizar"
              size={16}
              className={atualizando ? "animate-spin" : undefined}
            />
            Atualizar rastreios
          </Botao>
        }
      />

      <ControleSegmentado
        valor={aba}
        aoMudar={(valor) => {
          setAba(valor);
          setAbertoId(null);
          // O botão troca de função entre as abas; a seleção não sobrevive.
          sairDaSelecao();
        }}
        opcoes={[
          {
            valor: "transito",
            rotulo: "Em Trânsito",
            icone: "rastreio",
            contador: emTransito,
          },
          {
            valor: "arquivados",
            rotulo: "Arquivados",
            icone: "arquivar",
            contador: arquivados,
          },
        ]}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Selecao
          value={filtro}
          onValueChange={(v) => setFiltro(v as StatusRastreio | "todos")}
        >
          <SelecaoGatilho className="w-auto min-w-48 rounded-full">
            <SelecaoValor />
          </SelecaoGatilho>
          <SelecaoConteudo>
            <SelecaoItem value="todos">Todos os status</SelecaoItem>
            {ORDEM_SECOES_RASTREIO.map((status) => (
              <SelecaoItem key={status} value={status}>
                {STATUS_RASTREIO[status].rotulo}
              </SelecaoItem>
            ))}
          </SelecaoConteudo>
        </Selecao>

        <ControleSegmentado
          tamanho="sm"
          valor={ordem}
          aoMudar={setOrdem}
          opcoes={[
            { valor: "atualizacao", rotulo: "Atualização", icone: "relogio" },
            { valor: "criacao", rotulo: "Criação", icone: "calendario" },
          ]}
        />

        <Botao
          variante="secundaria"
          tamanho="sm"
          onClick={async () => {
            // O CSV leva telefone completo: a exportação fica registrada.
            const dados = await revelarDados(visiveis.map((p) => p.id), "exportacao");
            if (!dados) return;
            const porId = new Map(dados.map((d) => [d.pedidoId, d]));
            baixarCsv(
              visiveis.map((p) => ({
                ...p,
                cliente: { ...p.cliente, telefone: porId.get(p.id)?.telefone ?? p.cliente.telefone },
              })),
              aba,
              kits,
            );
            toast.success("CSV exportado");
          }}
          disabled={visiveis.length === 0}
        >
          <Icone nome="exportar" size={14} />
          Exportar CSV
        </Botao>

        <Botao
          variante="secundaria"
          tamanho="sm"
          onClick={() => {
            redefinirDestaques();
            toast.success("Destaques redefinidos");
          }}
        >
          <Icone nome="atualizar" size={14} />
          Redefinir destacados
        </Botao>

        <Botao
          variante={selecionando && marcados.size > 0 ? "principal" : "secundaria"}
          tamanho="sm"
          onClick={alternarSelecao}
          disabled={selecionando && marcados.size === 0}
        >
          <Icone
            nome={aba === "transito" ? "arquivar" : "desarquivar"}
            size={14}
          />
          {rotuloLote}
          {selecionando && marcados.size > 0 ? ` (${marcados.size})` : ""}
        </Botao>

        {selecionando && (
          <Botao variante="fantasma" tamanho="sm" onClick={sairDaSelecao}>
            Cancelar
          </Botao>
        )}
      </div>

      {visiveis.length === 0 ? (
        <EstadoVazio
          icone="rastreio"
          titulo={
            todos.length === 0
              ? "Nenhum objeto em circulação"
              : "Nenhum pedido encontrado com esse filtro."
          }
          descricao={
            todos.length === 0
              ? "Os objetos entram aqui sozinhos quando o Admin autoriza o envio — não há inclusão manual."
              : "Troque o filtro de status ou a aba para ver os outros objetos."
          }
        />
      ) : (
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="flex min-w-0 flex-1 flex-col gap-7">
            {secoes.map((secao) => (
              <section key={secao.chave}>
                <div className="mb-3 flex items-center gap-2.5">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: secao.cor }}
                    aria-hidden
                  />
                  <h2 className="text-[13px] font-medium">{secao.titulo}</h2>
                  <span className="tabular rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted-fg">
                    {secao.itens.length}
                  </span>
                  <span className="h-px flex-1 bg-border" aria-hidden />
                </div>
                <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
                  {secao.itens.map((pedido) => (
                    <CartaoRastreio
                      key={pedido.id}
                      pedido={pedido}
                      selecionado={abertoId === pedido.id}
                      marcado={marcados.has(pedido.id)}
                      modoSelecao={selecionando}
                      aoClicar={() => abrirOuFechar(pedido.id)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>

          {aberto && (
            <div className="w-full shrink-0 lg:w-[400px]">
              <PainelRastreio
                pedido={aberto}
                aoFechar={() => setAbertoId(null)}
                aoArquivar={arquivarUm}
              />
            </div>
          )}
        </div>
      )}

      <ModalConfirmacao
        aberto={confirmando}
        titulo={`${rotuloLote} pedidos`}
        mensagem={`${marcados.size} pedido(s) vão para ${aba === "transito" ? "Arquivados" : "Em Trânsito"}. A ação é reversível.`}
        itens={todos
          .filter((p) => marcados.has(p.id))
          .map((p) => `${p.rastreio.codigo}  —  ${p.cliente.nome || "sem nome"}`)}
        rotuloConfirmar={rotuloLote}
        icone={aba === "transito" ? "arquivar" : "desarquivar"}
        aoConfirmar={confirmarArquivamento}
        aoCancelar={() => setConfirmando(false)}
      />
    </div>
  );
}
