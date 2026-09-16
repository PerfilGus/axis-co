# Axis Tracking — Instruções do Projeto

> Contexto detalhado do produto (layout aprovado, decisões de UX, escopo original):
> [docs/prompt-lovable-axis-tracking.md](docs/prompt-lovable-axis-tracking.md).
> Consulte esse arquivo quando precisar de mais profundidade do que está aqui.
> Ele foi escrito para o Lovable. Onde os dois divergirem, este arquivo vence.

---

## 1. O que é

SaaS interno para acompanhar o status de entrega de pedidos enviados pelos Correios.
Substitui um app desktop ("Rastreador de Encomendas") que era bom para visualizar
rastreios mas não escalava — cada código tinha que ser adicionado à mão.

O Axis Tracking vai puxar os pedidos automaticamente do **Zentra** e consultar os
**Correios** sozinho.

**Usuários:** duas pessoas (eu e minha esposa). Sem hierarquia de permissão — quem
acessa, pode tudo. Não projete telas de gestão de usuários, papéis ou convites.

**Natureza da interface:** painel operacional de alta densidade, não site
institucional. Priorize densidade de informação com respiro adequado — nunca
espaçamento generoso "estilo marketing".

---

## 2. Estado atual

**Etapa 2 — app full-stack, hospedado na Vercel.** Os pedidos são **incluídos
manualmente** (um a um ou importando o `.xlsx` do Zentra) e persistem em Postgres
(Neon). A integração automática com o Zentra é a etapa seguinte.

Implementado e aprovado visualmente (o layout **não muda** sem pedido explícito):

- Lista com abas Em Trânsito / Arquivados, agrupada em seções por status
- Painel de detalhe lateral com dados do pedido, bloco condicional e timeline
- Filtro por status, ordenação (atualização / criação), export CSV
- Cópia inteligente do resumo, arquivar/desarquivar, redefinir destacados
- Toasts de confirmação
- **Adicionar pedido** (modal: código de rastreio → consulta Correios → formulário
  do cliente) e **Importar planilha** (`.xlsx` → revisão → gravação em lote)

Regras de negócio da base: incluir um pedido **nunca** remove nem sobrescreve os
anteriores; um pedido só sai de *Em Trânsito* ao clicar em **Arquivar**; reload e
*Redefinir destacados* não apagam nada.

---

## 3. Estrutura de pastas

```
AxisTracking/
├─ CLAUDE.md          # este arquivo
├─ README.md          # como rodar, e o passo a passo de deploy
├─ index.html         # o frontend inteiro (HTML + CSS + JS + assets embutidos)
├─ package.json       # deps do BACKEND (@neondatabase/serverless, xlsx)
├─ .env.example       # variáveis de ambiente necessárias
├─ schema.sql         # estrutura da tabela orders (referência)
├─ api/               # funções serverless da Vercel
│  ├─ orders.js       #   GET/POST/PATCH — CRUD no banco
│  ├─ import.js       #   POST — recebe o .xlsx cru, devolve pedidos normalizados
│  ├─ refresh.js      #   POST — atualiza todos os rastreios em lote
│  └─ tracking/[codigo].js  # GET — proxy da API Rastro dos Correios
├─ lib/
│  ├─ db.js           # acesso ao Postgres (Neon) + criação do schema
│  ├─ normalize.js    # planilha Zentra (.xlsx) → lista de pedidos
│  └─ correios.js     # token + consulta de rastro; modo degradado sem credenciais
├─ assets/  brand/ (logos)  ·  carriers/ (correios-seeklogo.png)
├─ docs/    prompt-lovable-axis-tracking.md   # spec original do produto
└─ tools/   embed-assets.ps1                   # embute os PNGs no index.html
```

Ao criar arquivos novos, respeite essa divisão (frontend na raiz, backend em
`api/` e `lib/`) em vez de despejar na raiz.

---

## 4. Stack e regras de arquitetura

**Frontend** (`index.html`):

