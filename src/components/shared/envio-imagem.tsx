"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { iniciais } from "@/lib/format";
import { Icone } from "@/components/icone";
import { Botao } from "@/components/ui/button";
import { comprimirImagem } from "@/lib/imagem";
import { chamar } from "@/lib/providers/acao";
import { enviarImagem } from "@/app/acoes/cadastros";

/**
 * Miniatura de cadastro: a imagem enviada ou, sem ela, as iniciais sobre a
 * cor do registro. Serve para foto de produto, ícone de banco e avatar.
 */
export function Miniatura({
  nome,
  url,
  cor,
  tamanho = 40,
  className,
}: {
  nome: string;
  url: string | null;
  cor?: string;
  tamanho?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-medium",
        !cor && "bg-surface-3 text-muted-fg",
        className,
      )}
      style={{
        width: tamanho,
        height: tamanho,
        fontSize: Math.round(tamanho * 0.34),
        ...(cor ? { backgroundColor: `${cor}26`, color: cor } : {}),
      }}
    >
      {url ? (
        // Arquivo privado servido por /api/anexos: não passa pelo otimizador do Next.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="size-full object-cover" />
      ) : (
        iniciais(nome || "?")
      )}
    </span>
  );
}

/**
 * Upload de imagem de cadastro. Comprime no aparelho, envia para o
 * armazenamento privado e devolve o endereço interno (`/api/anexos/...`),
 * que só abre para quem está logado.
 */
export function EnvioImagem({
  nome,
  url,
  cor,
  aoMudar,
  rotulo = "Enviar imagem",
  tamanhoMaximoMb = 8,
}: {
  nome: string;
  url: string | null;
  cor?: string;
  aoMudar: (url: string | null) => void;
  rotulo?: string;
  tamanhoMaximoMb?: number;
}) {
  const entradaRef = useRef<HTMLInputElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function receber(original: File | undefined) {
    if (!original) return;
    if (!original.type.startsWith("image/")) {
      setErro("Escolha um arquivo de imagem.");
      return;
    }
    setErro(null);
    setEnviando(true);
    const arquivo = await comprimirImagem(original);
    if (arquivo.size > tamanhoMaximoMb * 1024 * 1024) {
      setEnviando(false);
      setErro(`A imagem passa de ${tamanhoMaximoMb} MB.`);
      return;
    }
    const formulario = new FormData();
    formulario.set("arquivo", arquivo);
    const url = await chamar(enviarImagem(formulario));
    setEnviando(false);
    if (url) aoMudar(url);
  }

  return (
    <div className="flex items-center gap-4">
      <Miniatura nome={nome} url={url} cor={cor} tamanho={64} />
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap gap-2">
          <Botao
            type="button"
            variante="secundaria"
            tamanho="sm"
            onClick={() => entradaRef.current?.click()}
            disabled={enviando}
          >
            <Icone nome="upload" size={14} />
            {enviando ? "Enviando…" : url ? "Trocar imagem" : rotulo}
          </Botao>
          {url && (
            <Botao type="button" variante="fantasma" tamanho="sm" onClick={() => aoMudar(null)}>
              Remover
            </Botao>
          )}
        </div>
        <p className={cn("text-xs", erro ? "text-[var(--st-vermelho-fg)]" : "text-muted-fg")}>
          {erro ?? "Foto ou imagem do aparelho. Sem imagem, usamos as iniciais."}
        </p>
        <input
          ref={entradaRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void receber(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
