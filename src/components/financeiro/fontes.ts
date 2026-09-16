"use client";

import { useMemo } from "react";
import type { PagamentoColaborador } from "@/lib/types";
import { fechamentosDaCompetencia } from "@/lib/comissoes";
import type { FontesResultado } from "@/lib/resultado";
import { useCadastros } from "@/lib/providers/cadastros";
import { useEquipe } from "@/lib/providers/equipe";
import { useFinanceiro } from "@/lib/providers/financeiro";
import { useMarketing } from "@/lib/providers/marketing";
import { usePedidos } from "@/lib/providers/pedidos";

/**
 * Junta tudo que o relatório financeiro lê dos providers. Os fechamentos de
 * cada competência são calculados uma vez e reaproveitados entre caixa,
 * competência e o comparativo mensal.
 */
export function useFontesResultado(): FontesResultado {
  const { pedidos } = usePedidos();
  const { kits } = useCadastros();
  const equipe = useEquipe();
  const { colaboradores, pagamentos, bonusNivel } = equipe;
  const { lancamentos, diasManuais } = useMarketing();
  const { parametros, pagamentosFornecedor, aliquotas, despesas, dividas } = useFinanceiro();

  return useMemo<FontesResultado>(() => {
    const cache = new Map<string, PagamentoColaborador[]>();
    return {
      pedidos,
      kits,
      parametros,
      pagamentosFornecedor,
      lancamentosMeta: lancamentos,
      diasManuaisMeta: diasManuais,
      aliquotas,
      despesas,
      dividas,
      fechamentosPagos: pagamentos,
      bonusNivel,
      fechamentosDa: (competencia) => {
        const pronto = cache.get(competencia);
        if (pronto) return pronto;
        const calculado = fechamentosDaCompetencia(competencia, colaboradores, pagamentos, pedidos, equipe);
        cache.set(competencia, calculado);
        return calculado;
      },
    };
  }, [
    pedidos,
    kits,
    parametros,
    pagamentosFornecedor,
    lancamentos,
    diasManuais,
    aliquotas,
    despesas,
    dividas,
    colaboradores,
    pagamentos,
    bonusNivel,
    equipe,
  ]);
}
