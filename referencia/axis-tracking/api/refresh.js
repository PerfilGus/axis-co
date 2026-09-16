// Atualiza o rastreio de todos os pedidos de uma vez.
//   POST /api/refresh -> { updated, checked, degraded?, orders }
//
// Existe para o ciclo automático do frontend: em vez de o navegador disparar
// uma requisição por pedido a cada minuto, ele chama esta rota uma vez e o
// servidor consulta os Correios em lote (ver getTrackingBatch).
import { listOrders, updateOrder } from '../lib/db.js';
import { getTrackingBatch, correiosConfigured } from '../lib/correios.js';
import { cronAutorizado } from '../lib/cron-auth.js';

export default async function handler(req, res) {
  // O app chama via POST. O Cron da Vercel só sabe fazer GET, então GET é
  // aceito apenas com o segredo do cron — caso contrário qualquer visita à URL
  // dispararia uma rodada de consultas aos Correios.
  const viaCron = req.method === 'GET';
  if (viaCron) {
    const auth = cronAutorizado(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  } else if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'método não permitido' });
  }

  try {
    if (!correiosConfigured()) {
      return res.status(200).json({
        degraded: true,
        message: 'Credenciais dos Correios não configuradas. Rastreio em modo degradado.',
        updated: 0,
        checked: 0,
        orders: await listOrders(),
      });
    }

    const todos = await listOrders();
    // Arquivado nao interessa mais; sem codigo nao ha o que consultar.
    const alvos = todos.filter((o) => !o.archived && o.code);
    const rastreios = await getTrackingBatch(alvos.map((o) => o.code));

    let updated = 0;
    for (const o of alvos) {
      const t = rastreios.get(o.code.toUpperCase());
      if (!t || !t.found || !t.events.length) continue;

      // So grava (e destaca) quando ha novidade de verdade — caso contrario o
      // ciclo de 1 minuto reescreveria as 19 linhas e re-destacaria tudo.
      const atualAt = o.events.length ? o.events[0].at : null;
      if (atualAt === t.events[0].at && o.status === t.status) {
        // Pedido que já estava em retirada antes de o endereço da agência ser
        // gravado: completa o pickup uma vez, sem re-destacar (não é novidade).
        if (t.pickup && !o.pickup) {
          await updateOrder(o.id, { pickup: t.pickup });
          updated++;
        }
        continue;
      }

      await updateOrder(o.id, {
        status: t.status,
        failureReason: t.failureReason,
        pickup: t.pickup,
        events: t.events,
        highlighted: true,
      });
      updated++;
    }

    if (viaCron) {
      if (updated) console.log('[api/refresh] cron atualizou', updated, 'de', alvos.length);
      return res.status(200).json({ updated, checked: alvos.length });
    }
    return res.status(200).json({ updated, checked: alvos.length, orders: await listOrders() });
  } catch (err) {
    console.error('[api/refresh]', err);
    return res.status(502).json({ error: err.message || 'falha ao atualizar rastreios' });
  }
}
