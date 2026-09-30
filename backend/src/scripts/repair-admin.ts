import { fileURLToPath } from "node:url";
import { readConfig } from "../config/env.js";
import type { Database } from "../db/database.js";
import { repairAdministrator } from "../services/admin-recovery.js";
import { recoveryAuth } from "../setup/recovery-auth.js";
import { frontendEnvironment } from "../setup/frontend.js";
import { prepareAdminTables } from "../setup/admin-tables.js";
import { adminInput } from "../setup/input.js";
import { connectForSetup } from "../setup/connection.js";
import { setupError } from "../setup/errors.js";

let db: Database | undefined;
try {
  const config = readConfig();
  const frontend = frontendEnvironment(
    fileURLToPath(new URL("../../../frontend/", import.meta.url)),
    config.SUPABASE_URL,
  );
  const input = await adminInput();
  db = await connectForSetup(config);
  await prepareAdminTables(db);
  const result = await repairAdministrator(
    db,
    recoveryAuth(config, frontend.VITE_SUPABASE_ANON_KEY!),
    input,
  );
  console.log(`ACCESO VERIFICADO: ${result.email}`);
  console.log(
    result.created
      ? "Administrador creado."
      : "Contraseña del administrador actualizada.",
  );
  console.log(
    "Inicia sesión con el correo y la contraseña que acabas de configurar.",
  );
} catch (error) {
  console.error(setupError(error));
  process.exitCode = 1;
} finally {
  await db?.close();
}
