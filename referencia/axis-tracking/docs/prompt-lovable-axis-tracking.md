# Prompt para o Lovable — Axis Tracking (Front-end)

## Contexto

Estou construindo o **Axis Tracking**, um SaaS interno para acompanhar o status de entrega de pedidos enviados pelos Correios. Ele vai substituir um app desktop que eu usava (chamado "Rastreador de Encomendas"), que era ótimo pra visualizar rastreios mas não escalava — eu tinha que adicionar cada rastreio manualmente. O Axis Tracking vai puxar os pedidos automaticamente de outro sistema (Zentra) e consultar os Correios sozinho.

**Nesta etapa, quero construir só o front-end**, com dados fictícios (mock data) direto no código. Ainda não vamos integrar com nenhuma API externa nem banco de dados real — isso vem depois. O objetivo agora é fechar o layout, a navegação e as interações antes de plugar qualquer backend.

Quem vai usar: eu e minha esposa. Sem hierarquia de permissão — quem acessa, pode fazer tudo. Não precisa de tela de cadastro de usuário robusta; um login simples (ou nem isso, por enquanto) já resolve nesta etapa.

Já tenho um layout de referência exato (fiz um mockup e aprovei), descrito em detalhe abaixo. Siga essa estrutura à risca — não é uma inspiração livre, é o layout que eu quero.

---

## Estrutura geral da tela

Layout de **duas colunas fixas** (não é navegação entre telas — o painel de detalhe abre do lado direito, sobrepondo/dividindo o espaço, e a lista continua visível à esquerda):

- **Cabeçalho**: logo/ícone do produto + nome "Axis Tracking" no canto superior esquerdo. Ao lado, as abas de navegação: "Em Trânsito" e "Arquivados" (aba ativa com sublinhado/destaque).
- Abaixo do cabeçalho: título da seção atual (ex: "Em Trânsito") + contador de pedidos ao lado (ex: "128 pedidos", em formato de badge/pill).
- À direita dessa linha, alinhados horizontalmente: dropdown de filtro por status ("Todos os status"), botão **"Atualizar rastreios"** (ícone de refresh — dispara a consulta de status mais recente; nesta etapa sem backend, pode ser só visual/mock), botão **"Exportar CSV"** (ícone de download), botão **"Redefinir destacados"** (ícone de refresh/reset).
- **Lista de pedidos**: grid de 3 colunas (responsivo — menos colunas em telas estreitas) ocupando a coluna esquerda/central.
- **Painel de detalhe**: coluna fixa à direita, mais estreita que a lista, com fundo levemente diferente do resto (mais escuro/destacado), que só aparece preenchido quando um pedido é selecionado. Tem botão de fechar (X) no canto superior direito do painel.

---

## Direção visual

- Tema escuro. Fundo geral quase-preto neutro; cards e painel de detalhe num tom levemente mais claro que o fundo, pra criar hierarquia de camada.
- Cores de status em tons suaves/dessaturados (ver tabela), nunca em contraste forte tipo alerta de emergência.
- Tipografia sans-serif de boa legibilidade (Inter ou similar). Código de rastreio em fonte monoespaçada, pra facilitar leitura de caracteres alfanuméricos.
- É um painel operacional de alta densidade — não um site institucional. Priorize densidade de informação com respiro adequado, não espaçamento generoso "estilo marketing".

---

## Cards da lista (coluna esquerda)

Cada card representa um pedido, com os campos nesta ordem exata:

1. **Linha superior**: código de rastreio (fonte monoespaçada, em destaque) à esquerda; badge de status (pill colorida, cor conforme a tabela de status) à direita.
2. **Nome do cliente**, em negrito, linha própria.
3. **Linha com telefone** à esquerda e **tempo desde a última atualização** à direita (ex: "há 1h", "há 2d") — texto secundário, discreto.
4. **Endereço** em duas linhas: primeira linha com logradouro, número, bairro e cidade/UF; segunda linha com o CEP. Este é sempre o endereço de entrega do cliente (vindo do Zentra) — não confundir com o endereço de retirada dos Correios, que só aparece no painel de detalhe.
5. **Linha inferior**: se o status for **Falha**, mostrar à esquerda o motivo específico da falha com um ícone de alerta, em texto vermelho (ex: "⚠ Endereço insuficiente", "⚠ Carteiro não atendido", "⚠ Recusado pelo destinatário") — sempre visível direto no card, sem precisar abrir o pedido. Para qualquer outro status, essa área fica vazia. Em ambos os casos, o **valor do pedido** aparece em negrito, alinhado à direita.

