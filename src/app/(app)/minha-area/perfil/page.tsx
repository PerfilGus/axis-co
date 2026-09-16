"use client";

import { ROTULO_SETOR } from "@/lib/types";
import { formatBps, formatBRL, formatData, formatTelefone } from "@/lib/format";
import { progressoNivel, useEquipe } from "@/lib/providers/equipe";
import { useSessao } from "@/lib/providers/sessao";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { Card, CardConteudo, CardDescricao, CardTitulo } from "@/components/ui/card";
import { AvatarAnel } from "@/components/shared/avatar-anel";
import { SeletorDestaque, SeletorTema } from "@/components/shared/seletores-aparencia";

function Linhas({ itens }: { itens: Array<[string, string]> }) {
  return (
    <dl className="flex flex-col">
      {itens.map(([rotulo, valor], i) => (
        <div
          key={rotulo}
          className={`flex items-baseline justify-between gap-4 py-2.5 ${i > 0 ? "border-t border-border" : ""}`}
        >
          <dt className="text-[13px] text-muted-fg">{rotulo}</dt>
          <dd className="tabular min-w-0 truncate text-right text-sm">{valor}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function PaginaPerfil() {
  const { usuario } = useSessao();
  const { niveis } = useEquipe();
  const { atual, progresso } = progressoNivel(niveis, usuario);
  const ehVendedor = usuario.setor === "vendas";

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 lg:max-w-5xl">
      <CabecalhoPagina
        titulo="Perfil"
        descricao="Seus dados, o que foi combinado com você e a aparência do sistema."
        voltar="/minha-area"
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardConteudo className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <AvatarAnel
                  nome={usuario.nome}
                  imagemUrl={usuario.avatarUrl}
                  progresso={progresso}
                  tamanho={64}
                />
                <div className="flex min-w-0 flex-col">
                  <CardTitulo className="truncate text-lg">{usuario.nome}</CardTitulo>
                  <CardDescricao>
                    {ROTULO_SETOR[usuario.setor]} · {atual?.nome ?? "sem nível"}
                  </CardDescricao>
                </div>
              </div>
              <Linhas
                itens={[
                  ["E-mail", usuario.email],
                  ["Telefone", formatTelefone(usuario.telefone)],
                  ["Na casa desde", formatData(usuario.entrouEm)],
                  ["Chave Pix", usuario.chavePix ?? "Não cadastrada"],
                ]}
              />
            </CardConteudo>
          </Card>

          <Card>
            <CardConteudo className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <CardTitulo>Remuneração combinada</CardTitulo>
                <CardDescricao>
                  {ehVendedor
                    ? "A comissão incide sobre o enviado, já descontado o frustrado combinado."
                    : "A comissão incide sobre o que de fato entrou."}
                </CardDescricao>
              </div>
              <Linhas
                itens={[
                  ["Salário fixo", formatBRL(usuario.salarioFixo)],
                  ["Comissão", formatBps(usuario.comissaoBps)],
                  ...(ehVendedor
                    ? ([["Frustrado combinado", formatBps(usuario.frustradoBps ?? 0)]] as Array<
                        [string, string]
                      >)
                    : []),
                  ["Dia do pagamento", `Dia ${usuario.diaPagamento} do mês seguinte`],
                ]}
              />
              <p className="text-xs text-muted-fg">
                Algo errado aqui? Fale com o Admin: só ele altera dados e remuneração.
              </p>
            </CardConteudo>
          </Card>
        </div>

        <Card id="aparencia">
          <CardConteudo className="flex flex-col gap-5">
            <div className="flex flex-col gap-1">
              <CardTitulo>Aparência</CardTitulo>
              <CardDescricao>Vale só para você, neste navegador.</CardDescricao>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-medium">Tema</span>
              <SeletorTema />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-medium">Cor de destaque</span>
              <SeletorDestaque />
              <p className="text-[11px] text-muted-fg">
                Amarelo é o padrão da identidade. As cores de status nunca mudam.
              </p>
            </div>
          </CardConteudo>
        </Card>
      </div>
    </div>
  );
}
