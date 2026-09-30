import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "dotenv";
import { SetupError } from "./errors.js";
export function frontendEnvironment(directory: string, backendUrl: string) {
  const values: Record<string, string> = {};
  for (const name of [
    ".env",
    ".env.local",
    ".env.development",
    ".env.development.local",
  ]) {
    const path = resolve(directory, name);
    if (existsSync(path)) Object.assign(values, parse(readFileSync(path)));
  }
  for (const name of ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"])
    if (process.env[name]) values[name] = process.env[name];
  if (
    values.VITE_SUPABASE_URL &&
    new URL(values.VITE_SUPABASE_URL).origin !== new URL(backendUrl).origin
  )
    throw new SetupError(
      "Frontend y backend apuntan a proyectos Supabase distintos. Iguala VITE_SUPABASE_URL con SUPABASE_URL y reinicia el frontend.",
    );
  if (!values.VITE_SUPABASE_URL || !values.VITE_SUPABASE_ANON_KEY)
    throw new SetupError(
      "Falta VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en frontend/.env para verificar el acceso.",
    );
  return values;
}
