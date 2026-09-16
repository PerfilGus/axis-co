import { PaginaSimples } from "@/components/layout/pagina-simples";

export default function PaginaFinanceiroFornecedor() {
  return (
    <PaginaSimples
      titulo="Fornecedor"
      descricao="Faturas de potes e pagamentos ao fornecedor."
      vazioTitulo="O controle de fornecedor entra na fase de Financeiro"
      vazioDescricao="Faturas, parcelas pagas e saldo em aberto por fornecedor, com anexo de nota."
      fase="Fase de Financeiro"
    />
  );
}
