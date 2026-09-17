"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { StatusRastreio } from "@/lib/types";
import { STATUS_RASTREIO, ORDEM_SECOES_RASTREIO } from "@/lib/status";
import { usePedidos } from "@/lib/providers/pedidos";
import { useCadastros } from "@/lib/providers/cadastros";
import { useSessao } from "@/lib/providers/sessao";
import { useTelaLarga } from "@/lib/tela";
import { useParametroUrl } from "@/lib/url";
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
import { Caixa } from "@/components/ui/checkbox";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { CampoBusca } from "@/components/shared/campo-busca";
import { ControleSegmentado } from "@/components/shared/controles";
import { EstadoVazio } from "@/components/shared/estado-vazio";
import { ModalConfirmacao } from "@/components/shared/modal-confirmacao";
import {
  Gaveta,
  GavetaConteudo,
  GavetaDescricao,
  GavetaTitulo,
} from "@/components/ui/drawer";
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
 * - Apagar existe só em Arquivados, só para o Admin, e tira o rastreio desta
 *   aba sem tocar no pedido (§12). Não há limpeza automática.
 * - "Atualizar rastreios" chama o servidor, que responde sem novidade enquanto
 *   a integração com os Correios não está conectada.
 */

/** Ciclo automático de 1 minuto, como no original. */
const INTERVALO_ATUALIZACAO_MS = 60_000;

/** Abaixo disso a máscara do telefone já basta para a busca local. */
const DIGITOS_BUSCA_TELEFONE = 6;

type Operacao = "arquivar" | "desarquivar" | "apagar";

const plural = (n: number, singular: string, plural: string) => (n === 1 ? singular : plural);

