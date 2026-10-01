import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { createApp } from "../backend/src/app";
import { testDatabase, seed, ids, testConfig } from "./helpers/database";
let database: Awaited<ReturnType<typeof testDatabase>>;
let app: Awaited<ReturnType<typeof createApp>>;
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
const confirm = (
  campaignId: string,
  actor: string,
  dpi = "9000000000001",
  requestId = randomUUID(),
) => request("POST", "/api/deliveries", { campaignId, dpi, requestId }, actor);
let pizza: string;
beforeAll(async () => {
  database = await testDatabase();
  await seed(database.db);
  await database.db.query(
    "update app.campaign_people set sector=case when full_name like '%1' then 'Norte' else 'Centro' end,age=case when full_name like '%1' then 64 when full_name like '%2' then 18 else null end",
  );
  app = await createApp({
    db: database.db,
    config: testConfig,
    verify: async (id) => id,
  });
});
afterAll(async () => {
  await app?.close();
  await database?.db.close();
});
describe("assigned jornadas from HTTP to PostgreSQL", () => {
  it("copies the roster, requires setup, atomically assigns a batch and enables a jornada", async () => {
    const created = await request("POST", "/api/campaigns", {
      name: "Pizza · Prueba",
      benefit: "Pizza",
      rosterSourceId: ids.campaign,
    });
    expect(created.statusCode).toBe(201);
    pizza = created.json().id;
    expect(
      (
        await request("PATCH", `/api/campaigns/${pizza}/status`, {
          status: "active",
        })
      ).json().code,
    ).toBe("CAMPAIGN_SETUP_REQUIRED");
    const invalid = await request(
      "PUT",
      `/api/campaigns/${pizza}/assignments`,
      {
        assignments: [
          { userId: ids.a, pointId: ids.pointA },
          { userId: ids.b, pointId: randomUUID() },
        ],
      },
    );
    expect(invalid.statusCode).toBe(400);
    expect(
      (await request("GET", `/api/campaigns/${pizza}/assignments`)).json(),
    ).toHaveLength(0);
    expect(
      (
        await request("PUT", `/api/campaigns/${pizza}/assignments`, {
          assignments: [
            { userId: ids.a, pointId: ids.pointA },
            { userId: ids.b, pointId: ids.pointB },
          ],
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await request("POST", `/api/campaigns/${pizza}/shift/close`, {}, ids.a)
      ).json().code,
    ).toBe("CAMPAIGN_NOT_ACTIVE");
    expect(
      (
        await request("PATCH", `/api/campaigns/${pizza}/status`, {
          status: "active",
        })
      ).statusCode,
    ).toBe(200);
    const roster = (
      await request(
        "GET",
        `/api/campaigns/${pizza}/report?sector=Norte&ageMin=60&ageMax=70`,
      )
    ).json();
    expect(roster.total).toBe(1);
    expect(roster.rows[0]).toMatchObject({
      sector: "Norte",
      age: 64,
      dpi: "9000000000001",
    });
  });
  it("blocks duplicates across points in one jornada, but permits the same DPI in another", async () => {
    expect((await confirm(ids.campaign, ids.a)).statusCode).toBe(201);
    const first = await confirm(pizza, ids.a);
    expect(first.statusCode).toBe(201);
    const duplicate = await confirm(pizza, ids.b);
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json()).toMatchObject({
      outcome: "already_delivered",
      delivery: {
        id: first.json().delivery.id,
        operator_id: ids.a,
        point_id: ids.pointA,
      },
    });
    const history = (
      await request("GET", `/api/history?campaignId=${pizza}&kind=delivery`)
    ).json();
    expect(history.total).toBe(1);
    expect(history.rows[0]).toMatchObject({
      action: "delivery.register",
      recipient_name: "Persona de prueba 1",
      dpi: "9000000000001",
      actor: "Operadora A de prueba",
      point_name: "Punto A de prueba",
    });
    expect(Date.parse(history.rows[0].created_at)).not.toBeNaN();
  });
  it("closes only the caller's shift, records it once, and lets other assigned employees continue", async () => {
    const closed = await request(
      "POST",
      `/api/campaigns/${pizza}/shift/close`,
      { userId: ids.b },
      ids.a,
    );
    expect(closed.statusCode).toBe(200);
    const replay = await request(
      "POST",
      `/api/campaigns/${pizza}/shift/close`,
      {},
      ids.a,
    );
    expect(replay.json().closed_at).toBe(closed.json().closed_at);
    expect((await confirm(pizza, ids.a, "9000000000002")).json().code).toBe(
      "SHIFT_CLOSED",
    );
    expect(
      (
        await request(
          "POST",
          "/api/lookup",
          { campaignId: pizza, dpi: "9000000000002" },
          ids.a,
        )
      ).statusCode,
    ).toBe(403);
    expect((await confirm(pizza, ids.b, "9000000000002")).statusCode).toBe(201);
    const assigned = (
      await request("GET", `/api/campaigns/${pizza}/assignments`)
    ).json();
    expect(
      assigned.find((r: { user_id: string }) => r.user_id === ids.a),
    ).toMatchObject({ closed_by_name: "Operadora A de prueba", delivered: 1 });
    expect(
      assigned.find((r: { user_id: string }) => r.user_id === ids.b).closed_at,
    ).toBeNull();
    const history = (
      await request("GET", `/api/history?campaignId=${pizza}&kind=closure`)
    ).json();
    expect(history.total).toBe(1);
    expect(history.rows[0]).toMatchObject({
      action: "shift.close",
      actor: "Operadora A de prueba",
      point_name: "Punto A de prueba",
      detail: { userId: ids.a, employeeName: "Operadora A de prueba" },
    });
    expect(
      (
        await request(
          "POST",
          `/api/campaigns/${pizza}/shift/close`,
          {},
          ids.other,
        )
      ).statusCode,
    ).toBe(403);
  });
  it("allows the administrator to reopen an individual shift without resetting deliveries", async () => {
    expect(
      (
        await request("PUT", `/api/campaigns/${pizza}/assignments`, {
          userId: ids.a,
          pointId: ids.pointB,
        })
      ).statusCode,
    ).toBe(200);
    expect((await confirm(pizza, ids.a)).json().outcome).toBe(
      "already_delivered",
    );
    expect((await confirm(pizza, ids.a, "9000000000003")).statusCode).toBe(201);
    const history = (
      await request("GET", `/api/history?campaignId=${pizza}&q=9000000000001`)
    ).json();
    expect(history.rows[0].point_name).toBe("Punto A de prueba");
  });
  it("filters received and pending by sector and age, rejects invalid ranges and protects admin data", async () => {
    const delivered = (
      await request(
        "GET",
        `/api/campaigns/${pizza}/report?status=delivered&sector=Norte&ageMin=60&ageMax=70`,
      )
    ).json();
    expect(delivered.total).toBe(1);
    const pending = (
      await request(
        "GET",
        `/api/campaigns/${pizza}/report?status=pending&sector=Centro`,
      )
    ).json();
    expect(pending.total).toBe(2);
    expect(
      pending.rows.every((r: { delivery_id: unknown }) => !r.delivery_id),
    ).toBe(true);
    expect(
      (
        await request(
          "GET",
          `/api/campaigns/${pizza}/report?ageMin=70&ageMax=60`,
        )
      ).statusCode,
    ).toBe(400);
    expect(
      (await request("GET", `/api/campaigns/${pizza}/report-options`)).json(),
    ).toEqual({ sectors: ["Centro", "Norte"] });
    for (const url of [
      "/api/users",
      "/api/history",
      `/api/campaigns/${pizza}/report`,
      `/api/campaigns/${pizza}/report-options`,
      `/api/campaigns/${pizza}/assignments`,
    ])
      expect((await request("GET", url, undefined, ids.a)).statusCode).toBe(
        403,
      );
    expect(
      (
        await request(
          "POST",
          "/api/lookup",
          { campaignId: pizza, dpi: "9999999999999" },
          ids.a,
        )
      ).json().state,
    ).toBe("not_found");
  });
  it("global closure closes open shifts, preserves audit entries and reopening preserves duplicate protection", async () => {
    expect(
      (
        await request(
          "PATCH",
          `/api/campaigns/${pizza}/status`,
          { status: "closed" },
          ids.a,
        )
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await request("PATCH", `/api/campaigns/${pizza}/status`, {
          status: "closed",
        })
      ).statusCode,
    ).toBe(200);
    const shifts = (
      await request("GET", `/api/campaigns/${pizza}/assignments`)
    ).json();
    expect(
      shifts.every(
        (s: { closed_at: unknown; closed_by_name: string }) =>
          s.closed_at && s.closed_by_name === "Administración de prueba",
      ),
    ).toBe(true);
    expect((await confirm(pizza, ids.b, "9000000000004")).statusCode).toBe(409);
    const history = (
      await request("GET", `/api/history?campaignId=${pizza}&kind=closure`)
    ).json();
    expect(history.total).toBe(4);
    expect(
      history.rows.filter(
        (e: { action: string }) => e.action === "campaign.status",
      ),
    ).toHaveLength(1);
    await request("PATCH", `/api/campaigns/${pizza}/status`, {
      status: "closed",
    });
    expect(
      (
        await request("GET", `/api/history?campaignId=${pizza}&kind=closure`)
      ).json().total,
    ).toBe(4);
    expect(
      (
        await request("PATCH", `/api/campaigns/${pizza}/status`, {
          status: "active",
        })
      ).statusCode,
    ).toBe(200);
    expect((await confirm(pizza, ids.b)).json().outcome).toBe(
      "already_delivered",
    );
    expect((await confirm(pizza, ids.b, "9000000000004")).statusCode).toBe(201);
  });
  it("serializes a shift close and delivery so no delivery is recorded after its closure", async () => {
    const [delivery, closure] = await Promise.all([
      confirm(pizza, ids.a, "9000000000005"),
      request("POST", `/api/campaigns/${pizza}/shift/close`, {}, ids.a),
    ]);
    expect(closure.statusCode).toBe(200);
    expect([201, 409]).toContain(delivery.statusCode);
    if (delivery.statusCode === 201)
      expect(
        new Date(delivery.json().delivery.delivered_at).getTime(),
      ).toBeLessThanOrEqual(new Date(closure.json().closed_at).getTime());
    expect((await confirm(pizza, ids.a, "9000000000005")).json().code).toBe(
      "SHIFT_CLOSED",
    );
  });
});