### Cor de fundo dos cards

- Cada card carrega uma leve tonalidade de fundo relacionada à cor do seu status (ex: cards com Falha têm um fundo com leve tom avermelhado; os demais status seguem a mesma lógica com sua cor correspondente, sempre sutil).
- **Pedidos com atualização de status que eu ainda não vi** recebem um tom de destaque diferente e sutil no card inteiro (não um indicador pontual tipo bolinha ou badge separado — é o próprio card que muda de tom, de forma perceptível mas discreta, pra eu notar rapidamente ao escanear a lista). Esse destaque desaparece assim que eu abrir o pedido no painel de detalhe.

---

## Painel de detalhe (coluna direita)

Ao clicar em um card, o painel à direita é preenchido com:

1. **Cabeçalho do painel**: ícone de caixa/pacote (num quadrado com fundo colorido, ex: tom terracota/laranja suave) + código de rastreio em destaque, fonte grande. Ao lado do código, um **botão de copiar** (ícone de duas folhas sobrepostas). Botão de fechar (X) no canto superior direito do painel.
2. Logo abaixo: ícone pequeno dos Correios + nome da transportadora ("Correios").
3. **Bloco de dados do pedido**, em pares label/valor, alinhados (label à esquerda em cinza, valor à direita ou logo abaixo em branco):
   - Cliente
   - Telefone
   - Endereço (logradouro + número, bairro – cidade/UF, e CEP em linha própria)
   - Kit / Potes
   - Valor do pedido
   - Data do pedido
4. **Bloco de status atual**: card com borda na cor do status (ex: vermelha para Falha), ícone de alerta/status à esquerda, nome do status em destaque, e abaixo "Última atualização: há [tempo]" com a data/hora completa alinhada à direita.
5. **Bloco condicional, logo abaixo do bloco de status**:
   - Se o status for **Falha**: card com borda vermelha, ícone de alerta, label "Motivo da falha" em vermelho, e o motivo específico abaixo em texto branco/negrito, grande — precisa ser a informação mais fácil de encontrar na tela inteira.
   - Se o status for **Aguardando retirada**: mesmo formato de card, mas com borda/ícone na cor roxa do status, label "Endereço para retirada", e abaixo o nome da agência dos Correios + endereço completo da agência.
   - Para os demais status, esse bloco não aparece.
6. **"Histórico de eventos"**: título de seção, seguido de uma linha do tempo vertical (uma linha conectando os marcadores). Cada evento tem:
   - Um ícone circular colorido conforme o tipo de evento (mesma lógica de cores da tabela de status: vermelho para falha, laranja para saiu para entrega, azul para em transferência/postado, verde para entregue, roxo para aguardando retirada).
   - Data e hora à esquerda, cidade/UF à direita, na mesma linha.
   - Título do evento em negrito (ex: "Falha na entrega", "Saiu para entrega", "Em transferência para unidade de entrega", "Chegou à unidade de distribuição", "Postado").
   - Descrição/motivo abaixo, em texto secundário, quando houver.
   - Ordenado do mais recente (topo) para o mais antigo (base).
7. **Botão "Arquivar"**: fixo na parte inferior do painel, largura total, com ícone de arquivo. Fica com contorno neutro por padrão e **fica vermelho ao passar o mouse (hover)**, como sinal de alerta antes de confirmar — porque arquivar por engano pode custar dinheiro (perco o rastreio de um pedido que ainda pode precisar de cobrança). Se o pedido já estiver em "Arquivados", o botão vira "Desarquivar", sem o alerta vermelho no hover (ação sem risco).

### Botão de copiar — cópia inteligente

O botão de copiar ao lado do código de rastreio não copia só o código: ele monta e copia um **resumo pronto pra colar numa mensagem pro cliente**, incluindo:
- Código de rastreio;
- Status atual;
- Se o status for "Aguardando retirada": o endereço da agência dos Correios;
- Se o status for "Falha": o motivo da falha;
- Para os demais status, uma linha simples com o status e a última atualização.

