import { createClient } from "@supabase/supabase-js";
import { readConfig } from "./config/env.js";
import { createDatabase } from "./db/database.js";
import { createApp } from "./app.js";
import { AppError } from "./lib/errors.js";
const config = readConfig();
const db = createDatabase(config);
const auth = createClient(
  config.SUPABASE_URL,
  config.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const app = await createApp({
  db,
  config,
  verify: async (token) => {
    const { data, error } = await auth.auth.getUser(token);
    if (error) return null;
    return data.user?.id ?? null;
  },
  users: {
    async create(email, password) {
      const { data, error } = await auth.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error || !data.user) throw new AppError("USER_CREATE_FAILED", 409);
      return data.user.id;
    },
    async remove(id) {
      const { error } = await auth.auth.admin.deleteUser(id);
      if (error) throw new AppError("USER_CLEANUP_FAILED", 500);
    },
  },
});
await app.listen({ port: config.PORT, host: config.HOST });
for (const signal of ["SIGTERM", "SIGINT"] as const)
  process.once(signal, async () => {
    await app.close();
    await db.close();
    process.exit(0);
  });
