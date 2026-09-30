const env = import.meta.env;
export const config = {
  apiUrl: env.VITE_API_URL?.replace(/\/$/, ""),
  supabaseUrl: env.VITE_SUPABASE_URL,
  supabaseKey: env.VITE_SUPABASE_ANON_KEY,
  organization: env.VITE_ORGANIZATION_NAME || "Municipalidad de Mazatenango",
  shortName: env.VITE_ORGANIZATION_SHORT || "Mazatenango",
  appName: env.VITE_APP_NAME || "Control de entregas",
  logo: env.VITE_LOGO_URL || "",
  timezone: env.VITE_TIMEZONE || "America/Guatemala",
  locale: env.VITE_LOCALE || "es-GT",
  refreshMs: Math.max(5000, Number(env.VITE_FALLBACK_REFRESH_MS) || 15000),
};
export const configured = Boolean(
  config.apiUrl &&
  config.supabaseUrl &&
  config.supabaseKey &&
  !config.supabaseUrl.includes("PROJECT") &&
  !config.supabaseKey.startsWith("REPLACE_"),
);
