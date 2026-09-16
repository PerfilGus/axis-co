# Inventário do axis-tracking

Levantamento do que a tela faz hoje, item a item, feito a partir do código
(`index.html`, `lib/correios.js`, `lib/normalize.js`) e não da documentação.
Serve de contrato da migração para a aba **Rastreio** do sistema Axis.

Coluna **Situação**, preenchida ao fim da migração:

- **Portado** — existe no sistema Axis com o mesmo comportamento.
- **Portado com ajuste** — o comportamento é o mesmo, a implementação muda
  (fonte de dado, identidade visual). O motivo está na linha.
- **Removido** — não vai para o sistema Axis. O motivo está na linha.

---

## 1. Modelo de dados (`order`)

| Campo | Tipo | Observação | Situação |
|---|---|---|---|
| `id` | number | Serial do Postgres | Portado como `Pedido.id` |
| `code` | string | `^[A-Z]{2}\d{9}[A-Z]{2}$` | Portado como `Rastreio.codigo` |
| `name` | string | Nome do cliente | Portado como `Pedido.cliente.nome` |
| `phone` | string | `(00) 90000-0000` | Portado como `Pedido.cliente.telefone` |
| `address` | `{street, district, city, uf, cep}` | Entrega; pode vir vazio | Portado como `Pedido.cliente.endereco` |
| `pots` | int \| null | Quantidade de potes | Portado — vem dos itens do kit |
| `value` | number | Valor do pedido | Portado como `Pedido.valorTotal` (em centavos) |
| `orderDate` | ISO \| null | Data do pedido | Portado como `Pedido.criadoEm` |
| `status` | chave de `STATUS` | 7 valores | Portado como `Rastreio.status` |
| `failureReason` | string | Só quando `falha` | Portado como `Rastreio.motivoFalha` |
| `pickup` | `{agency, address, availableAt, deadline}` | Só quando `aguardando_retirada`; vem do evento LDI | Portado como `Rastreio.retirada` |
| `archived` | bool | | Portado como `Rastreio.arquivado` |
| `archivedAt` | ISO \| null | Carimbado ao arquivar, zerado ao desarquivar | Portado como `Rastreio.arquivadoEm` |
| `highlighted` | bool | Atualização ainda não vista | Portado como `Rastreio.destacado` |
| `events[]` | `{at, title, desc, city, type}` | Mais recente primeiro | Portado como `Rastreio.eventos` |

Regras do modelo:

| # | Regra | Situação |
|---|---|---|
| 1.1 | Não existe campo `lastUpdate`: a última atualização é `events[0].at`, com fallback em `orderDate` via `lastUpdateAt(o)` | Portado (`ultimaAtualizacaoDe`) |
| 1.2 | `orderDate` pode ser `null`; formatadores devolvem `—` | Portado |
| 1.3 | Não existe campo `kit`; só `pots` (inteiro), exibido como "N potes" | Portado (potes derivados do kit do pedido) |
| 1.4 | Datas são ISO 8601 de verdade, nunca string formatada | Portado |
| 1.5 | `address` pode vir vazio → "Endereço não informado" | Portado |

---

## 2. Status (`STATUS`, `SECTION_ORDER`)

| Chave | Label | `base` | `text` | Ícone | Título da seção |
|---|---|---|---|---|---|
| `aguardando_postagem` | Aguardando postagem | `#6e6e7a` | `#adadb8` | tag | Aguardando postagem |
| `postado` | Postado | `#8a8a94` | `#c4c4cd` | package | Postado |
| `em_transferencia` | Em transferência | `#4a90f2` | `#8ab8ff` | shuffle | Pedidos em Trânsito |
| `saiu_para_entrega` | Saiu para entrega | `#f2994a` | `#ffbf80` | truck | Saiu para Entrega |
| `entregue` | Entregue | `#3fb968` | `#7ee0a0` | check | Pedidos Entregues |
| `aguardando_retirada` | Aguardando retirada | `#9b7bf0` | `#c3aefc` | mapPin | Aguardando Retirada |
| `falha` | Falha | `#e5484d` | `#ff9d9f` | alert | Falha na Entrega |

