import type { Perfil } from "@/lib/types";
import type { NomeIcone } from "@/components/icone";

/** Contadores dinâmicos que uma subaba pode exibir em badge. */
export type ChaveContador = "autorizacoes" | "cobrancas" | "ajustes";

export interface ItemNav {
  rotulo: string;
  href: string;
  icone: NomeIcone;
  descricao: string;
  contador?: ChaveContador;
}

export interface GrupoNav {
  id: string;
  rotulo: string;
  icone: NomeIcone;
  /** Primeira rota do grupo; é para onde o item da barra leva. */
  href: string;
  itens: ItemNav[];
}

const PEDIDOS: ItemNav = {
  rotulo: "Pedidos",
  href: "/operacao/pedidos",
  icone: "pedidos",
  descricao: "Todos os pedidos, do agendamento ao pagamento.",
};

const COBRANCA: ItemNav = {
  rotulo: "Cobrança",
  href: "/operacao/cobranca",
  icone: "cobranca",
  descricao: "Pedidos entregues à espera de pagamento.",
  contador: "cobrancas",
};

const MINHA_AREA: ItemNav = {
  rotulo: "Minha área",
  href: "/minha-area",
  icone: "minhaArea",
  descricao: "Seu desempenho, metas e conquistas.",
};

const PERFIL: ItemNav = {
  rotulo: "Perfil",
  href: "/minha-area/perfil",
  icone: "usuario",
  descricao: "Seus dados, sua remuneração e a aparência do sistema.",
};

/** Perfil só existe como aba no mobile; no desktop fica no menu do avatar. */
export const HREF_PERFIL = PERFIL.href;

const RANKING: ItemNav = {
  rotulo: "Ranking",
  href: "/equipe/ranking",
  icone: "ranking",
  descricao: "Como a equipe está no período.",
};

const GRUPOS_ADMIN: GrupoNav[] = [
  {
    id: "dashboard",
    rotulo: "Dashboard",
    icone: "dashboard",
    href: "/dashboard",
    itens: [],
  },
  {
    id: "operacao",
    rotulo: "Operação",
    icone: "operacao",
    href: "/operacao/pedidos",
    itens: [
      PEDIDOS,
      {
        rotulo: "Autorizar envios",
        href: "/operacao/autorizar",
        icone: "autorizar",
        descricao: "Fila de pedidos esperando liberação de envio.",
        contador: "autorizacoes",
      },
      {
        rotulo: "Rastreio",
        href: "/operacao/rastreio",
        icone: "rastreio",
        descricao: "Objetos em circulação nos Correios.",
      },
      COBRANCA,
    ],
  },
  {
    id: "financeiro",
    rotulo: "Financeiro",
    icone: "financeiro",
    href: "/financeiro/relatorio",
    itens: [
      {
        rotulo: "Relatório financeiro",
        href: "/financeiro/relatorio",
        icone: "relatorio",
        descricao: "Entradas, custos, impostos e resultado do período.",
      },
      {
        rotulo: "Fornecedor",
        href: "/financeiro/fornecedor",
        icone: "fornecedor",
        descricao: "Custo previsto dos envios, pagamentos e conferência de fatura.",
      },
      {
        rotulo: "Comissões e pagamentos",
        href: "/financeiro/comissoes",
        icone: "comissoes",
        descricao: "O que cada colaborador tem a receber na competência.",
      },
    ],
  },
  {
    id: "marketing",
    rotulo: "Marketing",
    icone: "marketing",
    href: "/marketing/meta-ads",
    itens: [
      {
        rotulo: "Meta Ads",
        href: "/marketing/meta-ads",
        icone: "metaAds",
        descricao: "Investimento, leads e custo por venda, dia a dia.",
      },
      {
        rotulo: "Criativos",
        href: "/marketing/criativos",
        icone: "criativos",
        descricao: "Desempenho por criativo e linha de WhatsApp.",
      },
    ],
  },
  {
    id: "equipe",
    rotulo: "Equipe",
    icone: "equipe",
    href: "/equipe/colaboradores",
    itens: [
      {
        rotulo: "Colaboradores",
        href: "/equipe/colaboradores",
        icone: "colaboradores",
        descricao: "Quem é quem, perfis e atribuições.",
      },
      RANKING,
    ],
  },
];

const GRUPOS_VENDEDOR: GrupoNav[] = [
  { id: "minha-area", rotulo: "Minha área", icone: "minhaArea", href: MINHA_AREA.href, itens: [] },
  { id: "pedidos", rotulo: "Pedidos", icone: "pedidos", href: PEDIDOS.href, itens: [] },
  { id: "equipe", rotulo: "Equipe", icone: "equipe", href: RANKING.href, itens: [] },
];

const GRUPOS_COBRADOR: GrupoNav[] = [
  { id: "minha-area", rotulo: "Minha área", icone: "minhaArea", href: MINHA_AREA.href, itens: [] },
  { id: "cobranca", rotulo: "Cobrança", icone: "cobranca", href: COBRANCA.href, itens: [] },
  { id: "equipe", rotulo: "Equipe", icone: "equipe", href: RANKING.href, itens: [] },
];

export const GRUPOS_POR_PERFIL: Record<Perfil, GrupoNav[]> = {
  admin: GRUPOS_ADMIN,
  vendedor: GRUPOS_VENDEDOR,
  cobrador: GRUPOS_COBRADOR,
};

