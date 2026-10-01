import { afterAll, beforeAll, describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { createApp } from "../backend/src/app";
import { AppError } from "../backend/src/lib/errors";
import { testDatabase, seed, ids, testConfig } from "./helpers/database";
let database: Awaited<ReturnType<typeof testDatabase>>;
let app: Awaited<ReturnType<typeof createApp>>;
const users = {
  create: vi.fn(async (email: string, _password: string) => {
    const existing = await database.db.query(
      "select id from auth.users where email=$1",
      [email],
    );
    if (existing.rows.length) throw new AppError("USER_CREATE_FAILED", 409);
    const id = randomUUID();
    await database.db.query("insert into auth.users(id,email) values($1,$2)", [
      id,
      email,
    ]);
    return id;
  }),
  remove: vi.fn(async (id: string) => {
    await database.db.query("delete from auth.users where id=$1", [id]);
  }),
  resetPassword: vi.fn(async (_id: string, _password: string) => {}),
};
const payload = (email = `${randomUUID()}@example.test`) => ({
  email,
  displayName: "Operadora de prueba",
  role: "operator",
  password: "Test-password-12345",
});
const request = (
  method: "POST" | "PUT" | "PATCH" | "GET",
  url: string,
  body?: unknown,
  actor = ids.admin,
) =>
  app.inject({
    method,
    url,
    headers: { authorization: `Bearer ${actor}` },
    ...(body === undefined ? {} : { payload: body }),
  });
beforeAll(async () => {
  database = await testDatabase();
  await seed(database.db);
  app = await createApp({
    db: database.db,
    config: testConfig,
    verify: async (id) => id,
    users,
  });
});
afterAll(async () => {
  await app?.close();
  await database?.db.close();
});

describe("administrator access management", () => {
  it("rejects operator account creation and password resets before calling Auth", async () => {
    expect(
      (await request("POST", "/api/users", payload(), ids.a)).statusCode,
    ).toBe(403);
    expect(
      (
        await request(
          "POST",
          `/api/users/${ids.b}/password`,
          { password: "Test-password-12345" },
          ids.a,
        )
      ).statusCode,
    ).toBe(403);
    expect(users.create).not.toHaveBeenCalled();
    expect(users.resetPassword).not.toHaveBeenCalled();
  });
  it("creates only employee accounts from the administration screen API", async () => {
    const response = await request("POST", "/api/users", {
      ...payload(),
      role: "admin",
    });
    expect(response.statusCode).toBe(400);
    expect(users.create).not.toHaveBeenCalled();
  });
  it("creates a normalized account, profile and assignment together", async () => {
    const r = await request("POST", "/api/users", {
      ...payload(" MixedCase@EXAMPLE.TEST "),
      assignment: { campaignId: ids.campaign, pointId: ids.pointB },
    });
    expect(r.statusCode).toBe(201);
    const list = (await request("GET", "/api/users")).json();
    const user = list.find((u: { id: string }) => u.id === r.json().id);
    expect(user.email).toBe("mixedcase@example.test");
    expect(user.assignments[0].point_id).toBe(ids.pointB);
    const bootstrap = await request(
      "GET",
      "/api/bootstrap",
      undefined,
      user.id,
    );
    expect(bootstrap.json().campaigns[0].point_name).toBe("Punto B de prueba");
  });
  it("removes the new Auth account if its requested point is invalid", async () => {
    const body = payload();
    const r = await request("POST", "/api/users", {
      ...body,
      assignment: { campaignId: ids.campaign, pointId: randomUUID() },
    });
    expect(r.statusCode).toBe(400);
    expect(users.remove).toHaveBeenCalled();
    expect(
      (
        await database.db.query("select id from auth.users where email=$1", [
          body.email,
        ])
      ).rows,
    ).toHaveLength(0);
  });
  it("reports duplicate emails without modifying the original profile", async () => {
    const r = await request(
      "POST",
      "/api/users",
      payload("mixedcase@example.test"),
    );
    expect(r.statusCode).toBe(409);
    expect(r.json().code).toBe("USER_CREATE_FAILED");
  });
  it("resets an active user password and never stores it in the audit", async () => {
    const password = "Private-test-password-789";
    expect(
      (await request("POST", `/api/users/${ids.a}/password`, { password }))
        .statusCode,
    ).toBe(200);
    expect(users.resetPassword).toHaveBeenCalledWith(ids.a, password);
    const audit = await database.db.query(
      "select action,detail from app.audit_log where entity_id=$1",
      [ids.a],
    );
    expect(audit.rows.some((r) => r.action === "user.password_reset")).toBe(
      true,
    );
    expect(JSON.stringify(audit.rows)).not.toContain(password);
  });
  it("does not report success or keep a successful audit when Auth rejects a password", async () => {
    users.resetPassword.mockRejectedValueOnce(
      new AppError("PASSWORD_RESET_FAILED", 502),
    );
    const r = await request("POST", `/api/users/${ids.b}/password`, {
      password: "Another-test-password",
    });
    expect(r.statusCode).toBe(502);
    expect(
      (
        await database.db.query(
          "select id from app.audit_log where action='user.password_reset' and entity_id=$1",
          [ids.b],
        )
      ).rows,
    ).toHaveLength(0);
  });
  it("rejects short passwords, extra fields and missing users without changing credentials", async () => {
    const calls = users.resetPassword.mock.calls.length;
    expect(
      (
        await request("POST", `/api/users/${ids.a}/password`, {
          password: "short",
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await request("POST", `/api/users/${ids.a}/password`, {
          password: "Test-password-12345",
          role: "admin",
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await request("POST", `/api/users/${randomUUID()}/password`, {
          password: "Test-password-12345",
        })
      ).statusCode,
    ).toBe(404);
    expect(users.resetPassword.mock.calls).toHaveLength(calls);
  });
  it("requires an active point and refuses assignments to closed campaigns", async () => {
    const closed = await database.db.query(
      "insert into app.campaigns(name,benefit,status,created_by) values('Closed campaign','Test','closed',$1) returning id",
      [ids.admin],
    );
    expect(
      (
        await request(
          "PUT",
          `/api/campaigns/${closed.rows[0]!.id}/assignments`,
          { userId: ids.a, pointId: ids.pointA },
        )
      ).statusCode,
    ).toBe(400);
    await database.db.query("update app.points set active=false where id=$1", [
      ids.pointB,
    ]);
    expect(
      (
        await request("PUT", `/api/campaigns/${ids.campaign}/assignments`, {
          userId: ids.a,
          pointId: ids.pointB,
        })
      ).statusCode,
    ).toBe(400);
    await database.db.query("update app.points set active=true where id=$1", [
      ids.pointB,
    ]);
  });
  it("disabling an account blocks its existing token immediately and keeps its records", async () => {
    expect(
      (await request("PATCH", `/api/users/${ids.b}`, { active: false }))
        .statusCode,
    ).toBe(200);
    expect(
      (await request("GET", "/api/bootstrap", undefined, ids.b)).statusCode,
    ).toBe(403);
    expect(
      (
        await request(
          "POST",
          "/api/lookup",
          { campaignId: ids.campaign, dpi: "9000000000001" },
          ids.b,
        )
      ).statusCode,
    ).toBe(403);
    const calls = users.resetPassword.mock.calls.length;
    expect(
      (
        await request("POST", `/api/users/${ids.b}/password`, {
          password: "Test-password-12345",
        })
      ).statusCode,
    ).toBe(409);
    expect(users.resetPassword.mock.calls).toHaveLength(calls);
    expect(
      (
        await database.db.query(
          "select user_id from app.assignments where user_id=$1",
          [ids.b],
        )
      ).rows,
    ).toHaveLength(1);
    expect(
      (await request("PATCH", `/api/users/${ids.b}`, { active: true }))
        .statusCode,
    ).toBe(200);
    expect(
      (await request("GET", "/api/bootstrap", undefined, ids.b)).statusCode,
    ).toBe(200);
  });
  it("prevents the administrator disabling itself or using the staff reset on itself", async () => {
    expect(
      (await request("PATCH", `/api/users/${ids.admin}`, { active: false }))
        .statusCode,
    ).toBe(400);
    expect(
      (
        await request("POST", `/api/users/${ids.admin}/password`, {
          password: "Test-password-12345",
        })
      ).json().code,
    ).toBe("USE_MY_ACCOUNT");
  });
});
