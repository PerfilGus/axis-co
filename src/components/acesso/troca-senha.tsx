"use client";

import { useState } from "react";
import { problemaDaSenha, SENHA_MIN } from "@/lib/senha";
import { trocarSenha } from "@/app/acoes/acesso";
import { Icone } from "@/components/icone";
import { Botao } from "@/components/ui/button";
import { Campo } from "@/components/ui/label";
import { CampoSenha } from "./campo-senha";

/**
 * Troca de senha. Usada no primeiro acesso (senha provisória) e na tela de
 * segurança da conta. Encerra as sessões dos outros aparelhos.
 */
export function TrocaSenha({
  email,
  rotuloBotao = "Trocar senha",
  aoConcluir,
}: {
  email: string;
  rotuloBotao?: string;
  aoConcluir: () => void;
}) {
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const problema = nova ? problemaDaSenha(nova, email) : null;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!atual) return setErro("Informe a senha atual.");
    const recusa = problemaDaSenha(nova, email);
    if (recusa) return setErro(recusa);
    if (nova !== confirmacao) return setErro("A confirmação não bate com a nova senha.");
    setEnviando(true);
    const resultado = await trocarSenha(atual, nova);
    setEnviando(false);
    if (!resultado.ok) return setErro(resultado.erro);
    setAtual("");
    setNova("");
    setConfirmacao("");
    aoConcluir();
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
      <Campo rotulo="Senha atual">
        <CampoSenha valor={atual} aoMudar={setAtual} autoComplete="current-password" autoFocus />
      </Campo>
      <Campo
        rotulo="Nova senha"
        ajuda={`Pelo menos ${SENHA_MIN} caracteres, com letras e números.`}
        erro={problema}
      >
        <CampoSenha valor={nova} aoMudar={setNova} autoComplete="new-password" />
      </Campo>
      <Campo rotulo="Confirme a nova senha">
        <CampoSenha valor={confirmacao} aoMudar={setConfirmacao} autoComplete="new-password" />
      </Campo>
      {erro && (
        <p className="text-[13px] text-[var(--st-vermelho-fg)]" role="alert">
          {erro}
        </p>
      )}
      <Botao type="submit" variante="principal" tamanho="lg" disabled={enviando}>
        <Icone nome="chave" size={18} />
        {enviando ? "Salvando…" : rotuloBotao}
      </Botao>
    </form>
  );
}
