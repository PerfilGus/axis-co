# Axis

Sistema de gestão para venda com pagamento na entrega (PAD).

```bash
npm install
vercel env pull .env.local   # banco, Blob e segredo de auth do ambiente de desenvolvimento
npm run db:migrar            # aplica as migrations
npm run db:seed              # cria o administrador inicial (ADMIN_INICIAL_*)
npm run dev
```

Abra http://localhost:3000 e entre com o administrador inicial. O primeiro
acesso pede troca de senha, aceite do termo de confidencialidade e, para
admin, a verificação em duas etapas. Vendedores e cobradores são criados pelo
admin em Equipe > Colaboradores, com senha provisória.

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:gerar` | Gera migration a partir de `src/lib/servidor/schema.ts` |
| `npm run db:migrar` | Aplica as migrations pendentes |
| `npm run db:seed` | Cria o administrador inicial, se ainda não existir |

As variáveis estão descritas em `.env.example`. Veja `CLAUDE.md` para o mapa
do código e as convenções.
