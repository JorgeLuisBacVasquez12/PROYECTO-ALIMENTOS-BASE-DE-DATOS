import { ZodError } from "zod";

export function setupError(error: unknown): string {
  const e = error as { code?: string; name?: string; message?: string };
  if (e.code === "28P01")
    return "Supabase rechazó la contraseña de PostgreSQL de DATABASE_URL. Usa la contraseña de Database Settings; si no la recuerdas, restablécela allí y ejecuta pnpm configurar. Es distinta de la contraseña para entrar al programa.";
  if (
    [
      "SELF_SIGNED_CERT_IN_CHAIN",
      "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
      "DEPTH_ZERO_SELF_SIGNED_CERT",
    ].includes(e.code ?? "")
  )
    return "No se pudo verificar el certificado de PostgreSQL. Revisa DATABASE_SSL_CA o DATABASE_SSL_CA_FILE y conserva DATABASE_SSL=true.";
  if (e.code === "ENOENT")
    return "Falta un archivo de configuración o certificado. Ejecuta el comando desde backend, o pnpm configurar desde la raíz del proyecto.";
  if (
    ["ENOTFOUND", "ETIMEDOUT", "ECONNREFUSED", "ENETUNREACH"].includes(
      e.code ?? "",
    )
  )
    return "No se pudo contactar PostgreSQL. Revisa Internet y la dirección de Session pooler que aparece en Connect de Supabase.";
  if (e.code === "42P01")
    return "Faltan las tablas del programa. Ejecuta pnpm configurar o pnpm db:migrate primero.";
  if (error instanceof ZodError)
    return `Revisa estos datos: ${error.issues.map((i) => i.path.join(".")).join(", ")}. La contraseña del administrador requiere al menos 12 caracteres.`;
  if (e.name === "ExitPromptError" || e.name === "AbortPromptError")
    return "Configuración cancelada.";
  return error instanceof SetupError
    ? error.message
    : "No se completó la configuración. Revisa los datos de backend/.env y vuelve a intentarlo.";
}

export class SetupError extends Error {}
