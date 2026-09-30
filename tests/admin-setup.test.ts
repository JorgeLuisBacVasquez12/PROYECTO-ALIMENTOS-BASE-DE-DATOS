import { afterEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import { createAdministrator } from "../backend/src/services/admin-setup";
import { withDatabasePassword } from "../backend/src/setup/connection";
import { setupError } from "../backend/src/setup/errors";
import { testDatabase } from "./helpers/database";
import { migrateDatabase } from "../backend/src/db/migrations";
import type { Database } from "../backend/src/db/database";

const input = {
  email: "admin@example.test",
  displayName: "Administrador de prueba",
  password: "Only-for-tests-12345",
  role: "admin",
};
const id = "a0000000-0000-4000-8000-000000000001";
let database: Awaited<ReturnType<typeof testDatabase>> | undefined;
afterEach(async () => {
  await database?.db.close();
  database = undefined;
});

describe("administrator setup", () => {
  it("prepares a fresh database and can rerun migrations without duplicating them", async () => {
    database = await testDatabase({ applyMigrations: false });
    expect(await migrateDatabase(database.db)).toEqual([
      "001_schema.sql",
      "002_delivery.sql",
    ]);
    expect(await migrateDatabase(database.db)).toEqual([]);
    const auth = {
      create: vi.fn(async () => {
        await database!.db.query("insert into auth.users(id) values($1)", [id]);
        return id;
      }),
      remove: vi.fn(async () => {}),
    };
    await createAdministrator(database.db, auth, input);
    expect(
      (await database.db.query("select count(*)::int total from app.profiles"))
        .rows[0]?.total,
    ).toBe(1);
  });
  it("creates a real profile and audit entry after Auth succeeds", async () => {
    database = await testDatabase();
    const db = database.db;
    const auth = {
      create: vi.fn(async () => {
        await db.query("insert into auth.users(id) values($1)", [id]);
        return id;
      }),
      remove: vi.fn(async () => {}),
    };
    await createAdministrator(db, auth, input);
    expect(
      (await db.query("select role,active from app.profiles where id=$1", [id]))
        .rows[0],
    ).toEqual({ role: "admin", active: true });
    expect(
      (
        await db.query("select action from app.audit_log where actor_id=$1", [
          id,
        ])
      ).rows[0]?.action,
    ).toBe("admin.bootstrap");
    expect(auth.remove).not.toHaveBeenCalled();
  });

  it("does not create an Auth user when PostgreSQL rejects the password", async () => {
    const error = Object.assign(new Error("password authentication failed"), {
      code: "28P01",
    });
    const db = {
      query: vi.fn().mockRejectedValue(error),
    } as unknown as Database;
    const auth = { create: vi.fn(), remove: vi.fn() };
    await expect(createAdministrator(db, auth, input)).rejects.toBe(error);
    expect(auth.create).not.toHaveBeenCalled();
    expect(setupError(error)).toContain("contraseña de PostgreSQL");
  });

  it("removes only the newly created Auth user if the profile transaction fails", async () => {
    const error = new Error("storage failed");
    const db = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
      transaction: vi.fn().mockRejectedValue(error),
    } as unknown as Database;
    const auth = {
      create: vi.fn().mockResolvedValue(id),
      remove: vi.fn().mockResolvedValue(undefined),
    };
    await expect(createAdministrator(db, auth, input)).rejects.toBe(error);
    expect(auth.remove).toHaveBeenCalledWith(id);
  });

  it("passes passwords containing URL delimiters intact to node-postgres", () => {
    const require = createRequire(
      new URL("../backend/package.json", import.meta.url),
    );
    const { Client } = require("pg");
    const password = "Test @/#?%:+=\\$12345";
    const connection = withDatabasePassword(
      "postgresql://postgres.project:placeholder@pooler.example.test:5432/postgres",
      password,
    );
    const client = new Client({ connectionString: connection });
    expect(client.connectionParameters.password).toBe(password);
    expect(client.connectionParameters.user).toBe("postgres.project");
  });
});
