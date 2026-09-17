import "server-only";
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

/**
 * Conexão com o Neon.
 *
 * Usa o driver por WebSocket (Pool) e não o HTTP: as ações gravam o registro e
 * a atividade na mesma transação, e só o Pool oferece transação interativa.
 */

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL não definida. Veja .env.example.");

const globalParaDb = globalThis as unknown as { poolAxis?: Pool };
const pool = globalParaDb.poolAxis ?? new Pool({ connectionString: url });
if (process.env.NODE_ENV !== "production") globalParaDb.poolAxis = pool;

export const db = drizzle({ client: pool, schema, casing: "snake_case" });

export type Db = typeof db;
export type Transacao = Parameters<Parameters<Db["transaction"]>[0]>[0];
