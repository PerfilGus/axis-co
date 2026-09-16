/** Vocabulário para gerar clientes plausíveis. */

export const NOMES = [
  "Adriana", "Alessandra", "Aline", "Amanda", "Ana Paula", "André", "Antônio",
  "Beatriz", "Bruno", "Camila", "Carlos", "Cláudia", "Cristiane", "Daniel",
  "Débora", "Diego", "Eduardo", "Elaine", "Fabiana", "Fábio", "Fernanda",
  "Flávio", "Gabriela", "Geraldo", "Gustavo", "Helena", "Igor", "Isabel",
  "Jefferson", "Joana", "João", "José", "Juliana", "Larissa", "Leandro",
  "Letícia", "Luciana", "Luiz", "Marcelo", "Márcia", "Mariana", "Mauro",
  "Nathália", "Osvaldo", "Patrícia", "Paulo", "Rafael", "Raquel", "Renata",
  "Ricardo", "Roberta", "Rodrigo", "Sandra", "Sérgio", "Simone", "Tatiane",
  "Thiago", "Vanessa", "Vinícius", "Wagner",
] as const;

export const SOBRENOMES = [
  "Almeida", "Alves", "Araújo", "Barbosa", "Barros", "Batista", "Cardoso",
  "Carvalho", "Castro", "Correia", "Costa", "Cunha", "Dias", "Duarte",
  "Ferreira", "Fernandes", "Fonseca", "Freitas", "Gomes", "Gonçalves",
  "Lima", "Lopes", "Machado", "Martins", "Melo", "Mendes", "Moraes",
  "Moreira", "Nascimento", "Nunes", "Oliveira", "Pereira", "Pinto", "Ramos",
  "Reis", "Ribeiro", "Rocha", "Rodrigues", "Santos", "Silva", "Soares",
  "Souza", "Teixeira", "Vieira",
] as const;

export const LOGRADOUROS = [
  "Rua das Acácias", "Avenida Brasil", "Rua Sete de Setembro", "Travessa Bela Vista",
  "Rua Dom Pedro II", "Avenida Getúlio Vargas", "Rua São João", "Rua das Palmeiras",
  "Avenida Presidente Vargas", "Rua Santa Luzia", "Rua Marechal Deodoro",
  "Rua Coronel Pedro Alves", "Avenida Nossa Senhora de Fátima", "Rua Projetada A",
  "Rua Antônio Carlos", "Alameda dos Ipês", "Rua João Pessoa", "Rua Boa Esperança",
  "Avenida Rio Branco", "Rua Quinze de Novembro",
] as const;

export const BAIRROS = [
  "Centro", "Jardim América", "Vila Nova", "Santa Mônica", "Bela Vista",
  "Cidade Nova", "Parque Industrial", "São Cristóvão", "Alto da Boa Vista",
  "Jardim Paulista", "Vila Operária", "Conjunto Habitacional", "Morada do Sol",
  "Novo Horizonte", "Santo Antônio",
] as const;

export interface CidadeMock {
  cidade: string;
  uf: string;
  cepBase: string;
}

/** Mistura de capitais e interior, como o perfil real de vendas PAD. */
export const CIDADES: readonly CidadeMock[] = [
  { cidade: "São Paulo", uf: "SP", cepBase: "0" },
  { cidade: "Campinas", uf: "SP", cepBase: "13" },
  { cidade: "Ribeirão Preto", uf: "SP", cepBase: "14" },
  { cidade: "Sorocaba", uf: "SP", cepBase: "18" },
  { cidade: "Rio de Janeiro", uf: "RJ", cepBase: "2" },
  { cidade: "Campos dos Goytacazes", uf: "RJ", cepBase: "28" },
  { cidade: "Belo Horizonte", uf: "MG", cepBase: "3" },
  { cidade: "Uberlândia", uf: "MG", cepBase: "38" },
  { cidade: "Juiz de Fora", uf: "MG", cepBase: "36" },
  { cidade: "Salvador", uf: "BA", cepBase: "4" },
  { cidade: "Feira de Santana", uf: "BA", cepBase: "44" },
  { cidade: "Recife", uf: "PE", cepBase: "5" },
  { cidade: "Caruaru", uf: "PE", cepBase: "55" },
  { cidade: "Fortaleza", uf: "CE", cepBase: "6" },
  { cidade: "Teresina", uf: "PI", cepBase: "64" },
  { cidade: "São Luís", uf: "MA", cepBase: "65" },
  { cidade: "Belém", uf: "PA", cepBase: "66" },
  { cidade: "Manaus", uf: "AM", cepBase: "69" },
  { cidade: "Goiânia", uf: "GO", cepBase: "74" },
  { cidade: "Brasília", uf: "DF", cepBase: "70" },
  { cidade: "Cuiabá", uf: "MT", cepBase: "78" },
  { cidade: "Curitiba", uf: "PR", cepBase: "8" },
  { cidade: "Londrina", uf: "PR", cepBase: "86" },
  { cidade: "Porto Alegre", uf: "RS", cepBase: "90" },
  { cidade: "Caxias do Sul", uf: "RS", cepBase: "95" },
  { cidade: "Florianópolis", uf: "SC", cepBase: "88" },
  { cidade: "Natal", uf: "RN", cepBase: "59" },
  { cidade: "João Pessoa", uf: "PB", cepBase: "58" },
  { cidade: "Maceió", uf: "AL", cepBase: "57" },
  { cidade: "Aracaju", uf: "SE", cepBase: "49" },
] as const;

export const REFERENCIAS = [
  "Portão verde, ao lado da padaria",
  "Sobrado dos fundos",
  "Prédio azul, falar com o porteiro",
  "Casa com grade branca",
  "Em frente à escola municipal",
  "Ponto comercial, entregar no balcão",
  null,
  null,
  null,
] as const;

export const OBSERVACOES_CLIENTE = [
  "Prefere receber depois das 14h.",
  "Só tem dinheiro trocado no fim do mês.",
  "Já comprou duas vezes, sempre pagou na hora.",
  "Pediu para avisar por WhatsApp antes da entrega.",
  "Mora com a filha, ela pode receber.",
  null,
  null,
  null,
  null,
] as const;