O objetivo é eu conseguir copiar e colar direto numa conversa de WhatsApp com o lead, sem precisar montar a mensagem manualmente.

---

## Paleta de status

| Status | Cor | Quando se aplica |
|---|---|---|
| Aguardando postagem | Cinza | Pedido confirmado, ainda sem primeiro evento de rastreio |
| Em rota / Em transferência | Azul | Qualquer movimentação entre unidades, antes de sair pra entrega final |
| Saiu para entrega | Laranja | Objeto em rota de entrega final |
| Entregue | Verde | Entrega confirmada |
| Aguardando retirada | Roxo | Objeto disponível numa agência, cliente precisa buscar |
| Falha | Vermelho | Qualquer motivo de insucesso: carteiro não atendido, endereço insuficiente, cliente não reconhecido, recusado, etc. — **motivo específico sempre visível, no card e no painel de detalhe, nunca só a etiqueta genérica "Falha"** |

Todas em tom suave/dessaturado — nada de cor "neon" ou de alto contraste. Essas mesmas cores valem tanto para os badges dos cards, quanto para o fundo sutil dos cards, quanto para os ícones da linha do tempo no painel de detalhe.

---

## Ordenação e destaque de novidades

- Ordenação padrão da lista: **evento mais recente primeiro**.
- Pedidos com mudança de status ainda não vista recebem o tom de destaque no card (ver seção "Cor de fundo dos cards" acima).
- Ao abrir o pedido no painel de detalhe, o destaque desse pedido é removido automaticamente.
- O botão "Redefinir destacados" na barra superior limpa o destaque de todos de uma vez, sem precisar abrir um por um.

---

## Filtros e atualização

- Filtro por **status** (os 6 da tabela acima, dropdown "Todos os status"), aplicável tanto em "Em Trânsito" quanto em "Arquivados".
- Botão **"Atualizar rastreios"**: nesta etapa, sem backend real, pode simular uma atualização (ex: pequeno estado de carregamento) — a função real de consultar os Correios vem na etapa de integração.
- Estrutura para adicionar mais filtros depois (nome, código, período) sem precisar redesenhar — mas por enquanto só implementar o de status.

---

## Exportar CSV

- Botão "Exportar CSV" na barra superior, exporta os pedidos visíveis (respeitando o filtro aplicado) com todos os campos: código de rastreio, nome, telefone, endereço, kit, valor, status atual, motivo da falha (se houver), endereço de retirada (se houver), data do pedido, última atualização.
- Nesta etapa (sem backend), pode gerar o CSV a partir dos dados mock, mesma lógica que será usada depois com dados reais.

---

## Dados de exemplo (mock data)

Popule com uns 15-20 pedidos fictícios cobrindo todos os status da tabela, incluindo pelo menos:
- 3-4 pedidos com "Aguardando retirada" (com nome da agência + endereço completo preenchidos, pra testar o bloco condicional e a cópia inteligente)
- 3-4 pedidos com "Falha" (motivos variados: carteiro não atendido, endereço insuficiente, cliente não reconhecido, recusado pelo destinatário)
- Alguns marcados como destacados (atualização não vista) e outros não, pra validar a diferença de tom no card
- Pelo menos 1 pedido já em "Arquivados"
- Cada pedido com histórico de eventos (2 a 5 eventos), pra popular a linha do tempo no painel de detalhe

Use nomes, telefones e endereços brasileiros fictícios, valores condizentes com kits de suplemento (entre R$ 300 e R$ 700), e códigos de rastreio no formato dos Correios (ex: `AA123456789BR`).

---

## Fora do escopo nesta etapa

- Nenhuma chamada a API externa (Correios, Zentra) — tudo com mock data.
- Nenhum sistema de permissões por usuário.
- Nenhuma aba "Via Web" ou "Adicionar rastreio manual".
- Nenhuma lógica de retenção/limpeza automática de dados arquivados (isso é regra de backend, vem depois).
- Botão "Atualizar rastreios" pode ser só visual nesta etapa — sem consulta real.
