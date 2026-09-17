"use client";

import { useState } from "react";
import Link from "next/link";
import { useSessao } from "@/lib/providers/sessao";
import { useEquipe } from "@/lib/providers/equipe";
import { authCliente, mensagemDeErro } from "@/lib/auth-cliente";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { Card, CardConteudo, CardDescricao, CardTitulo } from "@/components/ui/card";
import { Botao } from "@/components/ui/button";
import { Campo } from "@/components/ui/label";
import { Icone } from "@/components/icone";
import { toast } from "@/components/ui/toast";
import { ModalConfirmacao } from "@/components/shared/modal-confirmacao";
import { TrocaSenha } from "@/components/acesso/troca-senha";
import { CampoSenha } from "@/components/acesso/campo-senha";
import { ConfigurarDoisFatores } from "@/components/acesso/configurar-dois-fatores";

/** Segurança da própria conta: senha, verificação em duas etapas e sessões. */
export default function PaginaSeguranca() {
  const { usuario, email, doisFatores, ehAdmin } = useSessao();
  const { encerrarSessoes } = useEquipe();
  const [ativando, setAtivando] = useState(false);
  const [desativando, setDesativando] = useState(false);
  const [senha, setSenha] = useState("");
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);

  async function desativar() {
    const { error } = await authCliente.twoFactor.disable({ password: senha });
    if (error) {
      toast.error(mensagemDeErro(error));
      return;
    }
    window.location.reload();
  }

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Segurança da conta"
        descricao="Sua senha, o código do celular e os aparelhos conectados."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardConteudo className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <CardTitulo>Trocar senha</CardTitulo>
              <CardDescricao>Os outros aparelhos saem da conta ao trocar.</CardDescricao>
            </div>
            <TrocaSenha
              email={email}
              aoConcluir={() => toast.success("Senha trocada", { description: "Os outros aparelhos foram desconectados." })}
            />
          </CardConteudo>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardConteudo className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <CardTitulo>Verificação em duas etapas</CardTitulo>
                <CardDescricao>
                  {doisFatores
                    ? "Ativa: além da senha, o login pede o código do aplicativo."
                    : "Desativada. Recomendado para qualquer perfil."}
                  {ehAdmin && " Obrigatória para administradores."}
                </CardDescricao>
              </div>

              {!doisFatores && !ativando && (
                <Botao variante="principal" onClick={() => setAtivando(true)}>
                  <Icone nome="escudo" size={16} />
                  Ativar
                </Botao>
              )}
              {!doisFatores && ativando && <ConfigurarDoisFatores aoConcluir={() => window.location.reload()} />}

              {doisFatores && !ehAdmin && !desativando && (
                <Botao variante="secundaria" onClick={() => setDesativando(true)}>
                  Desativar
                </Botao>
              )}
              {doisFatores && desativando && (
                <div className="flex flex-col gap-3">
                  <Campo rotulo="Confirme a sua senha">
                    <CampoSenha valor={senha} aoMudar={setSenha} autoComplete="current-password" autoFocus />
                  </Campo>
                  <Botao variante="perigo" onClick={desativar} disabled={!senha}>
                    Desativar verificação
                  </Botao>
                </div>
              )}
            </CardConteudo>
          </Card>

          <Card>
            <CardConteudo className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <CardTitulo>Aparelhos conectados</CardTitulo>
                <CardDescricao>
                  A sessão não expira sozinha. Perdeu o celular ou usou um computador de outra pessoa? Saia de
                  todos.
                </CardDescricao>
              </div>
              <Botao variante="secundaria" onClick={() => setConfirmandoSaida(true)}>
                <Icone nome="sair" size={16} />
                Sair de todos os aparelhos
              </Botao>
            </CardConteudo>
          </Card>

          <p className="text-[13px] text-muted-fg">
            Como tratamos os dados:{" "}
            <Link href="/privacidade" className="underline underline-offset-2 hover:text-fg">
              política de privacidade
            </Link>
            .
          </p>
        </div>
      </div>

      <ModalConfirmacao
        aberto={confirmandoSaida}
        titulo="Sair de todos os aparelhos?"
        mensagem="Inclusive deste. Você vai precisar entrar de novo."
        icone="sair"
        rotuloConfirmar="Sair de todos"
        aoCancelar={() => setConfirmandoSaida(false)}
        aoConfirmar={async () => {
          const total = await encerrarSessoes(usuario.id);
          if (total !== null) window.location.replace("/entrar");
        }}
      />
    </div>
  );
}
