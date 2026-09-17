"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/format";
import { comprimirImagem } from "@/lib/imagem";
import { Icone } from "@/components/icone";
import { Botao } from "@/components/ui/button";

export interface ArquivoSelecionado {
  nome: string;
  tamanho: number;
  tipo: string;
  /** Pronto para enviar: imagens já chegam comprimidas (WebP, até 1600px). */
  arquivo: File;
}

/**
 * Seleção de arquivo. Valida o tamanho, comprime imagens no próprio aparelho e
 * devolve a seleção para a tela, que envia junto com a ação.
 */
export function EnvioArquivo({
  aoSelecionar,
  aceita = "image/*,application/pdf",
  tamanhoMaximoMb = 15,
  multiplo = false,
  rotulo = "Arraste um arquivo ou clique para escolher",
  className,
}: {
  aoSelecionar?: (arquivos: ArquivoSelecionado[]) => void;
  aceita?: string;
  tamanhoMaximoMb?: number;
  multiplo?: boolean;
  rotulo?: string;
  className?: string;
}) {
  const entradaRef = useRef<HTMLInputElement>(null);
  const [sobre, setSobre] = useState(false);
  const [arquivos, setArquivos] = useState<ArquivoSelecionado[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  const [preparando, setPreparando] = useState(false);

  async function receber(lista: FileList | null) {
    if (!lista || lista.length === 0) return;
    const limite = tamanhoMaximoMb * 1024 * 1024;
    const aceitos: ArquivoSelecionado[] = [];

    setPreparando(true);
    for (const original of Array.from(lista)) {
      const arquivo = await comprimirImagem(original);
      if (arquivo.size > limite) {
        setErro(`"${original.name}" passa de ${tamanhoMaximoMb} MB.`);
        continue;
      }
      aceitos.push({ nome: arquivo.name, tamanho: arquivo.size, tipo: arquivo.type, arquivo });
    }
    setPreparando(false);

    if (aceitos.length === 0) return;
    setErro(null);
    const novos = multiplo ? [...arquivos, ...aceitos] : aceitos.slice(0, 1);
    setArquivos(novos);
    aoSelecionar?.(novos);
  }

  function remover(nome: string) {
    const novos = arquivos.filter((a) => a.nome !== nome);
    setArquivos(novos);
    aoSelecionar?.(novos);
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setSobre(true);
        }}
        onDragLeave={() => setSobre(false)}
        onDrop={(e) => {
          e.preventDefault();
          setSobre(false);
          void receber(e.dataTransfer.files);
        }}
        onClick={() => entradaRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") entradaRef.current?.click();
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--radius-card-sm)] border border-dashed px-6 py-8 text-center transition-colors",
          sobre
            ? "border-[var(--accent)] bg-[var(--accent-soft)]"
            : "border-border bg-surface-input hover:border-border-strong",
        )}
      >
        <span className="flex size-10 items-center justify-center rounded-full bg-surface-3 text-muted-fg">
          <Icone nome="upload" size={18} />
        </span>
        <p className="text-[13px] text-fg">{preparando ? "Preparando arquivo…" : rotulo}</p>
        <p className="text-xs text-muted-fg">Até {tamanhoMaximoMb} MB por arquivo.</p>
        <input
          ref={entradaRef}
          type="file"
          accept={aceita}
          multiple={multiplo}
          className="hidden"
          onChange={(e) => {
            void receber(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {erro && <p className="text-xs text-[var(--st-vermelho-fg)]">{erro}</p>}

      {arquivos.length > 0 && (
        <ul className="flex flex-col gap-2">
          {arquivos.map((arquivo) => (
            <li
              key={arquivo.nome}
              className="flex items-center gap-3 rounded-full border border-border bg-surface-2 py-2 pr-2 pl-3.5"
            >
              <Icone nome="anexo" size={15} className="shrink-0 text-muted-fg" />
              <span className="min-w-0 flex-1 truncate text-[13px]">{arquivo.nome}</span>
              <span className="tabular shrink-0 text-xs text-muted-fg">
                {formatBytes(arquivo.tamanho)}
              </span>
              <Botao
                variante="fantasma"
                tamanho="iconeSm"
                aria-label={`Remover ${arquivo.nome}`}
                onClick={() => remover(arquivo.nome)}
              >
                <Icone nome="fechar" size={14} />
              </Botao>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
