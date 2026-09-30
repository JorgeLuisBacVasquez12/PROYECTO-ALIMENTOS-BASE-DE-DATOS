import pg from "pg";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Config } from "../config/env.js";
export interface Executor {
  query<T extends pg.QueryResultRow = pg.QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: T[]; rowCount: number | null }>;
}
export interface Database extends Executor {
  transaction<T>(work: (client: Executor) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
export function createDatabase(config: Config): Database {
  const ca = config.DATABASE_SSL_CA
    ? config.DATABASE_SSL_CA.replace(/\\n/g, "\n")
    : config.DATABASE_SSL_CA_FILE
      ? readFileSync(resolve(config.DATABASE_SSL_CA_FILE), "utf8")
      : undefined;
  const pool = new pg.Pool({
    connectionString: config.DATABASE_URL,
    ssl:
      config.DATABASE_SSL === "true"
        ? {
            rejectUnauthorized: true,
            ...(ca ? { ca } : {}),
          }
        : false,
    max: config.DB_POOL_MAX,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    statement_timeout: 30000,
    application_name: "mazate-entregas",
  });
  pool.on("error", () => process.stderr.write("Database connection failed.\n"));
  return {
    query: (text, values) => pool.query(text, values),
    async transaction(work) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const result = await work(client);
        await client.query("commit");
        return result;
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}