const NOTIFICACOES: ItemNav = {
  rotulo: "Notificações",
  href: "/configuracoes/notificacoes",
  icone: "notificacoes",
  descricao: "O que avisa no sino e no celular.",
};

const CONFIG_ADMIN: ItemNav[] = [
  {
    rotulo: "Produtos e kits",
    href: "/configuracoes/produtos",
    icone: "produtos",
    descricao: "Potes, kits, preço de tabela e piso de negociação.",
  },
  {
    rotulo: "Bancos e plataformas",
    href: "/configuracoes/bancos",
    icone: "bancos",
    descricao: "Onde o dinheiro entra e quanto cada plataforma cobra.",
  },
  {
    rotulo: "Criativos e linhas de WhatsApp",
    href: "/configuracoes/criativos-linhas",
    icone: "criativos",
    descricao: "Cadastro dos criativos e das linhas que os atendem.",
  },
  {
    rotulo: "Pontos e metas",
    href: "/configuracoes/metas",
    icone: "metas",
    descricao: "Pontuação por pedido, níveis, metas, conquistas e recompensas.",
  },
  NOTIFICACOES,
  {
    rotulo: "Aparência",
    href: "/configuracoes/aparencia",
    icone: "aparencia",
    descricao: "Tema claro ou escuro e sua cor de destaque.",
  },
];

const APARENCIA = CONFIG_ADMIN[CONFIG_ADMIN.length - 1];

const SEGURANCA: ItemNav = {
  rotulo: "Segurança da conta",
  href: "/configuracoes/seguranca",
  icone: "cadeado",
  descricao: "Senha, verificação em duas etapas e aparelhos conectados.",
};

export const CONFIG_POR_PERFIL: Record<Perfil, ItemNav[]> = {
  admin: [...CONFIG_ADMIN, SEGURANCA],
  vendedor: [APARENCIA, NOTIFICACOES, SEGURANCA],
  cobrador: [APARENCIA, NOTIFICACOES, SEGURANCA],
};

export const GRUPO_CONFIG: GrupoNav = {
  id: "configuracoes",
  rotulo: "Configurações",
  icone: "configuracoes",
  href: "/configuracoes/produtos",
  itens: [...CONFIG_ADMIN, SEGURANCA],
};

/** Grupo (ou Configurações) ao qual a rota atual pertence. */
export function grupoDaRota(perfil: Perfil, pathname: string): GrupoNav | null {
  if (perfil !== "admin" && pathname.startsWith(PERFIL.href)) return GRUPO_PERFIL;
  if (pathname.startsWith("/configuracoes")) {
    return { ...GRUPO_CONFIG, itens: CONFIG_POR_PERFIL[perfil] };
  }
  const grupos = GRUPOS_POR_PERFIL[perfil];
  const porItem = grupos.find((g) =>
    g.itens.some((i) => pathname.startsWith(i.href)),
  );
  if (porItem) return porItem;
  return grupos.find((g) => pathname.startsWith(g.href)) ?? null;
}

export function itemDaRota(perfil: Perfil, pathname: string): ItemNav | null {
  const todos = [
    ...GRUPOS_POR_PERFIL[perfil].flatMap((g) => g.itens),
    ...CONFIG_POR_PERFIL[perfil],
    PEDIDOS,
    COBRANCA,
    MINHA_AREA,
    RANKING,
    ...(perfil === "admin" ? [] : [PERFIL]),
  ];
  return (
    todos.find((i) => i.href === pathname) ??
    todos.find((i) => pathname.startsWith(i.href)) ??
    null
  );
}

/** Paleta, badges e seletor de cor. Só admin, fora do menu: abre pela Aparência. */
export const HREF_DESIGN = "/design";

/** O perfil enxerga esta rota? Usado para barrar acesso direto pela URL. */
export function podeAcessar(perfil: Perfil, pathname: string): boolean {
  if (pathname === "/" ) return true;
  const permitidas = [
    ...(perfil === "admin" ? [HREF_DESIGN] : []),
    ...GRUPOS_POR_PERFIL[perfil].flatMap((g) => [g.href, ...g.itens.map((i) => i.href)]),
    ...CONFIG_POR_PERFIL[perfil].map((i) => i.href),
  ];
  return permitidas.some((href) => pathname.startsWith(href));
}

const GRUPO_PERFIL: GrupoNav = {
  id: "perfil",
  rotulo: PERFIL.rotulo,
  icone: PERFIL.icone,
  href: PERFIL.href,
  itens: [],
};

/**
 * Itens da barra inferior no mobile. Máximo de cinco. Vendedor e cobrador têm
 * a Minha área como início e o Perfil no lugar de Ajustes.
 */
export function itensMobile(perfil: Perfil): GrupoNav[] {
  if (perfil !== "admin") {
    return [
      ...GRUPOS_POR_PERFIL[perfil].map((g) =>
        g.id === "minha-area" ? { ...g, rotulo: "Início", icone: "dashboard" as const } : g,
      ),
      GRUPO_PERFIL,
    ];
  }
  const grupos = GRUPOS_POR_PERFIL[perfil].slice(0, 4);
  return [
    ...grupos,
    { ...GRUPO_CONFIG, rotulo: "Ajustes", href: CONFIG_POR_PERFIL[perfil][0].href },
  ];
}
