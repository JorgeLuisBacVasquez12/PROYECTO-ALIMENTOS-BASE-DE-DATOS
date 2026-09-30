import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4001),
  HOST: z.string().default("127.0.0.1"),
  FRONTEND_ORIGINS: z.string().min(1),
  DATABASE_URL: z.string().url(),
  DATABASE_SSL: z.enum(["true", "false"]).default("true"),
  DATABASE_SSL_CA: z.string().optional(),
  DATABASE_SSL_CA_FILE: z.string().optional(),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  UPLOAD_MAX_MB: z.coerce.number().int().min(1).max(25).default(10),
  IMPORT_MAX_ROWS: z.coerce.number().int().min(1).max(100000).default(50000),
  IMPORT_MAX_COLUMNS: z.coerce.number().int().min(2).max(200).default(150),
  IMPORT_TTL_MINUTES: z.coerce.number().int().min(5).max(60).default(30),
  REPORT_MAX_ROWS: z.coerce.number().int().min(100).max(100000).default(50000),
  APP_TIMEZONE: z.string().default("America/Guatemala"),
});
export type Config = z.infer<typeof envSchema>;
export function readConfig(): Config {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success)
    throw new Error(
      `Invalid environment variables: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`,
    );
  const config = parsed.data;
  for (const origin of config.FRONTEND_ORIGINS.split(",")) {
    const url = new URL(origin.trim());
    if (
      url.origin !== origin.trim() ||
      !["http:", "https:"].includes(url.protocol)
    )
      throw new Error(
        "FRONTEND_ORIGINS must contain exact origins, without paths.",
      );
    if (config.NODE_ENV === "production" && url.protocol !== "https:")
      throw new Error("Production origins must use HTTPS.");
  }
  if (config.NODE_ENV === "production" && config.DATABASE_SSL !== "true")
    throw new Error("Database TLS is required in production.");
  new Intl.DateTimeFormat("es-GT", { timeZone: config.APP_TIMEZONE });
  return config;
}
