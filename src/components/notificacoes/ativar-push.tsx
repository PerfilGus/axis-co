"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { chamar } from "@/lib/providers/acao";
import { cancelarPush, inscreverPush, testarPush } from "@/app/acoes/push";
import { Icone } from "@/components/icone";
import { Botao } from "@/components/ui/button";
import { Card, CardConteudo, CardDescricao, CardTitulo } from "@/components/ui/card";
import { SeloTom } from "@/components/shared/selo-status";
import { toast } from "@/components/ui/toast";

/**
 * Web Push neste aparelho. No iPhone só existe com o app aberto pela tela de
 * início (iOS 16.4+), e a permissão só pode ser pedida num toque — por isso
 * nada aqui pede sozinho: tudo parte do botão.
 */

const CHAVE_PUBLICA = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

type Ambiente = "servidor" | "sem_chave" | "instalar" | "sem_suporte" | "negado" | "pronto";

function lerAmbiente(): Ambiente {
  if (!CHAVE_PUBLICA) return "sem_chave";
  const ios =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const instalado =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (ios && !instalado) return "instalar";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return "sem_suporte";
  }
  return Notification.permission === "denied" ? "negado" : "pronto";
}

const nadaAssinar = () => () => {};

/** A chave VAPID vem em base64url; o navegador quer os bytes. */
function chaveEmBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const bruto = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(bruto.length));
  for (let i = 0; i < bruto.length; i++) bytes[i] = bruto.charCodeAt(i);
  return bytes;
}

async function registro() {
  await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  return navigator.serviceWorker.ready;
}

/** Registra o service worker ao abrir o sistema, para o push achar o app. */
export function RegistrarServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Sem service worker o sistema funciona igual; só não recebe push.
    });
  }, []);
  return null;
}

export function AtivarPush() {
  const ambiente = useSyncExternalStore<Ambiente>(nadaAssinar, lerAmbiente, () => "servidor");
  // `null` enquanto confere se este aparelho já está inscrito.
  const [inscricao, setInscricao] = useState<PushSubscription | null | undefined>(undefined);
  const [negadoAgora, setNegadoAgora] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (ambiente !== "pronto") return;
    let valido = true;
    void registro()
      .then((r) => r.pushManager.getSubscription())
      .then((atual) => valido && setInscricao(atual))
      .catch(() => valido && setInscricao(null));
    return () => {
      valido = false;
    };
  }, [ambiente]);

  async function ativar() {
    setOcupado(true);
    try {
      // Primeiro a permissão, ainda dentro do toque: o iOS recusa se vier depois.
      const permissao = await Notification.requestPermission();
      if (permissao !== "granted") {
        setNegadoAgora(permissao === "denied");
        return;
      }
      const r = await registro();
      const nova = await r.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: chaveEmBytes(CHAVE_PUBLICA),
      });
      const json = nova.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new Error("inscrição incompleta");
      const ok = await chamar(
        inscreverPush({ endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } }),
      );
      if (!ok) {
        await nova.unsubscribe();
        return;
      }
      setInscricao(nova);
      toast.success("Notificações ativadas neste aparelho");
    } catch {
      toast.error("Não foi possível ativar. Confira a permissão de notificações e tente de novo.");
    } finally {
      setOcupado(false);
    }
  }

  async function desativar() {
    if (!inscricao) return;
    setOcupado(true);
    const endpoint = inscricao.endpoint;
    await inscricao.unsubscribe().catch(() => {});
    await chamar(cancelarPush(endpoint));
    setInscricao(null);
    setOcupado(false);
    toast.success("Notificações desativadas neste aparelho");
  }

  async function testar() {
    setOcupado(true);
    const entregues = await chamar(testarPush());
    setOcupado(false);
    if (entregues) toast.success("Aviso de teste enviado", { description: "Deve chegar em alguns segundos." });
  }

  const negado = ambiente === "negado" || negadoAgora;

  return (
    <Card>
      <CardConteudo className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
            <Icone nome="notificacoes" size={18} />
          </span>
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitulo>Notificações no celular</CardTitulo>
              {ambiente === "pronto" && inscricao && !negado && <SeloTom tom="verde">Ativo neste aparelho</SeloTom>}
            </div>
            <CardDescricao>
              {ambiente === "servidor" && "Conferindo este aparelho…"}
              {ambiente === "sem_chave" && "O servidor ainda não tem as chaves de notificação (VAPID). O Admin precisa cadastrá-las."}
              {ambiente === "instalar" &&
                "No iPhone, o aviso só chega com o Axis na tela de início: no Safari, toque em Compartilhar, depois em Adicionar à Tela de Início, abra o Axis pelo ícone e volte aqui."}
              {ambiente === "sem_suporte" && "Este navegador não recebe notificações."}
              {ambiente === "pronto" && negado &&
                "As notificações estão bloqueadas. No iPhone: Ajustes › Notificações › Axis. No computador: no cadeado ao lado do endereço."}
              {ambiente === "pronto" && !negado && inscricao === undefined && "Conferindo este aparelho…"}
              {ambiente === "pronto" && !negado && inscricao === null &&
                "Ative para receber os avisos marcados em Celular abaixo, mesmo com o app fechado."}
              {ambiente === "pronto" && !negado && inscricao &&
                "Os avisos marcados em Celular chegam aqui. Cada aparelho é ativado separadamente."}
            </CardDescricao>
          </div>
        </div>

        {ambiente === "pronto" && !negado && inscricao === null && (
          <Botao variante="principal" onClick={() => void ativar()} disabled={ocupado} className="shrink-0">
            <Icone nome="notificacoes" />
            Ativar notificações
          </Botao>
        )}
        {ambiente === "pronto" && !negado && inscricao && (
          <div className="flex shrink-0 flex-wrap gap-2">
            <Botao variante="secundaria" onClick={() => void testar()} disabled={ocupado}>
              Enviar teste
            </Botao>
            <Botao variante="fantasma" onClick={() => void desativar()} disabled={ocupado}>
              Desativar neste aparelho
            </Botao>
          </div>
        )}
      </CardConteudo>
    </Card>
  );
}
