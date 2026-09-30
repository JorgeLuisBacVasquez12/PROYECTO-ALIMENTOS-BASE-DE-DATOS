import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { frontendEnvironment } from "../backend/src/setup/frontend";

let directory: string;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "mazate-frontend-env-"));
  vi.stubEnv("FRONTEND_MODE", "");
  vi.stubEnv("VITE_SUPABASE_URL", "");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
  writeFileSync(
    join(directory, ".env"),
    "VITE_SUPABASE_URL=https://generic.example.test\nVITE_SUPABASE_ANON_KEY=generic-key\n",
  );
  writeFileSync(
    join(directory, ".env.local"),
    "VITE_SUPABASE_ANON_KEY=generic-local-key\n",
  );
  for (const mode of ["development", "production", "staging"]) {
    writeFileSync(
      join(directory, `.env.${mode}`),
      `VITE_SUPABASE_URL=https://${mode}.example.test\nVITE_SUPABASE_ANON_KEY=${mode}-key\n`,
    );
    writeFileSync(
      join(directory, `.env.${mode}.local`),
      `VITE_SUPABASE_ANON_KEY=${mode}-local-key\n`,
    );
  }
});
afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(directory, { recursive: true, force: true });
});

describe("frontend configuration for administrator recovery", () => {
  it.each([
    { nodeEnv: "development", explicitMode: "", expectedMode: "development" },
    { nodeEnv: "production", explicitMode: "", expectedMode: "production" },
    { nodeEnv: "production", explicitMode: "staging", expectedMode: "staging" },
  ])(
    "uses $expectedMode files with NODE_ENV=$nodeEnv and FRONTEND_MODE=$explicitMode",
    ({ nodeEnv, explicitMode, expectedMode }) => {
      vi.stubEnv("NODE_ENV", nodeEnv);
      vi.stubEnv("FRONTEND_MODE", explicitMode);
      const url = `https://${expectedMode}.example.test`;
      expect(frontendEnvironment(directory, url)).toMatchObject({
        VITE_SUPABASE_URL: url,
        VITE_SUPABASE_ANON_KEY: `${expectedMode}-local-key`,
      });
    },
  );
  it("gives terminal values priority over all mode files", () => {
    vi.stubEnv("FRONTEND_MODE", "production");
    vi.stubEnv("VITE_SUPABASE_URL", "https://override.example.test");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "override-key");
    expect(
      frontendEnvironment(directory, "https://override.example.test"),
    ).toMatchObject({
      VITE_SUPABASE_URL: "https://override.example.test",
      VITE_SUPABASE_ANON_KEY: "override-key",
    });
  });
  it("rejects a project mismatch in the selected mode", () => {
    vi.stubEnv("FRONTEND_MODE", "production");
    expect(() =>
      frontendEnvironment(directory, "https://development.example.test"),
    ).toThrow("proyectos Supabase distintos");
  });
});
