// Camada de acesso ao Postgres (Neon — integração nativa da Vercel).
// A connection string é injetada pela Vercel ao conectar o store Neon no
// painel do projeto — ver resolveConnectionString() para o nome da variável.
import { neon } from '@neondatabase/serverless';

// A integração Neon deixa o prefixo das variáveis escolhido na hora de conectar
// (o padrão do painel é STORAGE_URL, não DATABASE_URL). Fixar um nome só quebra
// silenciosamente quando o prefixo difere, então procuramos os nomes conhecidos
// e, se nenhum existir, qualquer variável cujo VALOR seja uma URL Postgres.
const KNOWN_KEYS = [
  'DATABASE_URL', 'POSTGRES_URL', 'STORAGE_URL',
  'STORAGE_POSTGRES_URL', 'STORAGE_DATABASE_URL',
];
const PG_URL_RE = /^postgres(ql)?:\/\//;

function resolveConnectionString() {
  for (const key of KNOWN_KEYS) {
    if (process.env[key]) return process.env[key];
  }
  // Prefere a pooled: a *_UNPOOLED abre conexão direta, ruim em serverless.
  const found = Object.keys(process.env)
    .filter((k) => PG_URL_RE.test(process.env[k] || ''))
    .sort((a, b) => Number(a.includes('UNPOOLED')) - Number(b.includes('UNPOOLED')));
  return found.length ? process.env[found[0]] : null;
}

// Conexão preguiçosa: `neon()` lança quando a env var falta, e no topo do módulo
// isso derrubava a função inteira antes do try/catch do handler — o cliente
// recebia um 500 em HTML, sem mensagem. Adiando para a 1ª query, o erro vira
// resposta JSON legível. A assinatura de tagged template é preservada, então
// todas as chamadas `sql`...`` seguem iguais.
let client;
function sql(strings, ...values) {
  if (!client) {
    const connectionString = resolveConnectionString();
    if (!connectionString) {
      throw new Error(
        'Banco não configurado: nenhuma variável de ambiente com URL Postgres foi '
        + 'encontrada. Conecte o store Neon ao projeto na Vercel e faça Redeploy.'
      );
    }
    client = neon(connectionString);
  }
  return client(strings, ...values);
}

