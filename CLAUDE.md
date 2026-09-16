# Axis — sistema de gestão

Front-end de um sistema de gestão para venda D2C de suplementos no modelo PAD
(pagamento na entrega). Funil: Meta Ads → WhatsApp → fechamento por telefone →
envio pelos Correios → cobrança após a entrega.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind v4 · componentes no estilo
shadcn/ui, reestilizados · Phosphor Icons (peso `fill`, variante `/ssr`).
Backend futuro: Neon Postgres via Drizzle, na Vercel.

## Estado atual

Fases 1 (fundação), 2 (operação), 3 (configurações e equipe) e 4 (financeiro e
marketing) concluídas.

Nada é persistido e nenhuma integração é real. Pedidos, cadastros, equipe,
financeiro e Meta Ads vivem em memória nos providers, semeados de
`src/lib/mock/` — recarregar a página volta ao mock. Fotos e ícones enviados
viram URL local da aba.

O mock tem histórico desde 1º de março: pedidos fechados gerados dia a dia
(`gerarHistorico`) somados aos 102 da operação corrente, e Meta Ads por
criativo no mesmo volume. Março é mês de partida; os comparativos começam em
abril. A fonte `api` do Meta Ads é simulada.

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
- `src/lib/providers/` — sessão simulada, aparência e o estado da sessão.
  `pedidos.tsx` concentra a mutação de pedidos; `cadastros.tsx` a de produtos,
  kits, criativos, linhas e bancos; `equipe.tsx` a de colaboradores, metas,
  níveis, conquistas, bônus e fechamentos pagos. É o que vira backend depois.
  Telas leem cadastros e nomes daqui, nunca direto do mock — o mock é semente.
  `financeiro.tsx` guarda parâmetros e pagamentos do fornecedor, faturas,
  alíquotas, despesas fixas e dívidas; `marketing.tsx` o Meta Ads (detalhe da
  API e dias lançados à mão). Os dois guardam só o que é lançado: previsto, DRE
  e análises são recalculados.
  Ordem de montagem: Equipe > Sessão > Cadastros > Pedidos > Financeiro > Marketing.
- `src/lib/filas.ts` — filas de autorização e cobrança. O contador da subaba e
  a lista que ela abre saem daqui, para nunca divergirem.
- `src/lib/checklist.ts` — a conferência que libera um envio. A ação de
  autorizar reusa a mesma função, então não há caminho que fure a checagem.
- `src/lib/taxas.ts` — taxa por forma de recebimento a partir do cadastro do
  banco, com a franquia de boletos (`boletosNoPeriodo`).
- `src/lib/periodos.ts` — janelas de meta, ranking e competência, cortadas no
  fuso de São Paulo por aritmética (nunca `setHours`: diverge na hidratação).
  Períodos de análise trafegam como dois dias `aaaa-mm-dd`, inclusive.
- `src/lib/desempenho.ts` — o que cada colaborador fez num intervalo: agendados,
  enviados, pagos, frustração. Metas, ranking e comissões contam daqui.
- `src/lib/metas.ts` — progresso e faixa atingida (vale a mais alta, não soma).
- `src/lib/comissoes.ts` — fórmula de vendedor e cobrador e o fechamento com
  detalhamento. Pendente é recalculado; pago congela no provider.
- `src/lib/fornecedor.ts` — custo previsto por envio (frete + potes; reembolsado
  só frete; cancelado fora), reembolsados para abatimento e conferência de fatura.
  O envio conta na data da autorização.
- `src/lib/meta-ads.ts` — dias de Meta Ads (API ou manual, nunca os dois no mesmo
  dia) e análise por criativo. Venda é pedido agendado no dia, sem cancelados. O
  investimento manual, sem detalhe por criativo, cai em "Criativo não identificado".
- `src/lib/resultado.ts` — DRE em caixa e competência, alíquota do Simples
  (sem valor confirmado, herda a do mês anterior como estimada) e previsão de
  entrada em 30 dias. Comissões vêm de `fechamentosDaCompetencia`, o mesmo da
  tela de comissões.
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
- Gráficos saem de `components/shared/grafico.tsx`: uma série e um eixo por
  gráfico. Duas medidas de escala diferente viram dois gráficos alinhados.
- `Tabela` desenha 50 linhas e oferece mostrar mais; `rodape` soma as visíveis.
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
