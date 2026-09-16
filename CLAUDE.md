# Axis — sistema de gestão

Front-end de um sistema de gestão para venda D2C de suplementos no modelo PAD
(pagamento na entrega). Funil: Meta Ads → WhatsApp → fechamento por telefone →
envio pelos Correios → cobrança após a entrega.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind v4 · componentes no estilo
shadcn/ui, reestilizados · Phosphor Icons (peso `fill`, variante `/ssr`).
Backend futuro: Neon Postgres via Drizzle, na Vercel.

## Estado atual

Fases 1 (fundação) e 2 (operação) concluídas, Rastreio incluído.

Nada é persistido e nenhuma integração é real. Os pedidos vivem em memória no
`PedidosProvider`, semeados de `src/lib/mock/` — recarregar a página volta ao
mock.

## Mapa do código

- `src/lib/types/` — contratos do domínio. `rastreio.ts` é o contrato de `order`
  do axis-tracking, com o mapa de nomes no topo do arquivo.
- `src/lib/rastreio/` — a aba Rastreio, migrada do axis-tracking: lista e
  agrupamento, cópia inteligente, CSV, mapa evento SRO → status e a atualização
  simulada. O levantamento do que foi portado, ajustado ou removido está em
  `referencia/axis-tracking/INVENTARIO.md` — consulte antes de mexer nessa aba.
- `src/lib/mock/` — dados fictícios determinísticos (`rng` com seed fixo, e
  `HOJE` congelado). Nunca use `Math.random` nem `new Date()` aqui: quebra a
  hidratação.
- `src/lib/nav.ts` — mapa de navegação e permissões por perfil.
- `src/lib/status.ts` — rótulos e tons de status. **As cores de status são
  fixas**: nunca acompanham o destaque escolhido pelo usuário. As de rastreio
  são os valores exatos do axis-tracking, nas variáveis `--rt-*`.
- `src/lib/providers/` — sessão simulada, aparência e o estado dos pedidos.
  `pedidos.tsx` concentra toda mutação (criar, autorizar, cancelar, decidir
  ajuste, registrar pagamento); é o que vira chamada de backend depois.
- `src/lib/filas.ts` — filas de autorização e cobrança. O contador da subaba e
  a lista que ela abre saem daqui, para nunca divergirem.
- `src/lib/checklist.ts` — a conferência que libera um envio. A ação de
  autorizar reusa a mesma função, então não há caminho que fure a checagem.
- `src/lib/taxas.ts` — taxa estimada por forma de recebimento e banco.
- `src/lib/cep.ts` — busca de endereço simulada, com a assinatura de uma
  chamada de rede.
- `src/components/ui/` — primitivos reestilizados.
- `src/components/shared/` — componentes de produto reutilizáveis.

## Convenções

- Dinheiro trafega em **centavos** (`Centavos`), formatado com `formatBRL`.
  Em tabelas, alinhado à direita com a classe `tabular`.
- Datas em `dd/mm/aaaa` via `formatData`. ISO sempre com fuso `-03:00`.
- Textos em português, em caixa normal. Botões com verbo claro.
- Nomes de domínio em português; hooks do React mantêm o prefixo `use`
  (`usePreferencia`), exigência da regra `react-hooks/rules-of-hooks`.
- Raio: pílulas > cards (24px) > inputs (14px). Sem sombra no tema escuro.
- Movimento só em resposta a ações. A exceção é a premiação (`axis-premio`).
- Funções passadas a `setState` são puras: em desenvolvimento o React as chama
  duas vezes. Ações em lote calculam o resultado antes de chamar `setPedidos`.
- Depois de muitas edições seguidas, o Turbopack pode servir chunk velho e
  acusar erro inexistente. `rm -rf .next` e suba o servidor de novo antes de
  investigar.

## Antes de entregar

```bash
npm run typecheck && npm run lint && npm run build
```
