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
  db = await connectForSetup(config);
  console.log("Conexión a PostgreSQL verificada.");
  await migrateDatabase(db);
  console.log("Tablas preparadas.");
  const existing = await db.query(
    "select p.role,p.active from app.profiles p join auth.users u on u.id=p.id where lower(u.email)=lower($1)",
    [input.email],
  );
  if (existing.rows[0]) {
    if (existing.rows[0].role !== "admin" || !existing.rows[0].active)
      throw new SetupError(
        "El correo ya pertenece a un perfil distinto o desactivado. No se modificó ese perfil.",
      );
    console.log(
      `El administrador ${input.email} ya existe. Conserva su contraseña actual; la configuración no la cambió.`,
    );
  } else {
    const result = await createAdministrator(db, adminAuth(config), input);
    console.log(`Administrador creado: ${result.email}`);
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