| # | Regra | Situação |
|---|---|---|
| 2.1 | `SECTION_ORDER` = entregue → saiu_para_entrega → falha → aguardando_retirada → em_transferencia → postado → aguardando_postagem | Portado |
| 2.2 | A mesma cor serve badge, fundo do card, borda esquerda, ícone da timeline e ponto da seção | Portado |
| 2.3 | Opacidades: `0.15` fundo de card destacado, `0.18` fundo de badge, `0.4` borda de badge, `0.08` fundo de bloco de alerta, `0.35` borda dele — via `hexToRgba()` | Portado |
| 2.4 | Tema escuro apenas | Portado com ajuste — o sistema Axis tem tema claro. As matizes são as mesmas; no claro, `base` escurece para manter contraste |

---

## 3. Estado da tela (`state`)

| Campo | Valores | Situação |
|---|---|---|
| `tab` | `transito` \| `arquivados` | Portado |
| `filter` | `todos` + as 7 chaves de status | Portado |
| `sort` | `update` \| `created` | Portado |
| `selectedId` | id do pedido aberto no painel | Portado |
| `selecting` | modo de seleção em massa ligado | Portado |
| `selected` | `Set` de ids marcados | Portado |

---

## 4. Helpers

| Função | O que faz | Situação |
|---|---|---|
| `fmtMoney(v)` | `toLocaleString` pt-BR/BRL | Portado (`formatBRL`) |
| `esc(s)` | Escapa texto de terceiros antes de `innerHTML` | Removido — React escapa por construção |
| `fullAddress(o)` | `rua · bairro - cidade/UF`, ou "Endereço não informado" | Portado (`enderecoCompleto`) |
| `fmtDateTime(iso)` | `dd/mm/aaaa hh:mm` — painel e CSV | Portado (`formatDataHoraCurta`) |
| `fmtEventDateTime(iso)` | `dd/mm hh:mm` — timeline | Portado (`formatDataHoraEvento`) |
| `fmtRelative(iso)` | `há X min` \| `há Xh` \| `há Xd` | Portado (`formatHa`) |
| `lastUpdateAt(o)` | `events[0].at` ou `orderDate` | Portado (`ultimaAtualizacaoDe`) |
| `eventAtOf(o, type)` | Quando aconteceu o evento daquele tipo | Portado (`momentoDoEvento`) |
| `nameCase(s)` | `"JOSE DA SILVA"` → `"Jose da Silva"` | Portado (`nomeProprio`) |
| `hexToRgba(hex, a)` | Cor de status com opacidade | Portado (`corComOpacidade`) |
| `visibleOrders()` | Filtra por aba e por status | Portado (`rastreiosVisiveis`) |
| `sortOrders(list)` | Ordena por atualização ou criação | Portado (`ordenarRastreios`) |
| `orderTimestamp` / `minutesAgo` | Comparadores da ordenação | Portado |
| `formatPhoneBR(raw)` | `(00) 90000-0000`; 10 dígitos ganham o 9; tira `+55` | Portado (`formatTelefone` já existia; regra do 9 incorporada) |

---

## 5. Lista

| # | Comportamento | Situação |
|---|---|---|
| 5.1 | Grid responsivo `auto-fill, minmax(280px, 1fr)`, gap 12px | Portado |
| 5.2 | Seção "Atualizações Recentes" no topo com todos os `highlighted`, ponto na cor de accent | Portado |
| 5.3 | Depois, uma seção por status na ordem de `SECTION_ORDER`, só com os não destacados | Portado |
| 5.4 | Cada seção: ponto colorido + título + contador + régua até a borda | Portado |
| 5.5 | Contador de pedidos visíveis no cabeçalho ("N pedidos") | Portado |
| 5.6 | Contadores por aba (Em Trânsito / Arquivados) | Portado |
| 5.7 | Estado vazio: "Nenhum pedido encontrado com esse filtro." | Portado |

## 6. Card (`buildCard`)

