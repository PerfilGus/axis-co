"use client";

import { useState } from "react";
import Link from "next/link";
import { authCliente, mensagemDeErro } from "@/lib/auth-cliente";
import { Icone } from "@/components/icone";
import { Botao } from "@/components/ui/button";
import { Campo } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardConteudo } from "@/components/ui/card";
import { CampoSenha } from "./campo-senha";

/**
 * Login. Sem cadastro público e sem recuperação por e-mail: quem perdeu o
 * acesso fala com o Admin, que redefine. Com 2FA ativo, pede o código em
 * seguida — do aplicativo ou um código de recuperação.
 */
export function FormularioEntrar() {
  const [etapa, setEtapa] = useState<"senha" | "codigo">("senha");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [codigo, setCodigo] = useState("");
  const [recuperacao, setRecuperacao] = useState(false);
  const [confiarAparelho, setConfiarAparelho] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!email.trim() || !senha) {
      setErro("Informe e-mail e senha.");
      return;
    }
    setEnviando(true);
    const { data, error } = await authCliente.signIn.email({
      email: email.trim().toLowerCase(),
      password: senha,
    });
    setEnviando(false);
    if (error) {
      setErro(mensagemDeErro(error));
      return;
    }
    if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) {
      setSenha("");
      setEtapa("codigo");
      return;
    }
    window.location.replace("/");
  }

  async function confirmarCodigo(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const limpo = codigo.replace(/\s/g, "");
    if (!limpo) {
      setErro("Digite o código.");
      return;
    }
    setEnviando(true);
    const { error } = recuperacao
      ? await authCliente.twoFactor.verifyBackupCode({ code: limpo, trustDevice: confiarAparelho })
      : await authCliente.twoFactor.verifyTotp({ code: limpo, trustDevice: confiarAparelho });
    setEnviando(false);
    if (error) {
      setErro(mensagemDeErro(error));
      return;
    }
    window.location.replace("/");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-medium tracking-tight">
          {etapa === "senha" ? "Entrar" : "Verificação em duas etapas"}
        </h1>
        <p className="text-sm text-muted-fg">
          {etapa === "senha"
            ? "Use o e-mail e a senha que o administrador cadastrou."
            : recuperacao
              ? "Digite um dos códigos de recuperação que você guardou."
              : "Digite o código de 6 dígitos do seu aplicativo autenticador."}
        </p>
      </div>

      <Card>
        <CardConteudo>
          {etapa === "senha" ? (
            <form onSubmit={entrar} className="flex flex-col gap-4" noValidate>
              <Campo rotulo="E-mail">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  autoCapitalize="none"
                  inputMode="email"
                  autoFocus
                />
              </Campo>
              <Campo rotulo="Senha">
                <CampoSenha valor={senha} aoMudar={setSenha} autoComplete="current-password" />
              </Campo>
              {erro && (
                <p className="text-[13px] text-[var(--st-vermelho-fg)]" role="alert">
                  {erro}
                </p>
              )}
              <Botao type="submit" variante="principal" tamanho="lg" disabled={enviando}>
                <Icone nome="cadeado" size={18} />
                {enviando ? "Entrando…" : "Entrar"}
              </Botao>
            </form>
          ) : (
            <form onSubmit={confirmarCodigo} className="flex flex-col gap-4" noValidate>
              <Campo rotulo={recuperacao ? "Código de recuperação" : "Código"}>
                <Input
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  inputMode={recuperacao ? "text" : "numeric"}
                  autoComplete="one-time-code"
                  autoCapitalize="none"
                  maxLength={recuperacao ? 24 : 6}
                  className="tabular text-lg tracking-[0.3em]"
                  autoFocus
                />
              </Campo>
              <label className="flex items-center gap-2 text-[13px] text-muted-fg">
                <input
                  type="checkbox"
                  checked={confiarAparelho}
                  onChange={(e) => setConfiarAparelho(e.target.checked)}
                  className="size-4 accent-[var(--accent)]"
                />
                Não pedir o código neste aparelho por 30 dias
              </label>
              {erro && (
                <p className="text-[13px] text-[var(--st-vermelho-fg)]" role="alert">
                  {erro}
                </p>
              )}
              <Botao type="submit" variante="principal" tamanho="lg" disabled={enviando}>
                <Icone nome="escudo" size={18} />
                {enviando ? "Conferindo…" : "Confirmar"}
              </Botao>
              <Botao
                type="button"
                variante="fantasma"
                onClick={() => {
                  setRecuperacao((v) => !v);
                  setCodigo("");
                  setErro(null);
                }}
              >
                {recuperacao ? "Usar o código do aplicativo" : "Perdi o aparelho: usar código de recuperação"}
              </Botao>
            </form>
          )}
        </CardConteudo>
      </Card>

      <p className="text-center text-xs leading-relaxed text-muted-fg">
        Esqueceu a senha? Peça ao administrador para redefinir.
        <br />
        <Link href="/privacidade" className="underline underline-offset-2 hover:text-fg">
          Política de privacidade
        </Link>
      </p>
    </div>
  );
}
