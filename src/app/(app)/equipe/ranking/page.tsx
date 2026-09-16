import { PaginaSimples } from "@/components/layout/pagina-simples";

export default function PaginaEquipeRanking() {
  return (
    <PaginaSimples
      titulo="Ranking"
      descricao="Como a equipe está no período."
      vazioTitulo="O ranking entra na fase de Equipe"
      vazioDescricao="Vendedores por pedidos agendados menos cancelados; cobradores por pedidos pagos dos vendedores atribuídos."
      fase="Fase de Equipe"
    />
  );
}
