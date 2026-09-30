import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), "VITE_"), ...process.env };
  const key = env.VITE_SUPABASE_ANON_KEY ?? "";
  let role = "";
  try {
    role =
      JSON.parse(Buffer.from(key.split(".")[1] ?? "", "base64url").toString())
        .role ?? "";
  } catch {
    /* Publishable keys are not JWTs. */
  }
  if (key.startsWith("sb_secret_") || role === "service_role")
    throw new Error(
      "VITE_SUPABASE_ANON_KEY must be a PUBLIC publishable/anon key. Backend secrets are forbidden.",
    );
  return {
    plugins: [react()],
    server: { port: 5173, strictPort: true },
    build: { sourcemap: false },
  };
});
