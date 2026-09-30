import type { Database } from "../db/database.js";
import { migrateDatabase } from "../db/migrations.js";
import { SetupError } from "./errors.js";
export async function prepareAdminTables(db: Database) {
  const { rows } = await db.query(
    "select to_regclass('app.profiles') as profiles,to_regclass('app.audit_log') as audit",
  );
  if (rows[0]!.profiles && rows[0]!.audit) return;
  if (rows[0]!.profiles || rows[0]!.audit)
    throw new SetupError(
      "La estructura de administración está incompleta. Revisa las migraciones antes de reparar la cuenta.",
    );
  await migrateDatabase(db);
}
