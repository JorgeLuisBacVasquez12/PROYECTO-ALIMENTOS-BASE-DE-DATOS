// Test process only. This file is never imported into or bundled with production.
import { testAuthServer } from "./auth-server";
import { createApp } from "../../backend/src/app";
import { testDatabase, seed, testConfig } from "./database";
import { tokens } from "./tokens";
const { db } = await testDatabase();
await seed(db);
const auth = await testAuthServer(db);
const app = await createApp({
  db,
  config: testConfig,
  verify: async (token) => tokens.get(token) ?? null,
  users: auth.provisioner,
});
await app.listen({ host: "127.0.0.1", port: 4901 });
for (const signal of ["SIGTERM", "SIGINT"] as const)
  process.once(signal, async () => {
    await app.close();
    await auth.close();
    await db.close();
    process.exit(0);
  });
