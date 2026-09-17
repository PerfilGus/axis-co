import { ImageResponse } from "next/og";

/**
 * Ícones do app instalado (tela de início e notificações): o "A" amarelo do
 * logo sobre o fundo escuro. O círculo ocupa o centro, dentro da área segura
 * dos ícones adaptáveis, então o mesmo desenho serve de `maskable`.
 */
const TAMANHOS = new Set([180, 192, 512]);

export async function GET(_req: Request, { params }: { params: Promise<{ tamanho: string }> }) {
  const tamanho = Number((await params).tamanho);
  if (!TAMANHOS.has(tamanho)) return new Response("Não encontrado", { status: 404 });
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#121212" }}>
        <div
          style={{
            width: tamanho * 0.62,
            height: tamanho * 0.62,
            borderRadius: "50%",
            background: "#FFBE00",
            color: "#121212",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: tamanho * 0.34,
            fontWeight: 700,
          }}
        >
          A
        </div>
      </div>
    ),
    { width: tamanho, height: tamanho, headers: { "Cache-Control": "public, max-age=604800" } },
  );
}