| # | Campo / comportamento | Situação |
|---|---|---|
| 6.1 | Código monoespaçado à esquerda + badge de status à direita | Portado |
| 6.2 | Nome do cliente em negrito, linha própria; sem nome → "Sem nome" | Portado |
| 6.3 | Telefone à esquerda + `fmtRelative(lastUpdateAt)` à direita | Portado |
| 6.4 | Último evento dos Correios (`events[0].title`); sem eventos → "Sem eventos de rastreio" | Portado |
| 6.5 | Linha inferior: motivo da falha com ícone de alerta à esquerda (só em `falha`) + valor em negrito à direita | Portado |
| 6.6 | Destacado → fundo com 15% da cor do status no card inteiro | Portado |
| 6.7 | Lido → fundo `--surface-2`; só a barra e o texto do status seguem a cor | Portado |
| 6.8 | Borda esquerda de 3px na cor do status, sempre | Portado |
| 6.9 | Clique abre o painel; clique no já aberto fecha | Portado |
| 6.10 | Em modo de seleção, o clique marca/desmarca em vez de abrir o painel | Portado |
| 6.11 | Abrir um pedido consome o destaque (`highlighted = false`) | Portado |

## 7. Painel de detalhe (`renderPanel`)

| # | Bloco | Situação |
|---|---|---|
| 7.1 | Coluna fixa à direita (400px), lista continua visível | Portado |
| 7.2 | Cabeçalho: ícone de caixa + código em fonte grande + botão de copiar + X | Portado |
| 7.3 | Logo dos Correios | Portado com ajuste — o PNG embutido do axis-tracking vira ícone + "Correios" na linha de transportadora, para não carregar imagem de marca de terceiro no bundle |
| 7.4 | Pares label/valor: Cliente, Telefone, Endereço (3 linhas), Potes, Valor, Data do pedido | Portado |
| 7.5 | Card de status: borda na cor, ícone, nome do status, "Última atualização: há X" | Portado |
| 7.6 | Bloco condicional `falha`: borda vermelha, "Motivo da falha", motivo em texto grande e negrito | Portado |
| 7.7 | Bloco condicional `aguardando_retirada`: borda roxa, "Endereço para retirada", agência + endereço, "Disponível desde" e "Retirar até" | Portado |
| 7.8 | Sem `pickup` ainda: "Carregando endereço da agência na próxima atualização" | Portado |
| 7.9 | Demais status: bloco não aparece | Portado |
| 7.10 | Timeline vertical, mais recente no topo: marcador na cor do tipo, data/hora à esquerda, cidade/UF à direita, título em negrito, descrição secundária | Portado |
| 7.11 | Timeline vazia: "Sem eventos de rastreio ainda." | Portado com ajuste — o texto muda, já que aqui não há botão "Atualizar rastreios" que dependa dos Correios |
| 7.12 | Botão Arquivar no rodapé, largura total, contorno neutro que **fica vermelho no hover** | Portado |
| 7.13 | Em Arquivados vira "Desarquivar", sem o alerta vermelho | Portado |
| 7.14 | Em Arquivados, botão Excluir vermelho abaixo de Desarquivar, com confirmação | Removido — ver §12 |

## 8. Barra superior

Ordem: Adicionar pedido · filtro de status · Atualizar rastreios · ordenação ·
Importar CSV · Exportar CSV · Redefinir destacados · Arquivar/Excluir em massa.

