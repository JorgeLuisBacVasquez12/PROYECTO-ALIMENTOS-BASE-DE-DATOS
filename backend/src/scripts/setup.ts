import { fileURLToPath } from "node:url";
import { frontendEnvironment } from "../setup/frontend.js";
import { recoveryAuth } from "../setup/recovery-auth.js";
import { readConfig } from "../config/env.js";
import type { Database } from "../db/database.js";
import { migrateDatabase } from "../db/migrations.js";
import { createAdministrator } from "../services/admin-setup.js";
import { adminAuth } from "../setup/auth.js";
import { adminInput } from "../setup/input.js";
import { connectForSetup } from "../setup/connection.js";
import { setupError, SetupError } from "../setup/errors.js";

let db: Database | undefined;
try {
  const config = readConfig();
  const input = await adminInput();
  const frontend = frontendEnvironment(
    fileURLToPath(new URL("../../../frontend/", import.meta.url)),
    config.SUPABASE_URL,
  );
  const verifier = recoveryAuth(config, frontend.VITE_SUPABASE_ANON_KEY!);
  db = await connectForSetup(config);
  console.log("Conexión a PostgreSQL verificada.");
  await migrateDatabase(db);
  console.log("Tablas preparadas.");
  const existing = await db.query(
    "select id,role,active from app.profiles where lower(email)=lower($1)",
    [input.email],
  );
  if (existing.rows[0]) {
    if (existing.rows[0].role !== "admin" || !existing.rows[0].active)
      throw new SetupError(
        "El correo ya pertenece a un perfil distinto o desactivado. No se modificó ese perfil.",
      );
    try {
      if (
        (await verifier.verify(input.email, input.password)) !==
        existing.rows[0].id
      )
        throw new Error("Account mismatch");
    } catch {
      throw new SetupError(
        "El administrador existe, pero no se pudo iniciar sesión con ADMIN_PASSWORD. Ejecuta pnpm admin:repair para restablecerla y verificar el acceso.",
      );
    }
    console.log(
      `El administrador ${input.email} ya existe. Acceso verificado.`,
    );
  } else {
    const result = await createAdministrator(db, adminAuth(config), input);
    if ((await verifier.verify(input.email, input.password)) !== result.id)
      throw new SetupError(
        "No se pudo verificar la cuenta. Ejecuta pnpm admin:repair.",
      );
    console.log(`Administrador creado y acceso verificado: ${result.email}`);
  }
  console.log(
    "Configuración finalizada. Ejecuta pnpm dev desde la raíz para iniciar ambos servicios.",
  );
} catch (error) {
  console.error(setupError(error));
  process.exitCode = 1;
} finally {
  await db?.close();
}