- **HTML + CSS + JavaScript puros.** Sem framework, sem bundler, sem build step.
  Continua sendo **um único arquivo**. Ícones são SVG inline no objeto `ICONS` —
  não adicione biblioteca de ícones. Imagens embutidas como data URI.
- **Sem dependência no navegador.** A única coisa externa é o Google Fonts via
  `<link>`. Não carregue lib de terceiros no cliente (nem via CDN) — se algo
  precisa de biblioteca (ler `.xlsx`, falar com os Correios), isso vive no
  backend.
- Não abre mais por `file://` — depende de `/api/*`. Para rodar local:
  `vercel dev` (ver README).

**Backend** (`api/` + `lib/`):

- Funções serverless da Vercel, Node ESM (`"type": "module"`). Dependências de
  backend são permitidas e ficam no `package.json`: hoje `@neondatabase/serverless`
  (Postgres) e `xlsx` (SheetJS, só no servidor).
- Banco: Postgres Neon (integração nativa da Vercel). Conexão via
  `DATABASE_URL`/`POSTGRES_URL`. `lib/db.js` cria o schema sozinho no primeiro
  acesso.
- Segredos (credenciais Correios) **só** em variáveis de ambiente da Vercel,
  nunca no repositório nem no frontend.

**Antes de trocar de banco, adicionar framework/bundler ao frontend, ou mudar o
modelo de deploy, pergunte.**

### Organização interna do index.html

O arquivo é dividido por comentários-marcador, nesta ordem:

1. `<style>` — variáveis CSS em `:root`, depois shell, layout, seções, card,
   painel, **modais**
2. `ICONS` — paths SVG inline + helper `icon(name, cls)`
3. `ASSETS` — bloco **gerado** pelo `embed-assets.ps1` (não edite à mão)
4. `STATUS` / `SECTION_ORDER` — config de status e ordem das seções
5. `orders` — array vazio; populado por `loadOrders()` a partir de `/api/orders`
6. `state` — `{ tab, filter, sort, selectedId }`
7. helpers → render (`renderGrid`, `buildCard`, `renderPanel`) → ações →
   **cliente da API (`api.*`, `loadOrders`)** → **modais (adicionar / importar)** →
   `initToolbar`

Ao adicionar código, coloque-o na seção correspondente em vez de anexar no fim.

### Assets

Depois de trocar `assets/brand/axis-logo-icon.png` ou
`assets/carriers/correios-seeklogo.png`, rode:

```bash
powershell -ExecutionPolicy Bypass -File .\tools\embed-assets.ps1
```

Cuidados com esse script:

- Ele é **ASCII de propósito**. O Windows PowerShell 5.1 lê `.ps1` sem BOM como
  ANSI, e qualquer acento ou travessão vira lixo nos marcadores. Não coloque
  caracteres acentuados nele.
- Ele substitui só o intervalo entre os marcadores `INICIO`/`FIM` e aborta se
  `const STATUS`, `const SECTION_ORDER`, `const ASSETS` ou `function renderGrid`
  sumirem do `index.html`. Se renomear alguma dessas coisas, atualize as travas.
- É idempotente: rodar duas vezes seguidas produz o mesmo arquivo.

---

## 5. Modelo de dados

Formato de um pedido em `orders` — é o contrato que a integração Zentra +
Correios vai ter que preencher. Mantenha os nomes de campo ao evoluir:

