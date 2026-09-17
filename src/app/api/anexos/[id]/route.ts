import { eq } from "drizzle-orm";
import { podeVerAnexo, podeVerFinanceiro } from "@/lib/permissoes";
import { db } from "@/lib/servidor/db";
import { anexos } from "@/lib/servidor/schema";
import { lerArquivo } from "@/lib/servidor/arquivos";
import { registrarAtividades } from "@/lib/servidor/atividades";
import { contextoDaSessao } from "@/lib/servidor/sessao";

/**
 * Leitura de arquivo privado.
 *
 * O endereço do Blob nunca sai do servidor: o arquivo passa por aqui, que
 * confere sessão e permissão a cada pedido e responde sem cache compartilhado.
 * Abrir um anexo de pedido grava a visualização nas atividades.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await contextoDaSessao();
  if (!ctx || ctx.pendencia) return new Response("Não autorizado", { status: 401 });

  const { id } = await params;
  const [anexo] = await db.select().from(anexos).where(eq(anexos.id, id)).limit(1);
  if (!anexo) return new Response("Não encontrado", { status: 404 });

  const permitido =
    anexo.entidade === "imagem_cadastro" ||
    (anexo.entidade === "pedido" && podeVerAnexo(ctx.colaborador)) ||
    (anexo.entidade === "pagamento_fornecedor" && podeVerFinanceiro(ctx.colaborador));
  if (!permitido) return new Response("Sem permissão", { status: 403 });
  // Apagado pela retenção: o registro existe, o conteúdo não.
  if (anexo.removidoEm) return new Response("Arquivo removido", { status: 410 });

  const arquivo = await lerArquivo(anexo.caminhoBlob);
  if (!arquivo || !arquivo.stream) return new Response("Não encontrado", { status: 404 });

  if (anexo.entidade === "pedido") {
    await registrarAtividades([
      {
        usuarioId: ctx.colaborador.id,
        papel: ctx.colaborador.perfil,
        acao: "visualizacao_anexo",
        entidade: "anexo",
        entidadeId: anexo.id,
        titulo: `Abriu o anexo ${anexo.nome}`,
        dados: { pedidoId: anexo.entidadeId },
      },
    ]);
  }

  const nome = encodeURIComponent(anexo.nome);
  return new Response(arquivo.stream, {
    headers: {
      "Content-Type": anexo.mime,
      "Content-Disposition": `inline; filename*=UTF-8''${nome}`,
      // Imagens de cadastro podem ficar no cache do próprio navegador; o resto não.
      "Cache-Control": anexo.entidade === "imagem_cadastro" ? "private, max-age=3600" : "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
