"use client";

import { useState } from "react";
import type { Colaborador } from "@/lib/types";
import { gerarSenhaProvisoria } from "@/lib/senha";
import { useEquipe } from "@/lib/providers/equipe";
import { Icone } from "@/components/icone";
import { Botao } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { ModalConfirmacao } from "@/components/shared/modal-confirmacao";

type Acao = "senha" | "sessoes" | "2fa";

/**
 * Acesso de um colaborador, pelo Admin: senha provisória nova, encerrar as
 * sessões em todos os aparelhos e desligar o 2FA de quem perdeu o celular.
 * Desativar e reativar ficam no cadastro (campo "Colaborador ativo").
 */
export function AcessoColaborador({ colaborador }: { colaborador: Colaborador }) {
  const { redefinirSenha, encerrarSessoes, redefinirDoisFatores } = useEquipe();
  const [acao, setAcao] = useState<Acao | null>(null);
  const [senha, setSenha] = useState("");
  const [senhaGerada, setSenhaGerada] = useState<string | null>(null);

  function abrir(qual: Acao) {
    if (qual === "senha") setSenha(gerarSenhaProvisoria());
    setAcao(qual);
  }

  async function confirmar() {
    const qual = acao;
    setAcao(null);
    if (qual === "senha") {
      if (await redefinirSenha(colaborador.id, senha)) setSenhaGerada(senha);
    }
    if (qual === "sessoes") {
      const total = await encerrarSessoes(colaborador.id);
      if (total !== null) toast.success(`${total} sessão(ões) encerrada(s)`, { description: colaborador.nome });
    }
    if (qual === "2fa" && (await redefinirDoisFatores(colaborador.id))) {
      toast.success("Verificação em duas etapas redefinida", {
        description: `${colaborador.apelido} configura de novo no próximo acesso.`,
      });
    }
  }

  const textos: Record<Acao, { titulo: string; mensagem: string; itens: string[]; rotulo: string }> = {
    senha: {
      titulo: "Redefinir a senha?",
      mensagem: "A senha atual deixa de valer e todos os aparelhos saem da conta.",
      itens: [colaborador.email, `Senha provisória: ${senha}`],
      rotulo: "Redefinir senha",
    },
    sessoes: {
      titulo: "Encerrar todas as sessões?",
      mensagem: "A pessoa sai da conta em todos os aparelhos e precisa entrar de novo.",
      itens: [colaborador.nome],
      rotulo: "Encerrar sessões",
    },
    "2fa": {
      titulo: "Redefinir a verificação em duas etapas?",
      mensagem: "Use quando a pessoa perdeu o celular. O login volta a pedir só a senha até ela configurar de novo.",
      itens: [colaborador.nome],
      rotulo: "Redefinir",
    },
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Botao variante="secundaria" tamanho="sm" onClick={() => abrir("senha")}>
          <Icone nome="chave" size={14} />
          Redefinir senha
        </Botao>
        <Botao variante="secundaria" tamanho="sm" onClick={() => abrir("sessoes")}>
          <Icone nome="sair" size={14} />
          Encerrar sessões
        </Botao>
        <Botao variante="secundaria" tamanho="sm" onClick={() => abrir("2fa")}>
          <Icone nome="escudo" size={14} />
          Redefinir 2FA
        </Botao>
      </div>

      {senhaGerada && (
        <div className="flex flex-col gap-1 rounded-[var(--radius-card-sm)] border border-border bg-surface-2 px-4 py-3">
          <span className="text-[13px]">Senha provisória de {colaborador.apelido}:</span>
          <code className="tabular text-lg select-all">{senhaGerada}</code>
          <span className="text-xs text-muted-fg">Passe à pessoa. Ela troca no próximo acesso. Não aparece de novo.</span>
        </div>
      )}

      {acao && (
        <ModalConfirmacao
          aberto
          titulo={textos[acao].titulo}
          mensagem={textos[acao].mensagem}
          itens={textos[acao].itens}
          rotuloConfirmar={textos[acao].rotulo}
          perigo
          icone="cadeado"
          aoCancelar={() => setAcao(null)}
          aoConfirmar={confirmar}
        />
      )}
    </div>
  );
}
