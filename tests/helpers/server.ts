// Test process only. This file is never imported into or bundled with production.
import { randomUUID } from "node:crypto";
import { createApp } from "../../backend/src/app";
import { testDatabase, seed, testConfig } from "./database";
import { tokens } from "./tokens";
const { db } = await testDatabase();
await seed(db);
const app = await createApp({
  db,
  config: testConfig,
  verify: async (token) => tokens.get(token) ?? null,
  users: {
    async create() {
      const id = randomUUID();
      await db.query("insert into auth.users(id) values($1)", [id]);
      return id;
    },
    remove: async (id) => {
      await db.query("delete from auth.users where id=$1", [id]);
    },
  },
});
await app.listen({ host: "127.0.0.1", port: 4901 });
for (const signal of ["SIGTERM", "SIGINT"] as const)
  process.once(signal, async () => {
    await app.close();
    await db.close();
    process.exit(0);
  });