```js
{
  id: 1,
  code: 'AA123456789BR',             // formato Correios
  name: 'Gabriel Souza Lima',
  phone: '(11) 98765-4321',
  address: { street, district, city, uf, cep },  // endereço de ENTREGA do cliente
  pots: 6,                           // quantidade de potes (inteiro) ou null
  value: 459.90,                     // número, não string
  orderDate: '2026-05-12T14:32:00.000Z',    // timestamp ISO 8601, direto de new Date()
  status: 'falha',                   // chave de STATUS
  failureReason: 'Endereço insuficiente',   // só quando status === 'falha'
  pickup: { agency, address, availableAt, deadline },  // só quando status === 'aguardando_retirada'
                                     // vem do evento LDI (unidade.endereco, dtLimiteRetirada) em lib/correios.js
  archived: false,
  archivedAt: null,                  // ISO de quando foi arquivado; null em trânsito
  highlighted: true,                 // atualização ainda não vista
  events: [                          // mais recente primeiro
    { at: '2026-05-15T09:18:00.000Z', title, desc, city: 'São Paulo/SP', type: 'falha' }
  ]
}
```

Notas:

- `address` é o endereço de entrega do cliente. Não confunda com `pickup.address`,
  que é a agência dos Correios e só aparece no painel de detalhe. **Pode vir
  vazio** em pedido importado da planilha (o `.xlsx` do Zentra não traz endereço);
  a UI mostra "Endereço não informado" e o campo pode ser completado depois.
- **Não existe campo `lastUpdate`.** A última atualização é `events[0].at` (a
  timeline é mantida mais-recente-primeiro). Use **sempre** o helper
  `lastUpdateAt(o)` — pedido recém-cadastrado ainda **sem eventos** cai em
  `orderDate`, e o helper já trata isso. Nunca acesse `o.events[0]` direto sem
  checar `o.events.length`.
- `orderDate` pode ser `null` (importação sem data válida). `fmtDateTime`/
  `fmtRelative` já devolvem `'—'` nesse caso.
- **Não existe mais campo `kit`.** O pedido é de X potes; `pots` (inteiro) é a
  única informação — sem string de "kit". Exibido como "N potes" no painel, CSV
  e revisão de importação; `null` vira `—`.
- `orderDate` e `events[].at` são timestamps de verdade (ISO 8601, o que
  `new Date().toISOString()` produz), nunca string formatada nem parseada por
  regex. Exibição é responsabilidade de três formatadores em `helpers`:
  `fmtDateTime()` (`dd/mm/aaaa hh:mm`, painel e CSV), `fmtEventDateTime()`
  (`dd/mm hh:mm`, timeline) e `fmtRelative()` (`há Xmin/Xh/Xd`, card, painel,
  cópia inteligente e CSV). `orderTimestamp()`/`minutesAgo()` também operam
  direto em `Date`, sem parser.

### Origem dos dados

Não há mais mock. O frontend chama `/api/orders` (GET) no load; o banco é a fonte
de verdade. Persistência no formato da tabela `orders` (ver `schema.sql`), mapeada
de/para o formato acima em `lib/db.js` (`rowToOrder`).

**Adicionar pedido** (`openAddOrder` → `findCodeThenForm` → `renderAddForm` →
`saveNewOrder`): valida o código (`^[A-Z]{2}\d{9}[A-Z]{2}$`), consulta
`/api/tracking/:codigo`, e monta o pedido com o formulário. Sem eventos dos
Correios, entra como `aguardando_postagem` com `events: []`.
- **CEP**: ao ter 8 dígitos, `renderAddForm` chama `/api/cep/:cep` (ViaCEP no
  servidor) e preenche logradouro/bairro/cidade/UF **só se estiverem vazios** —
  nunca sobrescreve o que foi digitado.
- **Telefone**: `formatPhoneBR()` normaliza para `(00) 90000-0000` no blur/paste
  e no submit; 10 dígitos (celular sem o 9) vira 11 inserindo o 9 após o DDD.
  Mesma regra em `lib/normalize.js` (`formatPhone`) para a importação.

