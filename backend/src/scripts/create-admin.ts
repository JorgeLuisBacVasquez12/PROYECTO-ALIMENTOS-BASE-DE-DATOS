import { readConfig } from "../config/env.js";
import { createDatabase, type Database } from "../db/database.js";
import { createAdministrator } from "../services/admin-setup.js";
import { adminAuth } from "../setup/auth.js";
import { adminInput } from "../setup/input.js";
import { setupError } from "../setup/errors.js";

let db: Database | undefined;
try {
  const config = readConfig();
  db = createDatabase(config);
  await db.query("select id from app.profiles limit 0");
  const result = await createAdministrator(
    db,
    adminAuth(config),
    await adminInput(),
  );
  console.log(
    `Administrador creado: ${result.email}. Ya puedes iniciar sesión.`,
  );
} catch (error) {
  console.error(setupError(error));
  process.exitCode = 1;
} finally {
  await db?.close();
}
