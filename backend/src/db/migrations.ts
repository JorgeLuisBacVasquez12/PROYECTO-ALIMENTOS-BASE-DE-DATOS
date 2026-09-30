import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import type { Database } from "./database.js";

export async function migrateDatabase(db: Database) {
  const applied: string[] = [];
  const directory = fileURLToPath(
    new URL("../../../database/migrations/", import.meta.url),
  );
  await db.transaction(async (tx) => {
    await tx.query(
      "select pg_advisory_xact_lock(hashtextextended('mazate-entregas-migrations',0))",
    );
    await tx.query("create schema if not exists app");
    await tx.query(
      "create table if not exists app.schema_migrations(name text primary key,checksum text not null,applied_at timestamptz not null default now())",
    );
    for (const name of (await readdir(directory))
      .filter((n) => n.endsWith(".sql"))
      .sort()) {
      const sql = await readFile(resolve(directory, name), "utf8");
      const hash = createHash("sha256").update(sql).digest("hex");
      const old = await tx.query(
        "select checksum from app.schema_migrations where name=$1",
        [name],
      );
      if (old.rows[0]) {
        if (old.rows[0].checksum !== hash)
          throw new Error(`La migración ${name} cambió después de aplicarse.`);
        continue;
      }
      await tx.query(sql);
      await tx.query(
        "insert into app.schema_migrations(name,checksum) values($1,$2)",
        [name, hash],
      );
      applied.push(name);
    }
  });
  return applied;
}
