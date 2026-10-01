import { it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { testDatabase, seed, ids, testConfig } from "./helpers/database";
import { createApp } from "../backend/src/app";

it("upgrades existing records and supports the marked private backend role while keeping browser roles isolated", async () => {
  const { db, pg } = await testDatabase({ applyMigrations: false });
  let app: Awaited<ReturnType<typeof createApp>> | undefined;
  try {
    await pg.exec(await readFile("database/migrations/001_schema.sql", "utf8"));
    await pg.exec(
      await readFile("database/migrations/002_delivery.sql", "utf8"),
    );
    await seed(db);
    await db.query(
      "update auth.users set email='existing@example.test' where id=$1",
      [ids.a],
    );
    await db.query("select app.register_delivery($1,$2,$3,$4)", [
      ids.a,
      ids.campaign,
      "9000000000001",
      "00000000-0000-4000-8000-000000000099",
    ]);
    await pg.exec(
      "create role mazate_app_test login noinherit nosuperuser nobypassrls; comment on role mazate_app_test is 'mazate-local-recovery:test'; create role mazate_app_unmarked login noinherit nosuperuser nobypassrls; alter table auth.users enable row level security",
    );
    await pg.exec(
      await readFile(
        "database/migrations/20260930215449_jornadas_operacion.sql",
        "utf8",
      ),
    );
    expect(
      (await db.query("select email from app.profiles where id=$1", [ids.a]))
        .rows[0]!.email,
    ).toBe("existing@example.test");
    expect(
      (await db.query("select count(*)::int n from app.deliveries")).rows[0]!.n,
    ).toBe(1);
    const grants = (
      await db.query(
        "select has_schema_privilege('anon','app','usage') anon,has_schema_privilege('authenticated','app','usage') authenticated,has_schema_privilege('mazate_app_unmarked','app','usage') unmarked,has_table_privilege('mazate_app_test','auth.users','select') auth_read",
      )
    ).rows[0];
    expect(grants).toEqual({
      anon: false,
      authenticated: false,
      unmarked: false,
      auth_read: false,
    });
    await pg.exec("set role mazate_app_test");
    app = await createApp({ db, config: testConfig, verify: async (id) => id });
    const req = (method: "GET" | "POST", url: string, payload?: unknown) =>
      app!.inject({
        method,
        url,
        headers: { authorization: `Bearer ${ids.admin}` },
        ...(payload ? { payload } : {}),
      });
    expect((await req("GET", "/api/bootstrap")).statusCode).toBe(200);
    expect(
      (await req("GET", "/api/users"))
        .json()
        .find((u: { id: string }) => u.id === ids.a).email,
    ).toBe("existing@example.test");
    expect(
      (
        await req("POST", "/api/campaigns", {
          name: "Private role jornada",
          benefit: "Pollo",
          rosterSourceId: ids.campaign,
        })
      ).statusCode,
    ).toBe(201);
    const delivery = await req("POST", "/api/deliveries", {
      campaignId: ids.campaign,
      dpi: "9000000000002",
      requestId: "00000000-0000-4000-8000-000000000098",
    });
    expect(delivery.statusCode).toBe(201);
    expect(
      (
        await req(
          "POST",
          `/api/deliveries/${delivery.json().delivery.id}/void`,
          { reason: "Correction in isolated test" },
        )
      ).statusCode,
    ).toBe(200);
    expect((await req("GET", "/api/history")).json().total).toBe(3);
    expect(
      (await req("POST", `/api/campaigns/${ids.campaign}/shift/close`, {}))
        .statusCode,
    ).toBe(200);
    expect(
      (await req("GET", `/api/campaigns/${ids.campaign}/report`)).json().total,
    ).toBe(5);
  } finally {
    await app?.close();
    await pg.exec("reset role");
    await db.close();
  }
}, 30000);