**Importar planilha** (`openImport` → `handleImportFile` → `renderImportReview` →
`doImport`): o arquivo cru (`.csv` ou `.xlsx` — SheetJS lê os dois) vai para
`/api/import`, que roda `lib/normalize.js` no servidor. Regras da planilha Zentra:
colunas `Data | Nome | Contato | Kit | Valor | Pagamento | Status pedido | Cód.
Rastreio | Observações`; `Pagamento` e `Status pedido` são ignorados; a coluna
`Kit` vem como "X meses" → o número X vira `pots` (1 pote por mês); linha que só
tem "🚚 Envio SEDEX" (pertence à linha de
cima) é descartada; linha sem código de rastreio válido não é importada (aparece
como aviso na revisão). `Data` vem sem ano — a tela de revisão tem um seletor de
ano (`orderDateRaw` guarda o "dd/mm" cru para recompor). Duplicatas (código já no
banco) são marcadas e não reimportadas — `POST /api/orders` também barra no
servidor (constraint `UNIQUE(code)`).

---

## 6. Paleta de status

| Chave | Label | Cor | Quando se aplica |
|---|---|---|---|
| `aguardando_postagem` | Aguardando postagem | cinza `#6e6e7a` | Confirmado, sem primeiro evento |
| `postado` | Postado | cinza `#8a8a94` | Primeiro evento registrado |
| `em_transferencia` | Em transferência | azul `#4a90f2` | Movimentação entre unidades |
| `saiu_para_entrega` | Saiu para entrega | laranja `#f2994a` | Rota de entrega final |
| `entregue` | Entregue | verde `#3fb968` | Entrega confirmada |
| `aguardando_retirada` | Aguardando retirada | roxo `#9b7bf0` | Disponível em agência |
| `falha` | Falha | vermelho `#e5484d` | Qualquer insucesso de entrega |

**Regras de cor:**

- Tons suaves e dessaturados. Nada de neon ou contraste "alerta de emergência".
- A mesma cor serve badge do card, fundo sutil do card, borda esquerda, ícone da
  timeline e ponto da seção. Status novo entra em `STATUS` e propaga sozinho.
- Opacidades em uso: `0.15` fundo de card destacado, `0.18` fundo de badge,
  `0.4` borda de badge, `0.08` fundo de bloco de alerta, `0.35` sua borda.
  Use o helper `hexToRgba()` — não escreva `rgba()` na mão.
- Tema escuro apenas. Não existe tema claro e não é para inventar um.

---

## 7. Regras de UI

### Lista

Grid responsivo (`auto-fill, minmax(280px, 1fr)`) agrupado em seções. Ordem:

1. **"Atualizações Recentes"** — todos os `highlighted`, independente do status,
   no topo, com ponto na cor de accent.
2. Depois, uma seção por status, na ordem de `SECTION_ORDER`:
   entregue → saiu para entrega → falha → aguardando retirada → em transferência
   → postado → aguardando postagem.

Cada seção tem ponto colorido, título, contador e régua até a borda.

### Card

Campos, nesta ordem exata:

1. Código de rastreio (monoespaçado, em destaque) à esquerda + badge de status à direita
2. Nome do cliente, negrito, linha própria
3. Telefone à esquerda + tempo desde a última atualização à direita (texto discreto)
4. **Último evento dos Correios** (`events[0].title`, até 2 linhas) — no lugar
   do endereço, que a planilha não traz. Sem eventos: "Sem eventos de rastreio".
   O endereço continua no painel de detalhe e no CSV.
5. Linha inferior: se `falha`, motivo específico com ícone de alerta em vermelho,
   à esquerda — **sempre visível no card, nunca só o rótulo genérico "Falha"**.
   Para outros status a área fica vazia. Valor do pedido em negrito à direita.

Fundo do card:

- **Destacado** (`highlighted`, atualização não vista): leve tom da cor do status
  (15%). Perceptível ao escanear a lista, mas discreto — é o card inteiro que muda
  de tom, **não** um badge ou bolinha separada.
- **Lido**: fundo cinza neutro (`--surface-2`); só a barra lateral e o texto do
  status seguem a cor.
- Borda esquerda de 3px na cor do status, sempre.

### Painel de detalhe

Coluna fixa à direita, mais estreita que a lista, fundo levemente destacado.
A lista continua visível — não é navegação entre telas. Conteúdo:

