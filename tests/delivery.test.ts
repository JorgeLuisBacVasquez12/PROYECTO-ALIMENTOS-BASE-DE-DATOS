import { afterAll, beforeAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { createApp } from "../backend/src/app";
import { testDatabase, seed, ids, testConfig } from "./helpers/database";
let database: Awaited<ReturnType<typeof testDatabase>>;
let app: Awaited<ReturnType<typeof createApp>>;
const headers = (id: string) => ({ authorization: `Bearer ${id}` });
const confirm = (actor: string, dpi: string, requestId = randomUUID()) =>
  app.inject({
    method: "POST",
    url: "/api/deliveries",
    headers: headers(actor),
    payload: { campaignId: ids.campaign, dpi, requestId },
  });
beforeAll(async () => {
  database = await testDatabase();
  await seed(database.db);
  app = await createApp({
    db: database.db,
    config: testConfig,
    verify: async (token) =>
      Object.values(ids).includes(token) ? token : null,
    users: {
      create: async () => randomUUID(),
      remove: async () => {},
      resetPassword: async () => {},
    },
  });
});
afterAll(async () => {
  await app?.close();
  await database?.db.close();
});
describe("Real SQL behind HTTP routes (embedded PostgreSQL)", () => {
  it("denies unauthenticated access and operator administration", async () => {
    expect((await app.inject({ url: "/api/bootstrap" })).statusCode).toBe(401);
    expect(
      (await app.inject({ url: "/api/users", headers: headers(ids.a) }))
        .statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          url: `/api/campaigns/${ids.campaign}/report`,
          headers: headers(ids.a),
        })
      ).statusCode,
    ).toBe(403);
  });
  it("lookup never creates a delivery and enforces campaign membership", async () => {
    for (const actor of [ids.a, ids.b]) {
      const r = await app.inject({
        method: "POST",
        url: "/api/lookup",
        headers: headers(actor),
        payload: { campaignId: ids.campaign, dpi: "9000 00000 0001" },
      });
      expect(r.statusCode).toBe(200);
      expect(r.json().state).toBe("available");
    }
    expect(
      (await database.db.query("select count(*)::int n from app.deliveries"))
        .rows[0]!.n,
    ).toBe(0);
    expect((await confirm(ids.other, "9000000000001")).statusCode).toBe(403);
  });
  it("30 concurrent HTTP confirmations across two points produce one delivery", async () => {
    const results = await Promise.all(
      Array.from({ length: 30 }, (_, i) =>
        confirm(i % 2 ? ids.a : ids.b, "9000000000001"),
      ),
    );
    expect(results.filter((r) => r.statusCode === 201)).toHaveLength(1);
    expect(results.filter((r) => r.statusCode === 409)).toHaveLength(29);
    const receipts = results.map((r) => r.json().delivery);
    expect(new Set(receipts.map((r) => r.id)).size).toBe(1);
    expect(receipts[0].point_name).toMatch(/Punto [AB]/);
    expect(
      (await database.db.query("select count(*)::int n from app.deliveries"))
        .rows[0]!.n,
    ).toBe(1);
    expect(
      (
        await database.db.query(
          "select count(*)::int n from public.delivery_events",
        )
      ).rows[0]!.n,
    ).toBe(1);
  });
  it("retries are idempotent and cannot be reused for another DPI", async () => {
    const request = randomUUID();
    const first = await confirm(ids.a, "9000000000002", request);
    expect(first.statusCode).toBe(201);
    const repeated = await confirm(ids.a, "9000000000002", request);
    expect(repeated.json().outcome).toBe("replayed");
    expect(repeated.json().delivery.id).toBe(first.json().delivery.id);
    expect((await confirm(ids.a, "9000000000003", request)).json().code).toBe(
      "IDEMPOTENCY_MISMATCH",
    );
  });
  it("does not allow role spoofing, unknown people or delivery in a closed campaign", async () => {
    const spoof = await app.inject({
      method: "POST",
      url: "/api/deliveries",
      headers: headers(ids.a),
      payload: {
        campaignId: ids.campaign,
        dpi: "9000000000003",
        requestId: randomUUID(),
        pointId: ids.pointB,
      },
    });
    expect(spoof.statusCode).toBe(400);
    expect((await confirm(ids.a, "9999999999999")).json().code).toBe(
      "NOT_ELIGIBLE",
    );
    await database.db.query(
      "update app.campaigns set status='closed' where id=$1",
      [ids.campaign],
    );
    expect((await confirm(ids.a, "9000000000003")).json().code).toBe(
      "CAMPAIGN_NOT_ACTIVE",
    );
    await database.db.query(
      "update app.campaigns set status='active' where id=$1",
      [ids.campaign],
    );
  });
  it("audited voids preserve the original, invalidate retry and allow a new delivery", async () => {
    const request = randomUUID();
    const first = (await confirm(ids.a, "9000000000003", request)).json();
    const route = `/api/deliveries/${first.delivery.id}/void`;
    expect(
      (
        await app.inject({
          method: "POST",
          url: route,
          headers: headers(ids.b),
          payload: { reason: "Error de prueba documentado" },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: "POST",
          url: route,
          headers: headers(ids.admin),
          payload: { reason: "Error de prueba documentado" },
        })
      ).statusCode,
    ).toBe(200);
    expect((await confirm(ids.a, "9000000000003", request)).json().code).toBe(
      "DELIVERY_VOIDED",
    );
    expect((await confirm(ids.b, "9000000000003")).statusCode).toBe(201);
    const count = await database.db.query(
      "select count(*)::int n from app.deliveries where dpi='9000000000003'",
    );
    expect(count.rows[0]!.n).toBe(2);
  });
  it("filters reports, rejects SQL injection as data and exports typed Excel", async () => {
    const r = await app.inject({
      url: `/api/campaigns/${ids.campaign}/report?status=delivered`,
      headers: headers(ids.admin),
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().total).toBe(3);
    expect(r.json().stats.pending).toBe(2);
    const injection = await app.inject({
      url: `/api/campaigns/${ids.campaign}/report?q=${encodeURIComponent("' OR 1=1 --")}`,
      headers: headers(ids.admin),
    });
    expect(injection.json().total).toBe(0);
    const exported = await app.inject({
      url: `/api/campaigns/${ids.campaign}/export`,
      headers: headers(ids.admin),
    });
    expect(exported.statusCode).toBe(200);
    expect(exported.headers["content-type"]).toContain("spreadsheetml");
    const { default: ExcelJS } = await import("exceljs");
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(exported.rawPayload);
    const sheet = book.worksheets[0]!;
    expect(sheet.getCell("A2").type).toBe(3);
    expect(sheet.autoFilter).toBeTruthy();
    expect(sheet.getCell("H2").value).toBe("=2+2");
  });
  it("revokes disabled users and conceals private tables from client roles", async () => {
    await database.db.query(
      "update app.profiles set active=false where id=$1",
      [ids.b],
    );
    expect((await confirm(ids.b, "9000000000004")).statusCode).toBe(403);
    const grants = await database.db.query(
      "select has_schema_privilege('authenticated','app','USAGE') access,has_function_privilege('authenticated','app.register_delivery(uuid,uuid,text,uuid)','EXECUTE') execute",
    );
    expect(grants.rows[0]).toEqual({ access: false, execute: false });
  });
});
