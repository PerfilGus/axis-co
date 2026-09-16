// CRUD dos pedidos.
//   GET    /api/orders                 -> lista todos
//   POST   /api/orders  { ...order }    -> inclui um
//   POST   /api/orders  { orders:[...] } -> inclui vários (importação)
//   POST   /api/orders  { action:'reset-highlights' } -> zera destaques
//   POST   /api/orders  { action:'archive', ids:[...], archived } -> em massa
//   PATCH  /api/orders  { id, ...patch } -> atualiza (arquivar, editar, eventos)
//   DELETE /api/orders  { ids:[...] }    -> exclui DE VEZ, e só arquivados
//
// Incluir nunca remove nem sobrescreve pedidos existentes.
import { listOrders, createOrder, updateOrder, resetHighlights, setArchivedMany, deleteOrders } from '../lib/db.js';

const CODE_RE = /^[A-Z]{2}\d{9}[A-Z]{2}$/;

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      return res.status(200).json({ orders: await listOrders() });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

      if (body.action === 'reset-highlights') {
        return res.status(200).json({ orders: await resetHighlights() });
      }

      if (body.action === 'archive') {
        const { affected } = await setArchivedMany(body.ids, body.archived !== false);
        return res.status(200).json({ affected, orders: await listOrders() });
      }

      const incoming = Array.isArray(body.orders) ? body.orders : [body];
      const created = [];
      const duplicates = [];
      const invalid = [];

      for (const o of incoming) {
        const code = String(o.code || '').trim().toUpperCase();
        if (!CODE_RE.test(code)) { invalid.push(o.code || '(vazio)'); continue; }
        const { order, duplicate } = await createOrder({ ...o, code });
        (duplicate ? duplicates : created).push(order);
      }

      return res.status(201).json({ created, duplicates, invalid });
    }

    if (req.method === 'PATCH') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const id = Number(body.id);
      if (!id) return res.status(400).json({ error: 'id obrigatório' });
      const { id: _omit, ...patch } = body;
      const updated = await updateOrder(id, patch);
      if (!updated) return res.status(404).json({ error: 'pedido não encontrado' });
      return res.status(200).json({ order: updated });
    }

    if (req.method === 'DELETE') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      // fallback por query: nem todo runtime entrega corpo em DELETE.
      const brutos = Array.isArray(body.ids) && body.ids.length
        ? body.ids
        : String(req.query.ids || '').split(',').filter(Boolean);
      const ids = brutos.map(Number).filter(Number.isInteger);
      if (!ids.length) return res.status(400).json({ error: 'nenhum id informado' });

      // A trava de "só arquivados" mora no SQL (ver deleteOrders); aqui só
      // repassamos quantos foram recusados para a UI poder avisar.
      const { deleted, codes, refused } = await deleteOrders(ids);
      return res.status(200).json({ deleted, codes, refused, orders: await listOrders() });
    }

    res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
    return res.status(405).json({ error: 'método não permitido' });
  } catch (err) {
    console.error('[api/orders]', err);
    return res.status(500).json({ error: err.message || 'erro interno' });
  }
}