1. **Cabeçalho**: ícone de caixa em quadrado colorido + código em fonte grande +
   botão de copiar. Botão X no canto superior direito.
2. Ícone dos Correios + "Correios".
3. **Dados do pedido** em pares label/valor: Cliente, Telefone, Endereço
   (logradouro, bairro – cidade/UF, CEP em linha própria), Potes,
   Valor do pedido, Data do pedido.
4. **Status atual**: card com borda na cor do status, ícone, nome do status em
   destaque, "Última atualização: há [tempo]".
5. **Bloco condicional** (logo abaixo do status):
   - `falha` → borda vermelha, label "Motivo da falha", motivo em texto grande e
     negrito. **Precisa ser a informação mais fácil de achar na tela inteira.**
   - `aguardando_retirada` → borda roxa, label "Endereço para retirada", nome da
     agência + endereço completo.
   - Demais status → o bloco não aparece.
6. **Histórico de eventos**: timeline vertical, mais recente no topo. Cada evento
   tem marcador circular na cor do tipo, data/hora à esquerda, cidade/UF à
   direita, título em negrito e descrição secundária quando houver.
7. **Botão Arquivar**: fixo no rodapé do painel, largura total. Contorno neutro
   por padrão, **fica vermelho no hover** — arquivar por engano custa dinheiro
   (perde-se o rastreio de um pedido que ainda pode precisar de cobrança).
   Em Arquivados vira "Desarquivar", sem o alerta vermelho (ação sem risco).

Interações: clicar num card abre o painel e limpa o destaque daquele pedido;
clicar de novo no mesmo card fecha o painel.

---

## 8. Funcionalidades da barra superior

Ordem na tela (esquerda → direita): **Adicionar pedido** · filtro de status ·
**Atualizar rastreios** · ordenação (Atualização/Criação) · **Importar CSV**
(ícone seta ↓) · **Exportar CSV** (ícone seta ↑) · **Redefinir destacados**.

- **Ordenação** (segmentado): "Atualização" (evento mais recente primeiro, padrão)
  ou "Criação" (pedido mais recente primeiro).
- **Filtro por status**: dropdown "Todos os status" + os 7 status. Vale nas duas
  abas. A estrutura deve aceitar filtros novos (nome, código, período) sem
  redesenho — mas **só o de status está no escopo agora**.
- **Atualizar rastreios**: chama `POST /api/refresh` — **uma** requisição. O
  servidor consulta os Correios em lote (`getTrackingBatch`, até 50 códigos por
  chamada), grava status/eventos novos e re-destaca (`highlighted`) o que mudou.
  Só grava quem de fato mudou. Sem credenciais configuradas, responde *modo
  degradado* (toast avisando; nenhum evento é alterado).
- **Ciclo automático**: o mesmo `/api/refresh` roda sozinho a cada **1 minuto**
  (`AUTO_REFRESH_MS`), sem clique. Pausa com a aba em segundo plano
  (`document.hidden`) ou modal aberto, e dispara ao voltar para a aba. Sem
  novidade não repinta a tela — o ciclo não pode mexer no scroll de quem está
  lendo a lista. O lote é o que torna esse intervalo viável: 1 requisição por
  ciclo aos Correios em vez de uma por pedido.
- **Adicionar pedido** / **Importar planilha**: ver §5, "Origem dos dados".
- **Exportar CSV**: exporta os pedidos visíveis, respeitando aba e filtro.
  Separador `;`, BOM UTF-8 (Excel pt-BR), campos: código, nome, telefone,
  endereço, CEP, potes, valor, status, motivo da falha, endereço de retirada,
  data do pedido, última atualização.
- **Redefinir destacados**: limpa `highlighted` de todos de uma vez, sem precisar
  abrir um por um.
