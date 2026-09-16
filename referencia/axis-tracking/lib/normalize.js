// Converte a planilha do Zentra (.xlsx) para a lista de pedidos do Axis.
// Roda no servidor (Node) — a lib xlsx nunca é carregada no navegador.
import * as XLSX from 'xlsx';

// Cabeçalhos aceitos por campo (case-insensitive, sem acento). A planilha do
// Zentra tem: Data | Nome | Contato | Kit | Valor | Pagamento | Status pedido | Cód. Rastreio | Observações
const HEADER_ALIASES = {
  data:    ['data', 'data pedido', 'data do pedido'],
  name:    ['nome', 'cliente', 'nome do cliente'],
  phone:   ['contato', 'telefone', 'celular', 'whatsapp'],
  pots:    ['kit', 'potes', 'produto', 'plano'],   // "Kit" na planilha do Zentra ("X meses" = X potes)
  value:   ['valor', 'valor pedido', 'total'],
  code:    ['cod. rastreio', 'codigo rastreio', 'codigo de rastreio', 'rastreio', 'rastreamento', 'codigo'],
};

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

function mapColumns(headerRow) {
  const idx = {};
  headerRow.forEach((cell, i) => {
    const h = norm(cell);
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (idx[field] === undefined && aliases.some((a) => h === a || h.startsWith(a))) idx[field] = i;
    }
  });
  return idx;
}

// Padrão brasileiro de celular: (00) 90000-0000. Se vier com 10 dígitos
// (faltando o 9 do celular), insere o 9 depois do DDD. "3491247774" -> "(34) 99124-7774".
function formatPhone(raw) {
  let d = String(raw ?? '').replace(/\D/g, '');
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2); // tira +55
  if (d.length === 10) d = d.slice(0, 2) + '9' + d.slice(2);                      // celular sem o 9
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  return String(raw ?? '').trim();
}

// A coluna "Kit" da planilha vem como "5 meses" / "3 meses": o número é a
// quantidade de potes (1 pote por mês). "5 meses" -> 5.
function parsePots(raw) {
  const m = String(raw ?? '').match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

// "397" | "397,90" | "R$ 1.397,90" | 397 (número) -> 397.9
function parseValue(raw) {
  if (typeof raw === 'number') return raw;
  let s = String(raw ?? '').replace(/[^\d,.-]/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); // formato pt-BR
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

// A planilha traz a data como "09/07" (sem ano). O ano vem da tela de importação.
// Guarda também o texto cru pra tela poder recompor se o usuário trocar o ano.
function parseDate(raw, year) {
  if (raw instanceof Date && !isNaN(raw)) return { iso: raw.toISOString(), raw: null };
  const m = String(raw ?? '').trim().match(/^(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2,4}))?/);
  if (!m) return { iso: null, raw: String(raw ?? '').trim() || null };
  const day = +m[1];
  const month = +m[2];
  let y = m[3] ? +m[3] : year;
  if (y < 100) y += 2000;
  const d = new Date(Date.UTC(y, month - 1, day, 12, 0, 0));
  return isNaN(d) ? { iso: null, raw: String(raw).trim() } : { iso: d.toISOString(), raw: `${m[1]}/${m[2]}` };
}

const CODE_RE = /^[A-Z]{2}\d{9}[A-Z]{2}$/;

/**
 * @param {Buffer} buf    conteúdo do .xlsx
 * @param {number} year   ano de referência para datas "dd/mm"
 * @returns {{ rows: object[], skipped: number, ignored: string[] }}
 */
export function normalizeWorkbook(buf, year) {
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });
  if (!grid.length) return { rows: [], skipped: 0, ignored: [] };

  const cols = mapColumns(grid[0]);
  const rows = [];
  const ignored = [];
  let skipped = 0;

  for (let i = 1; i < grid.length; i++) {
    const r = grid[i];
    const get = (f) => (cols[f] === undefined ? '' : r[cols[f]]);

    const name = String(get('name') ?? '').trim();
    const codeRaw = String(get('code') ?? '').trim().toUpperCase().replace(/\s+/g, '');

    // Linha "🚚 Envio SEDEX" (ou variações) pertence à linha de cima — ignorar.
    if (/envio\s+sedex/i.test(name) || /^[^\p{L}\d]*envio/iu.test(name)) { skipped++; continue; }

    // Linha sem código E sem nome não é um pedido.
    if (!codeRaw && !name) { skipped++; continue; }

    if (!CODE_RE.test(codeRaw)) {
      ignored.push(name || `linha ${i + 1}`);
      continue;
    }

    const { iso, raw } = parseDate(get('data'), year);
    rows.push({
      code: codeRaw,
      name,
      phone: formatPhone(get('phone')),
      address: { street: '', district: '', city: '', uf: '', cep: '' }, // planilha não traz endereço
      pots: parsePots(get('pots')),                                     // "5 meses" -> 5 potes
      value: parseValue(get('value')),
      orderDate: iso,
      orderDateRaw: raw, // "09/07" — a tela recompõe com o ano escolhido
      status: 'aguardando_postagem',
      highlighted: true,
      events: [],
    });
  }

  return { rows, skipped, ignored };
}
