"use client";

/**
 * Compressão de imagem no navegador, antes do upload.
 *
 * Reduz para no máximo 1600px de largura e grava em WebP. O Safari antigo não
 * gera WebP pelo canvas e devolve PNG — nesse caso cai para JPEG, que todo
 * navegador gera. Áudio e PDF passam direto.
 */

const LARGURA_MAXIMA = 1600;
const QUALIDADE = 0.8;

function paraBlob(canvas: HTMLCanvasElement, tipo: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, tipo, QUALIDADE));
}

function trocarExtensao(nome: string, extensao: string): string {
  const base = nome.replace(/\.[^.]+$/, "") || "imagem";
  return `${base}.${extensao}`;
}

export async function comprimirImagem(arquivo: File): Promise<File> {
  if (!arquivo.type.startsWith("image/") || arquivo.type === "image/gif") return arquivo;

  let bitmap: ImageBitmap;
  try {
    // `from-image` respeita a orientação EXIF das fotos do iPhone.
    bitmap = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
  } catch {
    // HEIC em navegador que não decodifica: segue original e o servidor decide.
    return arquivo;
  }

  const escala = Math.min(1, LARGURA_MAXIMA / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  const ctx = canvas.getContext("2d");
  if (!ctx) return arquivo;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  let blob = await paraBlob(canvas, "image/webp");
  let tipo = "image/webp";
  let extensao = "webp";
  if (!blob || blob.type !== "image/webp") {
    blob = await paraBlob(canvas, "image/jpeg");
    tipo = "image/jpeg";
    extensao = "jpg";
  }
  if (!blob) return arquivo;

  // Se a "compressão" ficou maior (imagem já pequena), manda a original.
  if (blob.size >= arquivo.size && escala === 1 && arquivo.type !== "image/heic") return arquivo;
  return new File([blob], trocarExtensao(arquivo.name, extensao), { type: tipo, lastModified: Date.now() });
}