// A criação do schema roda uma vez por cold start — cacheia a promessa.
let schemaReady;
function ensureSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS orders (
          id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          code           TEXT UNIQUE NOT NULL,
          name           TEXT NOT NULL DEFAULT '',
          phone          TEXT NOT NULL DEFAULT '',
          address        JSONB NOT NULL DEFAULT '{}'::jsonb,
          pots           INTEGER,
          value          NUMERIC(10,2) NOT NULL DEFAULT 0,
          order_date     TIMESTAMPTZ,
          status         TEXT NOT NULL DEFAULT 'aguardando_postagem',
          failure_reason TEXT,
          pickup         JSONB,
          archived       BOOLEAN NOT NULL DEFAULT FALSE,
          highlighted    BOOLEAN NOT NULL DEFAULT TRUE,
          events         JSONB NOT NULL DEFAULT '[]'::jsonb,
          created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `;
      // migração de bancos criados antes da troca "kit" -> "pots"
      await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS pots INTEGER;`;
      await sql`ALTER TABLE orders DROP COLUMN IF EXISTS kit;`;
      await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;`;
      // Quem já estava arquivado antes da coluna existir não tem data. Marcar com
      // now() (e não com updated_at) dá a esses pedidos os 7 dias inteiros a
      // partir de agora — ninguém perde histórico por causa da migração.
      await sql`UPDATE orders SET archived_at = now() WHERE archived = TRUE AND archived_at IS NULL;`;
      await sql`CREATE INDEX IF NOT EXISTS orders_archived_idx ON orders (archived);`;
      await sql`CREATE INDEX IF NOT EXISTS orders_archived_at_idx ON orders (archived, archived_at);`;
    })();
  }
  return schemaReady;
}

// Linha do banco -> formato que o frontend espera (o contrato do CLAUDE.md).
function rowToOrder(r) {
  return {
    id: Number(r.id),
    code: r.code,
    name: r.name,
    phone: r.phone,
    address: r.address || { street: '', district: '', city: '', uf: '', cep: '' },
    pots: r.pots == null ? null : Number(r.pots),
    value: r.value == null ? 0 : Number(r.value),
    orderDate: r.order_date ? new Date(r.order_date).toISOString() : null,
    status: r.status,
    failureReason: r.failure_reason || undefined,
    pickup: r.pickup || undefined,
    archived: r.archived,
    archivedAt: r.archived_at ? new Date(r.archived_at).toISOString() : null,
    highlighted: r.highlighted,
    events: Array.isArray(r.events) ? r.events : [],
  };
}

export async function listOrders() {
  await ensureSchema();
  const rows = await sql`SELECT * FROM orders ORDER BY created_at DESC`;
  return rows.map(rowToOrder);
}

// Insere um pedido. Se o código já existe, NÃO sobrescreve — devolve o existente
// marcado como duplicate (incluir nunca apaga nem mexe no que já está lá).
export async function createOrder(o) {
  await ensureSchema();
  const existing = await sql`SELECT * FROM orders WHERE code = ${o.code}`;
  if (existing.length) return { order: rowToOrder(existing[0]), duplicate: true };

  const rows = await sql`
    INSERT INTO orders (code, name, phone, address, pots, value, order_date, status, failure_reason, pickup, highlighted, events)
    VALUES (
      ${o.code},
      ${o.name || ''},
      ${o.phone || ''},
      ${JSON.stringify(o.address || {})}::jsonb,
      ${Number.isFinite(o.pots) && o.pots > 0 ? Math.trunc(o.pots) : null},
      ${Number(o.value) || 0},
      ${o.orderDate || null},
      ${o.status || 'aguardando_postagem'},
      ${o.failureReason || null},
      ${o.pickup ? JSON.stringify(o.pickup) : null}::jsonb,
      ${o.highlighted !== false},
      ${JSON.stringify(o.events || [])}::jsonb
    )
    RETURNING *;
  `;
  return { order: rowToOrder(rows[0]), duplicate: false };
}

// Atualização parcial. Só os campos presentes em patch são tocados.
export async function updateOrder(id, patch) {
  await ensureSchema();
  const has = (k) => Object.prototype.hasOwnProperty.call(patch, k);
  const rows = await sql`
    UPDATE orders SET
      name           = COALESCE(${patch.name ?? null}, name),
      phone          = COALESCE(${patch.phone ?? null}, phone),
      address        = COALESCE(${patch.address ? JSON.stringify(patch.address) : null}::jsonb, address),
      pots           = CASE WHEN ${has('pots')} THEN ${patch.pots ?? null} ELSE pots END,
      value          = COALESCE(${patch.value ?? null}, value),
      order_date     = COALESCE(${patch.orderDate ?? null}, order_date),
      status         = COALESCE(${patch.status ?? null}, status),
      failure_reason = CASE WHEN ${has('failureReason')} THEN ${patch.failureReason ?? null} ELSE failure_reason END,
      pickup         = CASE WHEN ${has('pickup')} THEN ${patch.pickup ? JSON.stringify(patch.pickup) : null}::jsonb ELSE pickup END,
      archived       = COALESCE(${typeof patch.archived === 'boolean' ? patch.archived : null}, archived),
      -- a data do arquivamento é o relógio da limpeza dos 7 dias: carimba ao
      -- arquivar e zera ao desarquivar, para o prazo recomeçar do zero.
      archived_at    = CASE WHEN ${typeof patch.archived === 'boolean'}
                            THEN (CASE WHEN ${patch.archived === true} THEN now() ELSE NULL END)
                            ELSE archived_at END,
      highlighted    = COALESCE(${typeof patch.highlighted === 'boolean' ? patch.highlighted : null}, highlighted),
      events         = COALESCE(${patch.events ? JSON.stringify(patch.events) : null}::jsonb, events),
      updated_at     = now()
    WHERE id = ${id}
    RETURNING *;
  `;
  return rows.length ? rowToOrder(rows[0]) : null;
}

// Limpa o destaque de todos de uma vez (botão "Redefinir destacados").
// Não remove nem arquiva nada — só zera a flag.
export async function resetHighlights() {
  await ensureSchema();
  await sql`UPDATE orders SET highlighted = FALSE, updated_at = now() WHERE highlighted = TRUE`;
  return listOrders();
}

// Arquiva/desarquiva vários de uma vez (seleção em massa da lista).
export async function setArchivedMany(ids, archived) {
  await ensureSchema();
  const limpos = (ids || []).map(Number).filter(Number.isInteger);
  if (!limpos.length) return { affected: 0 };
  const rows = await sql`
    UPDATE orders
       SET archived    = ${!!archived},
           archived_at = CASE WHEN ${!!archived} THEN now() ELSE NULL END,
           updated_at  = now()
     WHERE id = ANY(${limpos})
    RETURNING id;
  `;
  return { affected: rows.length };
}

/**
 * Exclui pedidos DEFINITIVAMENTE — e só os arquivados.
 * O `AND archived = TRUE` fica no SQL de propósito: mesmo que a UI mande um id
 * de pedido em trânsito (bug, requisição forjada), o banco recusa. Pedido em
 * trânsito nunca é apagado.
 */
export async function deleteOrders(ids) {
  await ensureSchema();
  const limpos = (ids || []).map(Number).filter(Number.isInteger);
  if (!limpos.length) return { deleted: 0, codes: [], refused: 0 };

  const rows = await sql`
    DELETE FROM orders
     WHERE id = ANY(${limpos})
       AND archived = TRUE
    RETURNING code;
  `;
  return {
    deleted: rows.length,
    codes: rows.map((r) => r.code),
    refused: limpos.length - rows.length, // ids que nao estavam arquivados
  };
}

/**
 * Limpeza automática: remove arquivados com mais de `days` dias de arquivamento.
 * As três condições são deliberadas — `archived = TRUE` protege quem está em
 * trânsito (inclusive entregues, que só saem da lista ao arquivar), e
 * `archived_at IS NOT NULL` evita apagar linha sem data por qualquer motivo.
 */
export async function purgeArchived(days = 7) {
  await ensureSchema();
  const dias = Number.isFinite(days) && days > 0 ? Math.trunc(days) : 7;
  const rows = await sql`
    DELETE FROM orders
     WHERE archived = TRUE
       AND archived_at IS NOT NULL
       AND archived_at < now() - (${dias} * INTERVAL '1 day')
    RETURNING code, archived_at;
  `;
  return { deleted: rows.length, codes: rows.map((r) => r.code), days: dias };
}