| # | Controle | Situação |
|---|---|---|
| 8.1 | **Adicionar pedido** (modal código → Correios → formulário do cliente) | Removido — os pedidos vêm da autorização de envio |
| 8.2 | **Filtro por status**: "Todos os status" + as 7 chaves; vale nas duas abas | Portado |
| 8.3 | **Atualizar rastreios**: `POST /api/refresh`, uma requisição em lote | Portado com ajuste — simula a atualização sobre o mock |
| 8.4 | **Ordenação** segmentada: Atualização (padrão) / Criação | Portado |
| 8.5 | **Importar CSV** (`.xlsx`/`.csv` → revisão → gravação em lote) | Removido — os pedidos vêm da autorização de envio |
| 8.6 | **Exportar CSV**: visíveis, respeitando aba e filtro; `;`, BOM UTF-8; 12 colunas | Portado |
| 8.7 | **Redefinir destacados**: limpa `highlighted` de todos | Portado |
| 8.8 | **Arquivar em massa** (Em Trânsito) / **Excluir em massa** (Arquivados) | Portado só o arquivar — ver §12 |
| 8.9 | Modo de seleção: 1º clique liga as caixas, botão vira "Arquivar (N)", aparece **Cancelar** | Portado |
| 8.10 | Sem nada marcado, o botão de ação fica desabilitado | Portado |
| 8.11 | Trocar de aba cancela a seleção | Portado |
| 8.12 | Abas Em Trânsito / Arquivados com contador | Portado — como controle segmentado |

## 9. Atualização automática

| # | Comportamento | Situação |
|---|---|---|
| 9.1 | Ciclo a cada 60s (`AUTO_REFRESH_MS`), sem clique | Portado com ajuste — move o mock em vez de consultar os Correios |
| 9.2 | Pausa com a aba em segundo plano (`document.hidden`) | Portado |
| 9.3 | Pausa com modal aberto | Portado |
| 9.4 | Pausa com modo de seleção ligado (repintar perderia a seleção) | Portado |
| 9.5 | Dispara ao voltar para a aba | Portado |
| 9.6 | Sem novidade não repinta a tela | Portado |
| 9.7 | Dois ciclos não se sobrepõem (`refreshing`) | Portado |
| 9.8 | Botão gira (`spinning`) enquanto atualiza | Portado |
| 9.9 | Toasts: "N rastreio(s) atualizado(s)" · "Nenhuma novidade nos rastreios" · modo degradado | Portado com ajuste — o de modo degradado vira aviso de que a atualização é simulada |

## 10. Cópia inteligente (`copySummary`)

Monta a mensagem pronta para o WhatsApp, sempre com data/hora absoluta.

| # | Status | Conteúdo | Situação |
|---|---|---|---|
| 10.1 | `aguardando_retirada` | Saudação com o primeiro nome, destinatário, código, "Disponível desde", "Retirar até", agência + endereço, aviso de levar código e documento com foto | Portado |
| 10.2 | `saiu_para_entrega` | Código, status, "Saiu para entrega em", "É necessário ter alguém em casa para receber o pedido." | Portado |
| 10.3 | `entregue` | Código, status, "Entregue em" | Portado |
| 10.4 | `falha` | Código, status, "Motivo da falha" | Portado |
| 10.5 | demais | Código, status, "Última atualização" | Portado |
| 10.6 | Toast "Resumo copiado" / "Não foi possível copiar" | Portado |

## 11. Alertas, toasts e confirmações

| # | Mensagem | Situação |
|---|---|---|
| 11.1 | "Pedido movido para Arquivados" / "Pedido movido para Em Trânsito" | Portado |
| 11.2 | "N pedido(s) movido(s) para Arquivados" | Portado |
| 11.3 | "Destaques redefinidos" | Portado |
| 11.4 | "CSV exportado" | Portado |
| 11.5 | "Resumo copiado" | Portado |
| 11.6 | "N rastreio(s) atualizado(s)" / "Nenhuma novidade nos rastreios" | Portado |
| 11.7 | Falhas de rede ("Falha ao arquivar: …") | Removido — não há rede nesta fase |
| 11.8 | `confirmDialog` com lista dos pedidos afetados | Portado com ajuste — no original só a **exclusão** em massa confirmava; como a exclusão saiu (§12), a confirmação passou para o arquivamento em massa, que é a ação de maior alcance que sobrou |
| 11.9 | Fechar modal por Escape, X ou clique fora conta como "não" | Portado |
| 11.10 | Bloco de alerta do motivo da falha: "precisa ser a informação mais fácil de achar na tela inteira" | Portado |

## 12. Exclusão — o que muda e por quê

