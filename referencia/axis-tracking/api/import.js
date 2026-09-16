// Recebe a planilha .xlsx crua (corpo binário) e devolve a lista de pedidos
// normalizada, SEM gravar no banco — a gravação só acontece quando o usuário
// confirma na tela de revisão (POST /api/orders).
//
//   POST /api/import?ano=2025
//   Content-Type: application/octet-stream
//   corpo: bytes do .xlsx
import { normalizeWorkbook } from '../lib/normalize.js';

// Não deixar a Vercel tentar fazer parse do corpo binário.
export const config = { api: { bodyParser: false } };

async function readRawBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (req.body instanceof ArrayBuffer) return Buffer.from(req.body);
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'método não permitido' });
  }
  try {
    const year = Number(req.query.ano) || new Date().getFullYear();
    const buf = await readRawBody(req);
    if (!buf || !buf.length) return res.status(400).json({ error: 'arquivo vazio' });

    const { rows, skipped, ignored } = normalizeWorkbook(buf, year);
    return res.status(200).json({ rows, skipped, ignored, year });
  } catch (err) {
    console.error('[api/import]', err);
    return res.status(400).json({ error: 'não foi possível ler a planilha: ' + (err.message || 'formato inválido') });
  }
}
