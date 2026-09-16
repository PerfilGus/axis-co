// Consulta de rastreio de um código nos Correios (via proxy seguro).
//   GET /api/tracking/AA123456789BR
//
// Sem credenciais dos Correios configuradas, responde { degraded: true } e o
// app segue funcionando normalmente, só sem eventos reais.
import { getTracking } from '../../lib/correios.js';

const CODE_RE = /^[A-Z]{2}\d{9}[A-Z]{2}$/;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'método não permitido' });
  }

  const code = String(req.query.codigo || '').trim().toUpperCase();
  if (!CODE_RE.test(code)) {
    return res.status(400).json({ error: 'código de rastreio inválido (formato AA123456789BR)' });
  }

  try {
    const result = await getTracking(code);
    return res.status(200).json({ code, ...result });
  } catch (err) {
    console.error('[api/tracking]', err);
    return res.status(502).json({ code, error: err.message || 'falha ao consultar os Correios' });
  }
}