No axis-tracking o banco de rastreio é a fonte de verdade e existe uma trava:
`DELETE ... AND archived = TRUE`, mais uma limpeza automática que apaga
arquivados com mais de 7 dias.

No sistema Axis o pedido é a fonte de verdade — ele tem valor, custo, comissão e
cobrança presos a ele. Apagar um pedido a partir da tela de Rastreio destruiria
o registro financeiro, não só o acompanhamento de entrega. Por isso:

- **Excluir** (individual, em massa e a limpeza de 7 dias) **não foi portado**.
- Tirar um pedido da lista de Rastreio é **arquivar**, que é manual e reversível,
  como pede a especificação da Fase 2.
- A exclusão de pedido continua existindo, com a permissão certa, em
  **Operação › Pedidos**, e só para o Admin.

## 13. Backend (fora do escopo desta fase)

| Rota | Situação |
|---|---|
| `GET /api/orders` | Substituído pelo `PedidosProvider` (mock em memória) |
| `POST /api/orders` | Removido junto com a inclusão manual |
| `PATCH /api/orders` | Vira ação do provider (arquivar, limpar destaque) |
| `DELETE /api/orders` | Removido — ver §12 |
| `POST /api/refresh` | Simulado no cliente |
| `GET /api/tracking/:codigo` | Não portado — entra na fase de backend |
| `POST /api/import` | Removido junto com a importação |
| `GET /api/cep/:cep` | Já existe como `src/lib/cep.ts` (simulado) |
| `GET /api/cleanup` | Removido — ver §12 |

`lib/correios.js` e `lib/normalize.js` ficam como referência de tipo:

- `mapEventType()` — mapa evento SRO → status. Reproduzido em
  `src/lib/rastreio/correios.ts`, inclusive a ordem das checagens (a negação
  "não entregue" antes de qualquer teste de entrega, e `FC/82` separado de
  `FC/03`).
- `pickupOf()` / `failureReasonOf()` — forma de `retirada` e de `motivoFalha`.
- `formatPhone()` — regra do nono dígito, incorporada a `formatTelefone`.

## 14. Convenções herdadas

| # | Convenção | Situação |
|---|---|---|
| 14.1 | Labels e mensagens em português do Brasil | Portado |
| 14.2 | Chaves de status em português com underscore | Portado |
| 14.3 | Código monoespaçado (`.mono`) | Portado |
| 14.4 | `fmtMoney` para valores, nunca `R$ ` concatenado | Portado |
| 14.5 | Nenhum `innerHTML` com dado de terceiros | Portado (React) |
| 14.6 | Identidade visual: Inter + JetBrains Mono, accent `#6c8dfa` | Removido — o sistema Axis usa Space Grotesk e a cor de destaque do usuário. **As cores de status não mudam** |

---

## 15. Conferência final

Migração feita em 16/09/2026. Todos os itens acima estão marcados.

Contagem: **Portado** em 78 itens · **Portado com ajuste** em 8 ·
**Removido** em 9 (inclusão manual, importação, exclusão e o backend, todos
com o motivo na própria linha).

Onde o resultado mora:

| Assunto | Arquivo |
|---|---|
| Contrato de dados | `src/lib/types/rastreio.ts` |
| Status, cores e ordem das seções | `src/lib/status.ts`, `src/app/globals.css` (`--rt-*`) |
| Filtro, ordenação e agrupamento | `src/lib/rastreio/lista.ts` |
| Cópia inteligente | `src/lib/rastreio/resumo.ts` |
| Exportação CSV | `src/lib/rastreio/csv.ts` |
| Mapa evento SRO → status | `src/lib/rastreio/correios.ts` |
| Atualização (simulada) | `src/lib/rastreio/simulacao.ts` |
| Card, painel e tela | `src/components/rastreio/`, `src/app/(app)/operacao/rastreio/page.tsx` |
| Arquivar, destaque e atualização | `src/lib/providers/pedidos.tsx` |

Pendente para a fase de backend: consulta real ao SRO (`getTracking` /
`getTrackingBatch`), que substitui `simulacao.ts` e ativa `correios.ts`.
