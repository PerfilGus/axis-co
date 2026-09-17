"use client";

import type { ReactNode } from "react";
import type { DadosIniciais } from "@/lib/servidor/dados";
import { EquipeProvider } from "@/lib/providers/equipe";
import { SessaoProvider } from "@/lib/providers/sessao";
import { CadastrosProvider } from "@/lib/providers/cadastros";
import { PedidosProvider } from "@/lib/providers/pedidos";
import { FinanceiroProvider } from "@/lib/providers/financeiro";
import { MarketingProvider } from "@/lib/providers/marketing";
import { NotificacoesProvider } from "@/lib/providers/notificacoes";

/**
 * Monta os providers com o que o servidor carregou para a sessão.
 * Ordem: Equipe > Sessão > Cadastros > Pedidos > Financeiro > Marketing > Notificações.
 */
export function ProvedoresDados({ dados, children }: { dados: DadosIniciais; children: ReactNode }) {
  return (
    <EquipeProvider inicial={dados.equipe}>
      <SessaoProvider usuario={dados.usuario} email={dados.email} doisFatores={dados.doisFatores}>
        <CadastrosProvider inicial={dados.cadastros}>
          <PedidosProvider inicial={dados.pedidos}>
            <FinanceiroProvider inicial={dados.financeiro}>
              <MarketingProvider inicial={dados.marketing}>
                <NotificacoesProvider inicial={dados.notificacoes}>{children}</NotificacoesProvider>
              </MarketingProvider>
            </FinanceiroProvider>
          </PedidosProvider>
        </CadastrosProvider>
      </SessaoProvider>
    </EquipeProvider>
  );
}
