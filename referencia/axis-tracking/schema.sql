-- Base de dados do Axis Tracking (Vercel Postgres / Neon).
-- Aplicado automaticamente por lib/db.js no primeiro acesso; este arquivo
-- serve como referência e para rodar à mão se preferir.

CREATE TABLE IF NOT EXISTS orders (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code           TEXT UNIQUE NOT NULL,                    -- código de rastreio Correios (AA123456789BR)
  name           TEXT NOT NULL DEFAULT '',
  phone          TEXT NOT NULL DEFAULT '',
  address        JSONB NOT NULL DEFAULT '{}'::jsonb,      -- { street, district, city, uf, cep }
  pots           INTEGER,                                 -- quantidade de potes do pedido
  value          NUMERIC(10,2) NOT NULL DEFAULT 0,
  order_date     TIMESTAMPTZ,                             -- data em que o cliente fez o pedido
  status         TEXT NOT NULL DEFAULT 'aguardando_postagem',
  failure_reason TEXT,                                    -- só quando status = 'falha'
  pickup         JSONB,                                   -- { agency, address } — só quando status = 'aguardando_retirada'
  archived       BOOLEAN NOT NULL DEFAULT FALSE,
  archived_at    TIMESTAMPTZ,                             -- quando foi arquivado; base da limpeza dos 7 dias
  highlighted    BOOLEAN NOT NULL DEFAULT TRUE,           -- atualização ainda não vista
  events         JSONB NOT NULL DEFAULT '[]'::jsonb,      -- [{ at, title, desc, city, type }] mais recente primeiro
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orders_archived_idx ON orders (archived);
-- a limpeza varre por (archived, archived_at); sem o índice seria seq scan
CREATE INDEX IF NOT EXISTS orders_archived_at_idx ON orders (archived, archived_at);
