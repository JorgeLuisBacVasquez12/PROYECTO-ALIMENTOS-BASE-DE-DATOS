import { describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";

const exec = promisify(execFile);
const root = resolve(import.meta.dirname, "..");

describe("administrator repair command", () => {
  it.each([".", "frontend", "backend"])(
    "is available from %s and resolves the same backend configuration",
    async (folder) => {
      const { stdout } = await exec(
        "pnpm",
        ["run", "admin:repair", "--", "--help"],
        { cwd: resolve(root, folder), timeout: 15000 },
      );
      expect(stdout).toContain(
        `Configuración: ${resolve(root, "backend/.env")}`,
      );
      expect(stdout).toContain("ADMIN_EMAIL");
    },
  );
  it("propagates a failed repair so chained startup does not continue", async () => {
    await expect(
      exec("pnpm", ["run", "admin:repair"], {
        cwd: resolve(root, "frontend"),
        timeout: 15000,
        env: {
          ...process.env,
          NODE_ENV: "test",
          DATABASE_URL: "invalid-database-url",
          FRONTEND_ORIGINS: "http://localhost:5173",
          SUPABASE_URL: "http://127.0.0.1:4902",
          SUPABASE_SERVICE_ROLE_KEY: "test-only-no-real-credential",
        },
      }),
    ).rejects.toMatchObject({ code: 1 });
  });
});