- **Arquivar / Excluir em massa** (botão logo depois de *Redefinir destacados*):
  o mesmo botão muda de função conforme a aba — **Arquivar** em Em Trânsito,
  **Excluir** (vermelho) em Arquivados. O primeiro clique liga o modo de seleção:
  os cards ganham caixa de marcação e passam a marcar/desmarcar em vez de abrir
  o painel; o botão vira "Arquivar (N)" e um **Cancelar** aparece ao lado.
  Excluir pede confirmação listando os pedidos. Trocar de aba cancela a seleção,
  e o ciclo automático não repinta enquanto ela está ativa.

### Exclusão — regra que não se negocia

**Só pedido arquivado pode ser excluído.** Nada que esteja em Em Trânsito é
apagado em hipótese alguma, incluindo os entregues — entregue só sai da lista
quando alguém clica em Arquivar.

A garantia não mora na UI, e sim no `DELETE ... AND archived = TRUE` de
`deleteOrders()`/`purgeArchived()` (`lib/db.js`): mesmo uma requisição forjada
com id de pedido em trânsito não apaga nada. Ao esconder um botão de excluir na
tela, mantenha a trava do SQL.

- No painel de detalhe, em Arquivados, há um **Excluir** vermelho abaixo de
  Desarquivar, com confirmação ("Deseja realmente excluir esse pedido?").
- A **limpeza automática** (`/api/cleanup`, Cron 1x/dia) apaga arquivados com
  mais de **7 dias**, contados de `archived_at` — carimbado ao arquivar e zerado
  ao desarquivar, para o prazo recomeçar do zero.

### Cópia inteligente

O botão de copiar ao lado do código **não copia só o código** — monta um resumo
pronto para colar no WhatsApp do cliente:

Cada status tem sua mensagem (`copySummary`), sempre com data/hora absoluta
(`fmtDateTime`), nunca "há Xh":

- `aguardando_retirada` (a mais importante) → saudação com o primeiro nome,
  destinatário, código, "Disponível desde", "Retirar até" (prazo dos Correios),
  agência + endereço, e o aviso de levar código e documento com foto.
- `saiu_para_entrega` → código, status, "Saiu para entrega em" + "É necessário
  ter alguém em casa para receber o pedido."
- `entregue` → código, status, "Entregue em".
- `falha` → código, status, "Motivo da falha".
- demais → código, status, "Última atualização".

O objetivo é colar direto na conversa, sem montar a mensagem à mão.

---

## 9. Convenções de código

- Comentários, labels de UI e mensagens em **português do Brasil**.
- Identificadores em inglês (`orders`, `renderGrid`, `highlighted`); chaves de
  status em português com underscore (`aguardando_retirada`).
- Comentários explicam **o porquê**, não o que a linha faz. Siga a densidade que
  já existe no arquivo: comentário-marcador de seção, e nota curta onde a decisão
  não é óbvia.
- Formatação: `fmtMoney()` para valores (`toLocaleString` pt-BR/BRL). Nada de
  `R$ ` concatenado na mão.
- Sem `innerHTML` com dado fora do controle do app. Os campos vêm de terceiros
  (Correios, digitação, planilha) — passe por `esc()` (helper em `helpers`) ou
  use `textContent`. Valores numéricos/formatados (`fmtMoney`, `icon`) não
  precisam.
- Backend: Node ESM, `import`/`export`. Erros nas funções retornam JSON
  `{ error }` com status adequado e `console.error` para o log da Vercel — nunca
  vaze stack trace ou credencial na resposta.

---

## 10. Fora de escopo (etapa atual)

Não implemente sem pedido explícito:

- Integração automática com o Zentra — por enquanto **tudo é entrada manual**
  (Adicionar pedido / Importar planilha)
- Autenticação, cadastro de usuário, permissões
- Aba "Via Web"
- Editar um pedido já cadastrado pela UI (só inclusão, arquivar/desarquivar e excluir)
- Tema claro, i18n, layout mobile dedicado

---

## 11. Próximos passos previstos

