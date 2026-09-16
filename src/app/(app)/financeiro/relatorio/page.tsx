import { PaginaSimples } from "@/components/layout/pagina-simples";

export default function PaginaFinanceiroRelatorio() {
  return (
    <PaginaSimples
      titulo="Relatório financeiro"
      descricao="Entradas, custos, impostos e resultado do período."
      vazioTitulo="O relatório entra na fase de Financeiro"
      vazioDescricao="Vai cruzar faturamento, custo de frete e de pote, tráfego, comissões, despesas e alíquota da competência."
      fase="Fase de Financeiro"
    />
  );
}
