import "server-only";
import { del, get, put } from "@vercel/blob";
import { ErroDeAcao } from "./sessao";

/**
 * Arquivos no Vercel Blob privado.
 *
 * O caminho é interno: a tela só conhece `/api/anexos/[id]`, que confere a
 * sessão antes de ler. Imagens chegam comprimidas do navegador (WebP até
 * 1600px); aqui só se confere tipo e tamanho.
 */

const TAMANHO_MAXIMO = 15 * 1024 * 1024;

const TIPOS_ACEITOS = [
  /^image\/(webp|jpeg|png|heic|heif)$/,
  /^audio\/(ogg|mpeg|mp4|aac|webm|wav|x-m4a|opus)$/,
  /^application\/pdf$/,
];

const EXTENSAO: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
};

export interface ArquivoSalvo {
  id: string;
  caminho: string;
  mime: string;
  tamanho: number;
}

export async function salvarArquivo(arquivo: File, pasta: string): Promise<ArquivoSalvo> {
  const mime = arquivo.type || "application/octet-stream";
  if (!TIPOS_ACEITOS.some((re) => re.test(mime))) {
    throw new ErroDeAcao("Tipo de arquivo não aceito. Envie imagem, áudio ou PDF.");
  }
  if (arquivo.size === 0) throw new ErroDeAcao("O arquivo está vazio.");
  if (arquivo.size > TAMANHO_MAXIMO) throw new ErroDeAcao("Arquivo acima de 15 MB.");

  const id = crypto.randomUUID();
  const extensao = EXTENSAO[mime] ?? mime.split("/")[1]?.replace(/[^a-z0-9]/g, "") ?? "bin";
  const caminho = `${pasta}/${id}.${extensao}`;
  await put(caminho, arquivo, { access: "private", contentType: mime, addRandomSuffix: false });
  return { id, caminho, mime, tamanho: arquivo.size };
}

export async function lerArquivo(caminho: string) {
  return get(caminho, { access: "private" });
}

export async function apagarArquivos(caminhos: string[]): Promise<void> {
  if (caminhos.length === 0) return;
  try {
    await del(caminhos);
  } catch (erro) {
    console.error("[arquivos] falha ao apagar", erro);
  }
}
