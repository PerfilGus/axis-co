"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Pendencia } from "@/lib/servidor/sessao";
import { aceitarTermo } from "@/app/acoes/acesso";
import { Botao } from "@/components/ui/button";
import { Card, CardConteudo } from "@/components/ui/card";
import { Caixa } from "@/components/ui/checkbox";
import { IndicadorEtapas } from "@/components/shared/etapas";
import { AvisoRascunho, TermoConfidencialidade } from "@/components/lgpd/textos";
import { BotaoSair } from "@/components/layout/botao-sair";
import { TrocaSenha } from "./troca-senha";
import { ConfigurarDoisFatores } from "./configurar-dois-fatores";

const TITULO: Record<Pendencia, { titulo: string; descricao: string }> = {
  trocar_senha: {
    titulo: "Crie a sua senha",
    descricao: "A senha que você recebeu é provisória. Troque por uma que só você sabe.",
  },
  aceitar_termo: {
    titulo: "Termo de confidencialidade",
    descricao: "Você vai ver dados de clientes. Leia e aceite antes de continuar.",
  },
  configurar_2fa: {
    titulo: "Verificação em duas etapas",
    descricao: "Obrigatória para administradores: além da senha, um código do seu celular.",
  },
};

/** Passo a passo do primeiro acesso. O servidor decide qual passo falta. */
export function PrimeiroAcesso({
  pendencia,
  email,
  ehAdmin,
}: {
  pendencia: Pendencia;
  email: string;
  ehAdmin: boolean;
}) {
  const router = useRouter();
  const [aceito, setAceito] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const passos: Pendencia[] = ehAdmin
    ? ["trocar_senha", "aceitar_termo", "configurar_2fa"]
    : ["trocar_senha", "aceitar_termo"];
  // Recarrega do servidor: ele relê a pendência e manda para o próximo passo.
  const seguir = () => {
    router.refresh();
    if (pendencia === passos[passos.length - 1]) window.location.replace("/");
  };

  async function aceitar() {
    setEnviando(true);
    const resultado = await aceitarTermo();
    setEnviando(false);
    if (!resultado.ok) return setErro(resultado.erro);
    seguir();
  }

  return (
    <div className="flex flex-col gap-6">
      <IndicadorEtapas
        etapas={passos.map((p) => ({ chave: p, rotulo: TITULO[p].titulo }))}
        atual={passos.indexOf(pendencia)}
      />
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-medium tracking-tight">{TITULO[pendencia].titulo}</h1>
        <p className="text-sm text-muted-fg">{TITULO[pendencia].descricao}</p>
      </div>

      <Card>
        <CardConteudo className="flex flex-col gap-5">
          {pendencia === "trocar_senha" && (
            <TrocaSenha email={email} rotuloBotao="Salvar e continuar" aoConcluir={seguir} />
          )}

          {pendencia === "aceitar_termo" && (
            <>
              <AvisoRascunho />
              <div className="max-h-[50dvh] overflow-y-auto rounded-[var(--radius-card-sm)] border border-border p-4">
                <TermoConfidencialidade />
              </div>
              <label className="flex cursor-pointer items-start gap-3">
                <Caixa checked={aceito} onCheckedChange={(v) => setAceito(v === true)} className="mt-0.5" />
                <span className="text-[13px]">
                  Li e concordo com o termo de confidencialidade e com a{" "}
                  <Link href="/privacidade" target="_blank" className="underline underline-offset-2">
                    política de privacidade
                  </Link>
                  .
                </span>
              </label>
              {erro && <p className="text-[13px] text-[var(--st-vermelho-fg)]">{erro}</p>}
              <Botao variante="principal" tamanho="lg" disabled={!aceito || enviando} onClick={aceitar}>
                {enviando ? "Registrando…" : "Aceitar e continuar"}
              </Botao>
            </>
          )}

          {pendencia === "configurar_2fa" && <ConfigurarDoisFatores aoConcluir={seguir} />}
        </CardConteudo>
      </Card>

      <div className="flex justify-center">
        <BotaoSair />
      </div>
    </div>
  );
}
