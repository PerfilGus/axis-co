# Axis Tracking

Painel interno para acompanhar o status de entrega de pedidos enviados pelos
Correios. Os pedidos são incluídos **manualmente** — um a um pelo botão
**Adicionar pedido** ou em lote pelo botão **Importar planilha** (`.xlsx` do
Zentra). A integração automática com o Zentra vem depois.

## Arquitetura

| Camada | O quê |
|---|---|
| **Frontend** | `index.html` — um arquivo (HTML + CSS + JS + imagens embutidas). Agora fala com `/api/*` em vez de dados fictícios. |
| **API** (funções serverless na Vercel, pasta `api/`) | `orders` (CRUD no banco), `import` (converte o `.xlsx` no servidor), `tracking/[codigo]` (proxy dos Correios), `refresh` (atualiza todos os rastreios em lote). |
| **Banco** | Postgres (Neon, integração nativa da Vercel). Schema em `schema.sql`, criado sozinho por `lib/db.js`. |

Incluir um pedido **nunca** remove os anteriores. Um pedido só sai de
*Em Trânsito* quando você clica em **Arquivar**. Reload e *Redefinir destacados*
não apagam nada.

## Rodar localmente

Precisa da CLI da Vercel (uma vez): `npm i -g vercel`

```bash
npm install
vercel link            # associa a pasta ao projeto na Vercel (primeira vez)
vercel env pull .env.local   # baixa POSTGRES_URL/DATABASE_URL e as chaves dos Correios
vercel dev             # sobe frontend + /api em http://localhost:3000
```

Sem `vercel dev` o `index.html` **não funciona mais sozinho** (ele depende da API).

## Deploy (GitHub + Vercel, plano grátis)

1. **GitHub** — crie um repositório vazio (ex.: `axis-tracking`, privado) e suba:
   ```bash
   git remote add origin https://github.com/<voce>/axis-tracking.git
   git push -u origin main
   ```
2. **Vercel** — [vercel.com/new](https://vercel.com/new) > importe o repositório.
   Framework Preset: **Other**. Deixe build/output em branco. Deploy.
3. **Banco** — no projeto na Vercel: aba **Storage** > **Create Database** >
   **Neon (Postgres)** > *Connect*. As variáveis de conexão entram sozinhas.
   Faça um **Redeploy** para a API enxergar o banco.
4. **Correios** — aba **Settings > Environment Variables**, adicione
   `CORREIOS_ENV` (`PRODUCAO`), `CORREIOS_USER` (CNPJ do contrato, só dígitos),
   `CORREIOS_ACCESS_CODE` (código de acesso do CWS) e `CORREIOS_CARTAO_POSTAGEM`
   (veja `.env.example`) e faça **Redeploy**.
   Sem isso, o rastreio roda em *modo degradado* (cadastro e importação
   funcionam normalmente, só sem eventos automáticos).

## Estrutura

```
index.html        o app (frontend)
api/              funções serverless (orders, import, tracking)
lib/              db.js, normalize.js (xlsx→pedidos), correios.js
schema.sql        estrutura da tabela orders
assets/           PNGs originais (marca e transportadoras)
docs/             especificação do produto
tools/            script de embed dos assets no index.html
CLAUDE.md         instruções do projeto para o Claude Code
.env.example      variáveis de ambiente necessárias
```

## Trocar as imagens

As imagens são embutidas no `index.html` como data URI. Depois de substituir um
PNG em `assets/`, rode:

```bash
powershell -ExecutionPolicy Bypass -File ./tools/embed-assets.ps1
```