export default function PaginaRastreio() {
  const {
    pedidos,
    arquivarRastreio,
    apagarRastreio,
    buscarPorTelefone,
    limparDestaque,
    redefinirDestaques,
    atualizarRastreios,
    revelarDados,
  } = usePedidos();
  const { kits } = useCadastros();
  const { podeApagarRastreio } = useSessao();
  const telaLarga = useTelaLarga();

  const [aba, setAba] = useState<AbaRastreio>("transito");
  const [filtro, setFiltro] = useState<StatusRastreio | "todos">("todos");
  const [ordem, setOrdem] = useState<OrdemRastreio>("atualizacao");
  const [termo, setTermo] = useState("");
  const [porTelefone, setPorTelefone] = useState<{ termo: string; ids: Set<string> }>({
    termo: "",
    ids: new Set(),
  });
  const [abertoId, setAbertoId] = useParametroUrl("pedido");
  const [abaConferida, setAbaConferida] = useState<string | null>(null);
  const [selecionando, setSelecionando] = useState(false);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [confirmacao, setConfirmacao] = useState<{ operacao: Operacao; ids: string[] } | null>(null);
  const [atualizando, setAtualizando] = useState(false);

  const todos = useMemo(() => rastreaveis(pedidos), [pedidos]);
  const emTransito = todos.filter((p) => !p.rastreio.arquivado).length;
  const arquivados = todos.length - emTransito;

  // O telefone completo só o servidor conhece; a resposta vale para o termo
  // que a pediu, e um termo mais novo a descarta.
  useEffect(() => {
    if (termo.replace(/\D/g, "").length < DIGITOS_BUSCA_TELEFONE) return;
    let valido = true;
    buscarPorTelefone(termo).then((ids) => {
      if (valido && ids) setPorTelefone({ termo, ids: new Set(ids) });
    });
    return () => {
      valido = false;
    };
  }, [termo, buscarPorTelefone]);

  const idsPorTelefone = useMemo(
    () => (porTelefone.termo === termo ? porTelefone.ids : new Set<string>()),
    [porTelefone, termo],
  );

  const visiveis = useMemo(
    () => rastreiosVisiveis(pedidos, aba, filtro, { termo, idsPorTelefone }),
    [pedidos, aba, filtro, termo, idsPorTelefone],
  );
  const secoes = useMemo(
    () => agruparEmSecoes(visiveis, ordem),
    [visiveis, ordem],
  );

  // A seleção só age sobre o que está na tela: trocar a busca não leva junto
  // itens que ficaram escondidos.
  const marcadosVisiveis = useMemo(
    () => visiveis.filter((p) => marcados.has(p.id)).map((p) => p.id),
    [visiveis, marcados],
  );
  const todosMarcados = visiveis.length > 0 && marcadosVisiveis.length === visiveis.length;

  const aberto = abertoId
    ? (todos.find((p) => p.id === abertoId) ?? null)
    : null;

  // Aberto por link (busca global, notificação): mostra a aba onde ele está.
  if (aberto && abaConferida !== aberto.id) {
    setAbaConferida(aberto.id);
    const abaDoItem: AbaRastreio = aberto.rastreio.arquivado ? "arquivados" : "transito";
    if (abaDoItem !== aba) setAba(abaDoItem);
  }

  // Abrir consome o destaque, venha o pedido de um toque ou de um link.
  useEffect(() => {
    if (aberto?.rastreio.destacado) limparDestaque(aberto.id);
  }, [aberto, limparDestaque]);

  /* ---------------- ações ---------------- */

  function alternarMarca(id: string, marcar?: boolean) {
    setMarcados((atual) => {
      const proximo = new Set(atual);
      const ligar = marcar ?? !proximo.has(id);
      if (ligar) proximo.add(id);
      else proximo.delete(id);
      return proximo;
    });
  }

  function marcarTodos(marcar: boolean) {
    setMarcados(marcar ? new Set(visiveis.map((p) => p.id)) : new Set());
  }

  // Abrir um pedido consome o destaque; clicar de novo no mesmo fecha o painel.
  function abrirOuFechar(id: string) {
    if (selecionando) {
      alternarMarca(id);
      return;
    }
    if (abertoId === id) {
      setAbertoId(null);
      return;
    }
    setAbertoId(id);
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
          `${resultado.atualizados} ${plural(resultado.atualizados, "rastreio atualizado", "rastreios atualizados")}`,
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
    if (marcadosVisiveis.length > 0) {
      setConfirmacao({ operacao: "arquivar", ids: marcadosVisiveis });
    }
  }

  function sairDaSelecao() {
    setSelecionando(false);
    setMarcados(new Set());
  }

  async function confirmar() {
    if (!confirmacao) return;
    const { operacao, ids } = confirmacao;

    if (operacao === "apagar") {
      const total = await apagarRastreio(ids);
      setConfirmacao(null);
      if (total === null) return;
      if (abertoId && ids.includes(abertoId)) setAbertoId(null);
      sairDaSelecao();
      toast.success(`${total} ${plural(total, "rastreio apagado", "rastreios apagados")}`, {
        description: "Os pedidos seguem intactos.",
      });
      return;
    }

    const paraArquivar = operacao === "arquivar";
    const total = await arquivarRastreio(ids, paraArquivar);
    setConfirmacao(null);
    if (total === null) return;
    if (abertoId && ids.includes(abertoId)) setAbertoId(null);
    sairDaSelecao();
    toast.success(
      total === 1
        ? `Pedido movido para ${paraArquivar ? "Arquivados" : "Em Trânsito"}`
        : `${total} pedidos movidos para ${paraArquivar ? "Arquivados" : "Em Trânsito"}`,
    );
  }

  /** Desarquivar e arquivar um item não pedem confirmação; apagar sempre pede. */
  async function arquivarUm(id: string, arquivado: boolean) {
    const paraArquivar = !arquivado;
    if ((await arquivarRastreio([id], paraArquivar)) === null) return;
    if (abertoId === id) setAbertoId(null);
    alternarMarca(id, false);
    toast.success(
      paraArquivar
        ? "Pedido movido para Arquivados"
        : "Pedido movido para Em Trânsito",
    );
  }

  /* ---------------- ciclo automático ---------------- */

  // Pausa com a aba em segundo plano, com modal aberto e durante a seleção —
  // repintar nessas horas rola a lista de quem está lendo ou perde a seleção.
  const pausado = confirmacao !== null || selecionando || marcados.size > 0;

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

  const naoAchou = todos.length > 0 && visiveis.length === 0;

  const textosConfirmacao: Record<Operacao, { titulo: string; mensagem: string; rotulo: string }> = {
    arquivar: {
      titulo: "Arquivar pedidos",
      mensagem: `${confirmacao?.ids.length ?? 0} pedido(s) vão para Arquivados. A ação é reversível.`,
      rotulo: "Arquivar",
    },
    desarquivar: {
      titulo: "Desarquivar pedidos",
      mensagem: `${confirmacao?.ids.length ?? 0} pedido(s) voltam para Em Trânsito. A ação é reversível.`,
      rotulo: "Desarquivar",
    },
    apagar: {
      titulo: `Apagar ${confirmacao?.ids.length ?? 0} ${plural(confirmacao?.ids.length ?? 0, "rastreio", "rastreios")}`,
      mensagem:
        "Sai da aba Rastreio e não volta nas próximas atualizações. O pedido continua intacto: status, valores, histórico e o código de rastreio. Não dá para desfazer.",
      rotulo: "Apagar",
    },
  };
  const textos = confirmacao ? textosConfirmacao[confirmacao.operacao] : null;

  const painel = aberto && (
    <PainelRastreio
      pedido={aberto}
      aoFechar={() => setAbertoId(null)}
      aoArquivar={() => arquivarUm(aberto.id, aberto.rastreio.arquivado)}
      aoApagar={
        podeApagarRastreio && aberto.rastreio.arquivado
          ? () => setConfirmacao({ operacao: "apagar", ids: [aberto.id] })
          : undefined
      }
    />
  );

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
        <CampoBusca
          valor={termo}
          aoMudar={setTermo}
          placeholder="Buscar por nome, telefone, rastreio ou pedido"
          className="basis-full sm:basis-auto sm:max-w-80"
        />

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

        {aba === "transito" && (
          <>
            <Botao
              variante={selecionando && marcadosVisiveis.length > 0 ? "principal" : "secundaria"}
              tamanho="sm"
              onClick={alternarSelecao}
              disabled={selecionando && marcadosVisiveis.length === 0}
            >
              <Icone nome="arquivar" size={14} />
              Arquivar
              {selecionando && marcadosVisiveis.length > 0 ? ` (${marcadosVisiveis.length})` : ""}
            </Botao>

            {selecionando && (
              <Botao variante="fantasma" tamanho="sm" onClick={sairDaSelecao}>
                Cancelar
              </Botao>
            )}
          </>
        )}
      </div>

      {aba === "arquivados" && visiveis.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[var(--radius-card-sm)] border border-border bg-surface-1 px-3 py-2">
          <label className="flex min-h-9 cursor-pointer items-center gap-2.5 pr-2 text-[13px]">
            <Caixa
              checked={todosMarcados ? true : marcadosVisiveis.length > 0 ? "indeterminate" : false}
              onCheckedChange={() => marcarTodos(!todosMarcados)}
            />
            {termo || filtro !== "todos" ? "Selecionar todos da busca" : "Selecionar todos"}
          </label>
          <span className="tabular text-[12px] text-muted-fg">
            {marcadosVisiveis.length} de {visiveis.length}
          </span>
          {marcadosVisiveis.length > 0 && (
            <div className="ml-auto flex items-center gap-2">
              <Botao
                variante="secundaria"
                tamanho="sm"
                onClick={() => setConfirmacao({ operacao: "desarquivar", ids: marcadosVisiveis })}
              >
                <Icone nome="desarquivar" size={14} />
                Desarquivar ({marcadosVisiveis.length})
              </Botao>
              {podeApagarRastreio && (
                <Botao
                  variante="perigo"
                  tamanho="sm"
                  onClick={() => setConfirmacao({ operacao: "apagar", ids: marcadosVisiveis })}
                >
                  <Icone nome="excluir" size={14} />
                  Apagar ({marcadosVisiveis.length})
                </Botao>
              )}
            </div>
          )}
        </div>
      )}

      {visiveis.length === 0 ? (
        <EstadoVazio
          icone={termo ? "busca" : "rastreio"}
          titulo={
            !naoAchou
              ? "Nenhum objeto em circulação"
              : termo
                ? "Nenhum rastreio encontrado para essa busca."
                : "Nenhum pedido encontrado com esse filtro."
          }
          descricao={
            !naoAchou
              ? "Os objetos entram aqui sozinhos quando o Admin autoriza o envio — não há inclusão manual."
              : "Confira o termo, troque o filtro de status ou a aba para ver os outros objetos."
          }
        />
      ) : (
        <div className="flex gap-6">
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
                      aoMarcar={
                        aba === "arquivados"
                          ? (marcar) => alternarMarca(pedido.id, marcar)
                          : undefined
                      }
                      acoes={
                        aba === "arquivados" ? (
                          <>
                            <Botao
                              variante="secundaria"
                              tamanho="sm"
                              onClick={() => arquivarUm(pedido.id, true)}
                            >
                              <Icone nome="desarquivar" size={14} />
                              Desarquivar
                            </Botao>
                            {podeApagarRastreio && (
                              <Botao
                                variante="perigo"
                                tamanho="sm"
                                onClick={() => setConfirmacao({ operacao: "apagar", ids: [pedido.id] })}
                              >
                                <Icone nome="excluir" size={14} />
                                Apagar
                              </Botao>
                            )}
                          </>
                        ) : undefined
                      }
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>

          {/* Desktop: coluna presa à tela, com rolagem própria. Clicar num item
              no fim da lista mostra o painel sem rolar a página. */}
          {telaLarga && aberto && (
            <aside
              key={aberto.id}
              className="sticky top-24 max-h-[calc(100dvh-7rem)] w-[400px] shrink-0 self-start overflow-y-auto overscroll-contain rounded-[var(--radius-card)] border border-border bg-surface-1 p-5"
            >
              {painel}
            </aside>
          )}
        </div>
      )}

      {/* Celular e tablet: o mesmo painel numa gaveta, com botão de fechar. */}
      <Gaveta
        open={!telaLarga && aberto !== null}
        onOpenChange={(aberta) => !aberta && setAbertoId(null)}
      >
        <GavetaConteudo larguraMaxima="sm:max-w-md">
          <GavetaTitulo className="sr-only">
            Rastreio {aberto?.rastreio.codigo}
          </GavetaTitulo>
          <GavetaDescricao className="sr-only">
            Detalhe do objeto e histórico de eventos
          </GavetaDescricao>
          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5"
            style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
          >
            {painel}
          </div>
        </GavetaConteudo>
      </Gaveta>

      <ModalConfirmacao
        aberto={confirmacao !== null}
        titulo={textos?.titulo ?? ""}
        mensagem={textos?.mensagem ?? ""}
        itens={todos
          .filter((p) => confirmacao?.ids.includes(p.id))
          .map((p) => `${p.rastreio.codigo}  —  ${p.cliente.nome || "sem nome"}`)}
        rotuloConfirmar={textos?.rotulo}
        icone={
          confirmacao?.operacao === "apagar"
            ? "excluir"
            : confirmacao?.operacao === "desarquivar"
              ? "desarquivar"
              : "arquivar"
        }
        perigo={confirmacao?.operacao === "apagar"}
        aoConfirmar={confirmar}
        aoCancelar={() => setConfirmacao(null)}
      />
    </div>
  );
}
