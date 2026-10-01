import { afterEach, describe, expect, it, vi } from "vitest";
import { repairAdministrator } from "../backend/src/services/admin-recovery";
import { prepareAdminTables } from "../backend/src/setup/admin-tables";
import { testDatabase } from "./helpers/database";

const input = {
  email: "recovery@example.test",
  displayName: "Administrador de prueba",
  password: "Test-only-password.123",
  role: "admin",
};
const id = "b0000000-0000-4000-8000-000000000001";
let database: Awaited<ReturnType<typeof testDatabase>> | undefined;
afterEach(async () => {
  await database?.db.close();
  database = undefined;
});

async function fixture(
  profile?: { role: string; active: boolean },
  account = true,
) {
  database = await testDatabase();
  const { db } = database;
  if (account)
    await db.query("insert into auth.users(id,email) values($1,$2)", [
      id,
      input.email,
    ]);
  if (profile)
    await db.query(
      "insert into app.profiles(id,display_name,role,active) values($1,$2,$3,$4)",
      [id, input.displayName, profile.role, profile.active],
    );
  const auth = {
    find: vi.fn(async () => (account ? { id, email: input.email } : null)),
    create: vi.fn(async () => {
      await db.query("insert into auth.users(id,email) values($1,$2)", [
        id,
        input.email,
      ]);
      return id;
    }),
    remove: vi.fn(async () => {}),
    read: vi.fn(async () => ({ id, email: input.email })),
    reset: vi.fn(async () => {}),
    verify: vi.fn(async () => id),
  };
  return { db, auth };
}

describe("administrator recovery", () => {
  it("accepts the existing schema even when it was installed from SQL Editor", async () => {
    const { db } = await fixture();
    await expect(prepareAdminTables(db)).resolves.toBeUndefined();
    expect(
      (await db.query("select count(*)::int total from auth.users")).rows[0]
        ?.total,
    ).toBe(1);
  });
  it("creates an absent account and verifies its access", async () => {
    const { db, auth } = await fixture(undefined, false);
    expect((await repairAdministrator(db, auth, input)).created).toBe(true);
    expect(auth.create).toHaveBeenCalledWith(input.email, input.password);
    expect(auth.verify).toHaveBeenCalledWith(input.email, input.password);
    expect(
      (await db.query("select role from app.profiles where id=$1", [id]))
        .rows[0]?.role,
    ).toBe("admin");
  });
  it("resets only the existing administrator and keeps its profile", async () => {
    const { db, auth } = await fixture({ role: "admin", active: true });
    expect((await repairAdministrator(db, auth, input)).created).toBe(false);
    expect(auth.create).not.toHaveBeenCalled();
    expect(auth.reset).toHaveBeenCalledWith(id, input.password);
    expect(
      (await db.query("select count(*)::int total from app.profiles")).rows[0]
        ?.total,
    ).toBe(1);
    expect(
      (await db.query("select action from app.audit_log")).rows[0]?.action,
    ).toBe("admin.password_recovery");
  });
  it("repairs the requested Auth account when its profile is absent", async () => {
    const { db, auth } = await fixture();
    await repairAdministrator(db, auth, input);
    expect(auth.reset).toHaveBeenCalledWith(id, input.password);
    expect(
      (await db.query("select role from app.profiles")).rows[0]?.role,
    ).toBe("admin");
  });
  it.each([
    { role: "operator", active: true },
    { role: "admin", active: false },
  ])(
    "preserves a restricted profile: $role active=$active",
    async (profile) => {
      const { db, auth } = await fixture(profile);
      await expect(repairAdministrator(db, auth, input)).rejects.toThrow(
        "No se modificó",
      );
      expect(auth.reset).not.toHaveBeenCalled();
      expect(auth.create).not.toHaveBeenCalled();
    },
  );
  it("stops before changing credentials when Auth and PostgreSQL disagree", async () => {
    const { db, auth } = await fixture({ role: "admin", active: true });
    auth.read.mockResolvedValue({ id, email: "different@example.test" });
    await expect(repairAdministrator(db, auth, input)).rejects.toThrow(
      "no coinciden",
    );
    expect(auth.reset).not.toHaveBeenCalled();
  });
  it("does not claim successful access if the profile was disabled during verification", async () => {
    const { db, auth } = await fixture({ role: "admin", active: true });
    auth.verify.mockImplementation(async () => {
      await db.query("update app.profiles set active=false where id=$1", [id]);
      return id;
    });
    await expect(repairAdministrator(db, auth, input)).rejects.toThrow(
      "perfil administrador activo",
    );
  });
});
