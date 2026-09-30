import { PGlite } from "@electric-sql/pglite";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Database, Executor } from "../../backend/src/db/database";
import type { Config } from "../../backend/src/config/env";
export const ids = {
  admin: "00000000-0000-4000-8000-000000000001",
  a: "00000000-0000-4000-8000-000000000002",
  b: "00000000-0000-4000-8000-000000000003",
  other: "00000000-0000-4000-8000-000000000004",
  campaign: "00000000-0000-4000-8000-000000000010",
  pointA: "00000000-0000-4000-8000-000000000020",
  pointB: "00000000-0000-4000-8000-000000000021",
};
export const testConfig: Config = {
  NODE_ENV: "test",
  PORT: 4001,
  HOST: "127.0.0.1",
  FRONTEND_ORIGINS: "http://localhost:5173,http://127.0.0.1:5173",
  DATABASE_URL: "postgres://local/test",
  DATABASE_SSL: "false",
  DB_POOL_MAX: 5,
  SUPABASE_URL: "http://127.0.0.1:4001",
  SUPABASE_SERVICE_ROLE_KEY: "test-only-not-a-real-credential",
  TRUST_PROXY_HOPS: 0,
  UPLOAD_MAX_MB: 10,
  IMPORT_MAX_ROWS: 50000,
  IMPORT_MAX_COLUMNS: 150,
  IMPORT_TTL_MINUTES: 30,
  REPORT_MAX_ROWS: 50000,
  APP_TIMEZONE: "America/Guatemala",
};
export async function testDatabase(
  options: { applyMigrations?: boolean } = {},
) {
  const pg = new PGlite();
  await pg.exec(
    `create role anon nologin;create role authenticated nologin;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`,
  );
  if (options.applyMigrations !== false) {
    const folder = resolve("database/migrations");
    for (const name of (await readdir(folder))
      .filter((n) => n.endsWith(".sql"))
      .sort())
      await pg.exec(await readFile(resolve(folder, name), "utf8"));
  }
  const wrap = (client: Pick<PGlite, "query" | "exec">): Executor => ({
    async query<T extends Record<string, unknown>>(
      sql: string,
      values?: unknown[],
    ) {
      if (values === undefined) {
        const results = await client.exec(sql);
        const r = results.at(-1);
        const rows = (r?.rows ?? []) as T[];
        return { rows, rowCount: r?.affectedRows ?? rows.length };
      }
      const r = await client.query<T>(sql, values);
      return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length };
    },
  });
  const db: Database = {
    ...wrap(pg),
    transaction: (work) => pg.transaction((tx) => work(wrap(tx))),
    close: () => pg.close(),
  };
  return { db, pg };
}
export async function seed(db: Database) {
  for (const id of [ids.admin, ids.a, ids.b, ids.other])
    await db.query("insert into auth.users(id) values($1)", [id]);
  await db.query(
    "insert into app.profiles(id,display_name,role) values($1,'Administración de prueba','admin'),($2,'Operadora A de prueba','operator'),($3,'Operador B de prueba','operator'),($4,'Sin asignación de prueba','operator')",
    [ids.admin, ids.a, ids.b, ids.other],
  );
  await db.query(
    "insert into app.points(id,name) values($1,'Punto A de prueba'),($2,'Punto B de prueba')",
    [ids.pointA, ids.pointB],
  );
  await db.query(
    "insert into app.campaigns(id,name,benefit,status,created_by) values($1,'Jornada de prueba','Porción de prueba','active',$2)",
    [ids.campaign, ids.admin],
  );
  for (const [user, point] of [
    [ids.a, ids.pointA],
    [ids.b, ids.pointB],
    [ids.admin, ids.pointA],
  ])
    await db.query(
      "insert into app.assignments(campaign_id,user_id,point_id) values($1,$2,$3)",
      [ids.campaign, user, point],
    );
  for (let i = 1; i <= 5; i++) {
    const person = await db.query(
      "insert into app.people(dpi,full_name) values($1,$2) returning id",
      [`900000000000${i}`, `Persona de prueba ${i}`],
    );
    await db.query(
      "insert into app.campaign_people(campaign_id,person_id,full_name,extra) values($1,$2,$3,$4)",
      [
        ids.campaign,
        person.rows[0]!.id,
        `Persona de prueba ${i}`,
        JSON.stringify({ Comunidad: "Dato de prueba", Teléfono: "=2+2" }),
      ],
    );
  }
}