1. **Credenciais dos Correios** — quando o contrato/API Rastro estiver liberado,
   preencher as env vars na Vercel (`.env.example`) e conferir o mapa evento→status
   em `lib/correios.js` (`mapEventType`) contra dados reais.
2. **Integração com o Zentra** — puxar pedidos automaticamente em vez da planilha;
   `lib/normalize.js` e o fluxo de importação viram referência do mapeamento.
3. Editar/excluir pedido pela UI, se a operação pedir.

---

## 12. API (referência rápida)

| Rota | Método | O quê |
|---|---|---|
| `/api/orders` | GET | lista todos os pedidos |
| `/api/orders` | POST `{...order}` ou `{orders:[...]}` | inclui um ou vários; código repetido volta em `duplicates`, nunca sobrescreve |
| `/api/orders` | POST `{action:'reset-highlights'}` | zera `highlighted` de todos |
| `/api/orders` | POST `{action:'archive', ids, archived}` | arquiva/desarquiva vários de uma vez |
| `/api/orders` | PATCH `{id, ...campos}` | atualiza (arquivar, status, eventos) |
| `/api/orders` | DELETE `{ids:[...]}` | exclui de vez; o SQL só apaga `archived = TRUE`, devolve `refused` para o resto |
| `/api/cleanup` | GET (Cron, 1x/dia) | apaga arquivados com mais de 7 dias; exige `CRON_SECRET` |
| `/api/import?ano=AAAA` | POST (corpo = bytes do `.xlsx`) | devolve `{rows, skipped, ignored, year}` — **não grava** |
| `/api/tracking/:codigo` | GET | rastro de **um** código; `{degraded:true}` sem credenciais |
| `/api/refresh` | POST | consulta **todos** os não arquivados em lote, grava o que mudou, devolve `{updated, checked, orders}` |
| `/api/cep/:cep` | GET | endereço por CEP (ViaCEP); trocável pela API CEP dos Correios depois |

---

## 13. Pendências conhecidas

- `docs/prompt-lovable-axis-tracking.md` descreve grid plano, sem seções por
  status nem toggle de ordenação, e ainda fala em single-file `file://` — o
  código e este arquivo são a referência correta.
- Mapa evento→status dos Correios (`lib/correios.js`) foi calibrado contra os
  eventos reais do contrato: `FC/82` (etiqueta emitida → aguardando postagem),
  `FC/03` (correção de rota), `PO/01`, `PO/09`, `DO/01`, `RO/01`, e o insucesso
  "Objeto não entregue - {motivo}" (→ `falha`; o motivo sai do título, depois
  do " - "). Atenção: "não entregue" contém "entregue" — a negação é checada
  antes de qualquer teste de entrega. Retirada em agência ainda vem dos
  exemplos do manual.
- **O projeto está no plano Hobby da Vercel**, que aceita no máximo 2 crons e
  **só em cadência diária**. Por isso `vercel.json` tem `0 9 * * *` (refresh) e
  `0 4 * * *` (limpeza), e não algo mais frequente — um `*/10 * * * *` faz a
  Vercel **recusar o deploy inteiro**, sem gerar build (foi o que aconteceu na
  primeira tentativa). Se o projeto virar Pro, o refresh pode ir para `*/10`.
- Consequência prática: a atualização de 1 em 1 minuto roda **no navegador**,
  ou seja, só enquanto alguém tem o app aberto. O servidor sozinho atualiza
  1x/dia. Os dados em si estão sempre online (Vercel + Neon) — o que depende de
  alguém aberto é a frequência da consulta aos Correios, não o acesso.
- A limpeza dos 7 dias depende do Cron estar ativo. Se o cron não rodar, nada é
  apagado — o app nunca apaga sozinho pelo navegador, de propósito.
- Import: endereço fica vazio (a planilha não traz) — o CEP no cadastro manual
  puxa via `/api/cep`, mas na importação não há CEP. Pode exigir tratamento
  melhor quando o Zentra for integrado.
