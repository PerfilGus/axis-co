// Rotas chamadas pelo Cron da Vercel são públicas na internet. A Vercel manda
// `Authorization: Bearer $CRON_SECRET` quando essa variável existe no projeto,
// e é assim que separamos "o cron chamou" de "alguém achou a URL".
//
// Sem CRON_SECRET definido a resposta é recusar, não liberar: a rota de limpeza
// apaga pedidos, e uma rota dessas aberta ao mundo é pior do que uma que não roda.
export function cronAutorizado(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return { ok: false, status: 503, error: 'CRON_SECRET não configurado no projeto' };
  const header = req.headers?.authorization || '';
  if (header !== `Bearer ${secret}`) return { ok: false, status: 401, error: 'não autorizado' };
  return { ok: true };
}
