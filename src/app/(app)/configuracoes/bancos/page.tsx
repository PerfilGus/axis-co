import { PaginaSimples } from "@/components/layout/pagina-simples";

export default function PaginaConfiguracoesBancos() {
  return (
    <PaginaSimples
      titulo="Bancos e plataformas"
      descricao="Onde o dinheiro entra e quanto cada plataforma cobra."
      vazioTitulo="O cadastro entra na fase de Configurações"
      vazioDescricao="Contas, saldos e taxa por plataforma. A leitura automática de saldo fica para a integração bancária."
      fase="Fase de Configurações"
    />
  );
}
