# Resumo da sessão — 06/09/2026

Registro do que foi decidido e construído nesta conversa com o Claude Code,
do pedido inicial até o commit `a837334`. (Commits a partir de `e1685fe`,
datados de 12/09, foram feitos em outra sessão — ver nota no final.)

---

## 1. Pedido inicial

O usuário anexou uma planilha de exemplo do Zentra (`ZENTRA_Pedidos_0907_a_0609.xlsx`,
só para entender a estrutura — nenhum cliente dela deveria ser importado de
verdade) e o manual de integração da API dos Correios, e pediu:

- Todo pedido no Axis Tracking passaria a ser incluído **manualmente**.
- Botão **"Adicionar pedido"**: pede primeiro o código de rastreio, consulta os
  Correios, depois abre um formulário com os dados do cliente (nome, telefone,
  endereço, kit/potes/valor, data do pedido).
- Botão **"Importar CSV"**: importa a planilha do Zentra em lote (campos:
  data, nome, contato, kit, valor, código de rastreio; forma de pagamento e
  status do pedido são ignorados; linhas que só dizem "🚚 Envio SEDEX" pertencem
  à linha anterior e não contam).

Isso esbarrava de frente no `CLAUDE.md` da época (app "Etapa 1": só front-end,
mock data, zero dependência, sem API externa, sem persistência, sem rastreio
manual). Por isso, antes de programar, foram levantadas três decisões de
arquitetura com o usuário.

## 2. Decisões tomadas

**Rastreio dos Correios não funciona a partir de um `index.html` aberto por
duplo clique** — a API exige token gerado com credenciais de contrato e
bloqueia CORS de navegador. Diante disso:

| Pergunta | Resposta do usuário |
|---|---|
| Como tratar o rastreio real dos Correios? | Criar um servidor, subir o projeto no GitHub e hospedar (Vercel, plano grátis) |
| Como importar o `.xlsx` (formato zipado, sem lib no navegador)? | Um conversor: o usuário anexa o `.xlsx`, o Claude/servidor converte |
| Persistir os pedidos entre reloads? | Sim — banco de verdade. Incluir nunca apaga; só arquivar tira da lista; reload e "redefinir destacados" não apagam nada |
| Banco de dados | Vercel Postgres (Neon), plano grátis |
| Credenciais dos Correios | Ainda não tinha — rastreio ficaria em **modo degradado** até serem configuradas |

Isso levou o projeto da "Etapa 1" (mock, single-file, `file://`) para uma
**Etapa 2 full-stack**: frontend estático + funções serverless na Vercel +
Postgres.

## 3. O que foi construído

### Backend (novo)
- `api/orders.js` — CRUD dos pedidos (`GET`/`POST`/`PATCH`). Incluir nunca
  sobrescreve; código repetido volta em `duplicates`.
- `api/import.js` — recebe o arquivo cru (`.xlsx`, depois também `.csv`),
  roda `lib/normalize.js` **no servidor** e devolve os pedidos normalizados
  para revisão (não grava sozinho).
- `api/tracking/[codigo].js` — proxy da API Rastro dos Correios. Sem
  credenciais configuradas, responde `{ degraded: true }` e o app segue
  funcionando normalmente.
- `api/cep/[cep].js` — endereço por CEP via ViaCEP (trocável pela API CEP dos
  Correios quando o contrato estiver ativo).
- `lib/db.js` — acesso ao Postgres (depois trocado de `@vercel/postgres`,
  descontinuado, para `@neondatabase/serverless`), cria o schema sozinho.
- `lib/normalize.js` — parser da planilha Zentra: pula linha "Envio SEDEX",
  ignora linha sem código de rastreio válido, formata telefone, parseia valor
  e data (planilha traz só "dd/mm", sem ano).
- `lib/correios.js` — token + consulta de rastro, mapa de evento→status.
- `schema.sql`, `.env.example`, `package.json` (dependências de backend).

### Frontend (`index.html`)
- Removido o mock e o gerador de datas (`REF_NOW`/`SHIFT`/`dt()`); `orders`
  passou a vir de `loadOrders()` → `GET /api/orders`.
- Botão **Adicionar pedido**: modal em duas etapas — código → consulta
  `/api/tracking` → formulário do cliente → `POST /api/orders`.
- Botão **Importar planilha/CSV**: upload → `POST /api/import` → tela de
  revisão (com seletor de ano, já que a data não tem ano) → confirma → grava
  em lote, pulando duplicatas.
- `esc()` passou a proteger todo `innerHTML` que recebe dado de terceiros
  (Correios, digitação, planilha).
