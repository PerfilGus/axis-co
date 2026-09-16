import { PaginaSimples } from "@/components/layout/pagina-simples";

export default function PaginaConfiguracoesProdutos() {
  return (
    <PaginaSimples
      titulo="Produtos e kits"
      descricao="Potes, kits, preço de tabela e piso de negociação."
      vazioTitulo="O cadastro entra na fase de Configurações"
      vazioDescricao="O piso de cada kit é o que define quando um desconto vira pedido de ajuste ao Admin."
      fase="Fase de Configurações"
    />
  );
}
