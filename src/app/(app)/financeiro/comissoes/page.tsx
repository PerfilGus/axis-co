import { PaginaSimples } from "@/components/layout/pagina-simples";

export default function PaginaFinanceiroComissoes() {
  return (
    <PaginaSimples
      titulo="Comissões e pagamentos"
      descricao="O que cada colaborador tem a receber na competência."
      vazioTitulo="As comissões entram na fase de Financeiro"
      vazioDescricao="Calculadas pelas regras por setor e fechadas competência a competência."
      fase="Fase de Financeiro"
    />
  );
}
