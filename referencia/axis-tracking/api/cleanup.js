// Limpeza automática dos arquivados antigos.
//   GET /api/cleanup  (chamado pelo Cron da Vercel, 1x por dia)
//
// Remove SOMENTE pedidos arquivados há mais de RETENCAO_DIAS. Nada que esteja
// em Em Trânsito é tocado — inclusive os entregues, que só saem da lista quando
// alguém clica em Arquivar. A garantia não depende desta rota: as condições
// estão no DELETE de purgeArchived(), em lib/db.js.
import { purgeArchived } from '../lib/db.js';
import { cronAutorizado } from '../lib/cron-auth.js';

const RETENCAO_DIAS = 7;

export default async function handler(req, res) {
  const auth = cronAutorizado(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  try {
    const { deleted, codes, days } = await purgeArchived(RETENCAO_DIAS);
    // O log da Vercel guarda quais sumiram — útil se alguém sentir falta depois.
    if (deleted) console.log('[api/cleanup] excluidos apos', days, 'dias:', codes.join(', '));
    return res.status(200).json({ deleted, days });
  } catch (err) {
    console.error('[api/cleanup]', err);
    return res.status(500).json({ error: err.message || 'falha na limpeza' });
  }
}
