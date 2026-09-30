import passwordPrompt from "@inquirer/password";
import { readFileSync, writeFileSync } from "node:fs";
import type { Config } from "../config/env.js";
import { createDatabase, type Database } from "../db/database.js";
import { SetupError } from "./errors.js";

export function withDatabasePassword(connection: string, password: string) {
  const url = new URL(connection);
  url.password = encodeURIComponent(password);
  return url.toString();
}

export async function connectForSetup(config: Config): Promise<Database> {
  let connection = config.DATABASE_URL;
  let needsPassword =
    !new URL(connection).password ||
    /REPLACE_|TU_CONTRASENA|YOUR-PASSWORD/.test(connection);
  for (let attempt = 0; attempt < 3; attempt++) {
    if (needsPassword) {
      console.log(
        "Ingresa la contraseña de la BASE DE DATOS de Supabase. La contraseña del administrador ya está configurada por separado.",
      );
      const password = await passwordPrompt({
        message: "Contraseña de PostgreSQL:",
        validate: (v) => !!v || "Escribe la contraseña de PostgreSQL.",
      });
      connection = withDatabasePassword(config.DATABASE_URL, password);
    }
    const db = createDatabase({ ...config, DATABASE_URL: connection });
    try {
      await db.query("select 1");
    } catch (error) {
      await db.close();
      if ((error as { code?: string }).code !== "28P01") throw error;
      console.error(
        "Supabase rechazó esa contraseña de PostgreSQL. Si no la recuerdas, restablécela en Database Settings > Reset database password. Puedes cancelar con Ctrl+C.",
      );
      needsPassword = true;
      continue;
    }
    try {
      if (connection !== config.DATABASE_URL) {
        const original = readFileSync(".env", "utf8");
        const line = "DATABASE_URL=" + JSON.stringify(connection);
        const updated = /^DATABASE_URL=.*$/m.test(original)
          ? original.replace(/^DATABASE_URL=.*$/m, () => line)
          : original.trimEnd() + "\n" + line + "\n";
        writeFileSync(".env", updated, { mode: 0o600 });
        process.env.DATABASE_URL = connection;
      }
      return db;
    } catch (error) {
      await db.close();
      throw error;
    }
  }
  throw new SetupError(
    "No se validó la contraseña de PostgreSQL. Restablécela en Supabase y vuelve a ejecutar pnpm configurar. No se creó el administrador.",
  );
}
