import { readConfig } from "../config/env.js";
import { createDatabase, type Database } from "../db/database.js";
import { migrateDatabase } from "../db/migrations.js";
import { setupError } from "../setup/errors.js";

let db: Database | undefined;
try {
  db = createDatabase(readConfig());
  const applied = await migrateDatabase(db);
  for (const name of applied) console.log(`Aplicada: ${name}`);
  console.log("Base de datos preparada.");
} catch (error) {
  console.error(setupError(error));
  process.exitCode = 1;
} finally {
  await db?.close();
}