- Ações que antes só mexiam em memória (arquivar, redefinir destacados, tirar
  destaque ao abrir um pedido) passaram a persistir via `PATCH`/`POST`.
- Guard-rails para pedido sem eventos (`lastUpdateAt` cai em `orderDate`),
  sem endereço ("Endereço não informado") e sem data (`—`).

### Infra
- `git init`, primeiro commit, `README.md` com o passo a passo de deploy
  (GitHub → Vercel → conectar Neon → variáveis dos Correios).
- `CLAUDE.md` reescrito para a arquitetura nova (stack, modelo de dados,
  escopo, API de referência).
- Repositório criado pelo usuário; o Claude configurou o remote e fez o
  primeiro `git push` para `github.com/PerfilGus/axis-tracking`.

Cada fluxo (adicionar, importar, arquivar, resetar destaques, rastreio
degradado) foi testado localmente contra um servidor simulado antes de cada
entrega, incluindo a planilha real do Zentra (379 pedidos válidos, 185 linhas
"Envio SEDEX" ignoradas, 25 sem código).

## 4. Deploy — idas e vindas

- Import do repositório na Vercel falhou com "Could not access the
  repository" — era permissão do **GitHub App da Vercel**, não do código;
  resolvido autorizando o repositório em Settings → Installations → Vercel.
- Tela de import ok, 5 variáveis de ambiente detectadas do `.env.example`
  (deixadas em branco de propósito — banco e Correios se conectam depois).
- Depois do primeiro deploy, a lista apareceu vazia — esclarecido que **não
  era falta da API dos Correios**: era o banco Neon ainda não conectado (ou,
  se já conectado, simplesmente sem pedidos ainda). Passo a passo dado:
  Storage → Create Database → Neon → Connect → Redeploy.

## 5. Bug corrigido

- O overlay do modal (Adicionar pedido / Importar) ficava **visível mesmo
  fechado** — `display:flex` no CSS vencia o atributo `hidden` do navegador.
  Corrigido com `.modal-overlay[hidden]{display:none}`.

## 6. Funcionalidades adicionadas depois do primeiro deploy

- **CEP automático**: ao completar 8 dígitos no campo CEP do formulário de
  Adicionar pedido, `/api/cep` (ViaCEP) preenche logradouro/bairro/cidade/UF —
  só nos campos que estiverem vazios, nunca sobrescrevendo o que foi digitado.
- **Telefone no padrão brasileiro**: `formatPhoneBR()` normaliza para
  `(00) 90000-0000` ao colar ou sair do campo; 10 dígitos (celular sem o 9)
  viram 11 com o 9 inserido depois do DDD. Mesma regra aplicada em
  `lib/normalize.js` para a importação.
- **Campo "Kit" removido**: o modelo passou a ter só `pots` (inteiro) —
  chega de string de kit. Migração de schema (`kit` → `pots`) automática em
  `lib/db.js`. Painel, CSV e revisão de importação passaram a mostrar
  "N potes". Na planilha, a coluna "Kit" ("5 meses") virou a extração do
  número de potes (5).
- **Reordenação da barra superior** e correção de ícones: Adicionar pedido →
  Todos os status → Atualizar rastreios → Atualização/Criação → Importar CSV
  (seta ↓) → Exportar CSV (seta ↑, ícone que antes estava trocado) →
  Redefinir destacados.

## 7. Commits desta conversa

```
6da856a  Etapa 2: app full-stack (Vercel + Postgres) com entrada manual de pedidos
d3ca219  Evita flash do estado vazio no load inicial
80c8678  Corrige overlay do modal visível quando fechado
90a83e2  Adicionar pedido: autocompletar endereço por CEP e normalizar telefone
a837334  Remove campo Kit (só potes + valor) e reordena a barra superior
```

---

## Nota: o que veio depois (fora desta conversa)

O `CLAUDE.md` do projeto já reflete trabalho adicional feito em **outra
sessão**, em 12/09/2026 (commits `cc57f2d` a `e1685fe`), que esta conversa não
cobriu: troca do driver do Neon e correção de erro de conexão, correção do
fuso horário/parsing dos eventos do CWS, rastreio em lote com ciclo automático
de 1 minuto no navegador, seleção em massa com arquivar/excluir, limpeza
automática dos arquivados após 7 dias (com a trava de "só exclui arquivado" no
próprio SQL) e ajuste dos crons para a cadência diária do plano Hobby da
Vercel. Ver `CLAUDE.md` (seções 5, 8 e 13) para o estado atual completo.
