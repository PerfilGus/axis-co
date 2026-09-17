"use client";

import { useState } from "react";
import QRCode from "qrcode";
import { authCliente, mensagemDeErro } from "@/lib/auth-cliente";
import { Icone } from "@/components/icone";
import { Botao } from "@/components/ui/button";
import { Campo } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { CampoSenha } from "./campo-senha";

type Etapa = "senha" | "qr" | "codigos";

/**
 * Ativação do TOTP em três passos: confirma a senha, lê o QR no aplicativo
 * (Google Authenticator, 1Password, Authy…) e guarda os códigos de
 * recuperação. Só vale depois que o primeiro código confere.
 */
export function ConfigurarDoisFatores({ aoConcluir }: { aoConcluir: () => void }) {
  const [etapa, setEtapa] = useState<Etapa>("senha");
  const [senha, setSenha] = useState("");
  const [qr, setQr] = useState<string | null>(null);
  const [segredo, setSegredo] = useState("");
  const [codigos, setCodigos] = useState<string[]>([]);
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function gerar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!senha) return setErro("Informe a sua senha.");
    setEnviando(true);
    const { data, error } = await authCliente.twoFactor.enable({ password: senha });
    setEnviando(false);
    if (error || !data || !("totpURI" in data)) return setErro(mensagemDeErro(error));
    setSenha("");
    setCodigos(data.backupCodes);
    setSegredo(new URL(data.totpURI).searchParams.get("secret") ?? "");
    setQr(await QRCode.toDataURL(data.totpURI, { margin: 1, width: 220 }));
    setEtapa("qr");
  }

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const limpo = codigo.replace(/\s/g, "");
    if (limpo.length !== 6) return setErro("O código tem 6 dígitos.");
    setEnviando(true);
    const { error } = await authCliente.twoFactor.verifyTotp({ code: limpo });
    setEnviando(false);
    if (error) return setErro(mensagemDeErro(error));
    setEtapa("codigos");
  }

  async function copiarCodigos() {
    try {
      await navigator.clipboard.writeText(codigos.join("\n"));
      toast.success("Códigos copiados", { description: "Guarde num lugar seguro, fora deste aparelho." });
    } catch {
      toast.error("Não deu para copiar. Anote os códigos.");
    }
  }

  if (etapa === "senha") {
    return (
      <form onSubmit={gerar} className="flex flex-col gap-4" noValidate>
        <p className="text-[13px] text-muted-fg">
          Você vai precisar de um aplicativo autenticador no celular, como Google Authenticator,
          Microsoft Authenticator ou 1Password.
        </p>
        <Campo rotulo="Confirme a sua senha">
          <CampoSenha valor={senha} aoMudar={setSenha} autoComplete="current-password" autoFocus />
        </Campo>
        {erro && <p className="text-[13px] text-[var(--st-vermelho-fg)]" role="alert">{erro}</p>}
        <Botao type="submit" variante="principal" tamanho="lg" disabled={enviando}>
          <Icone nome="escudo" size={18} />
          {enviando ? "Gerando…" : "Continuar"}
        </Botao>
      </form>
    );
  }

  if (etapa === "qr") {
    return (
      <form onSubmit={confirmar} className="flex flex-col gap-4" noValidate>
        <p className="text-[13px] text-muted-fg">
          No aplicativo, adicione uma conta e leia o QR. No próprio iPhone, toque e segure a chave abaixo
          para copiar e colar no aplicativo.
        </p>
        {qr && (
          // QR gerado neste navegador, em data URL: não passa pelo otimizador de imagem.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt="QR para o aplicativo autenticador" className="mx-auto size-[220px] rounded-[14px] bg-white p-2" />
        )}
        <code className="block rounded-[var(--radius-input)] bg-surface-2 px-3 py-2 text-center text-[13px] break-all select-all">
          {segredo}
        </code>
        <Campo rotulo="Código que aparece no aplicativo">
          <Input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            className="tabular text-lg tracking-[0.3em]"
          />
        </Campo>
        {erro && <p className="text-[13px] text-[var(--st-vermelho-fg)]" role="alert">{erro}</p>}
        <Botao type="submit" variante="principal" tamanho="lg" disabled={enviando}>
          <Icone nome="check" size={18} />
          {enviando ? "Conferindo…" : "Ativar"}
        </Botao>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-muted-fg">
        Verificação ativada. Guarde estes códigos de recuperação: cada um entra uma vez, se você perder o
        celular. Eles não aparecem de novo.
      </p>
      <ul className="grid grid-cols-2 gap-2 rounded-[var(--radius-card-sm)] bg-surface-2 p-4">
        {codigos.map((c) => (
          <li key={c} className="tabular text-center text-[13px] select-all">
            {c}
          </li>
        ))}
      </ul>
      <Botao variante="secundaria" onClick={copiarCodigos}>
        <Icone nome="copiar" size={16} />
        Copiar códigos
      </Botao>
      <Botao variante="principal" tamanho="lg" onClick={aoConcluir}>
        Já guardei, continuar
      </Botao>
    </div>
  );
}
