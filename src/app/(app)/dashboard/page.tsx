import { PaginaSimples } from "@/components/layout/pagina-simples";

export default function PaginaDashboard() {
  return (
    <PaginaSimples
      titulo="Dashboard"
      descricao="Visão geral do negócio, do funil ao caixa."
      vazioTitulo="O painel será montado no fim"
      vazioDescricao="Depende dos números que as outras telas vão consolidar: pedidos, custos, tráfego e cobrança."
      fase="Construída na última fase"
    />
  );
}
