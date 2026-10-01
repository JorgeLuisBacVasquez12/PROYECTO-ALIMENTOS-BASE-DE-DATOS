import type { FastifyInstance } from "fastify";
import {
  deliverySchema,
  lookupSchema,
  uuid,
  type Person,
  type Delivery,
} from "@mazate/contracts";
import { z } from "zod";
import type { Database } from "../db/database.js";
import { assertCampaign } from "../services/access.js";
import { requireAdmin } from "../middleware/auth.js";
export function deliveryRoutes(app: FastifyInstance, db: Database) {
  app.post("/api/lookup", async (request) => {
    const { campaignId, dpi } = lookupSchema.parse(request.body);
    await assertCampaign(db, request.profile, campaignId);
    const found = await db.query<Person>(
      "select p.id,p.dpi,cp.full_name,cp.sector,cp.age from app.people p join app.campaign_people cp on cp.person_id=p.id where cp.campaign_id=$1 and p.dpi=$2",
      [campaignId, dpi],
    );
    const person = found.rows[0];
    if (!person) return { state: "not_found", person: null, delivery: null };
    const delivery = await db.query<Delivery>(
      "select id,person_id,campaign_id,dpi,recipient_name,point_name,operator_name,delivered_at,voided_at from app.deliveries where campaign_id=$1 and person_id=$2 and voided_at is null",
      [campaignId, person.id],
    );
    return {
      state: delivery.rows[0] ? "delivered" : "available",
      person,
      delivery: delivery.rows[0] ?? null,
    };
  });
  app.post("/api/deliveries", async (request, reply) => {
    const { campaignId, dpi, requestId } = deliverySchema.parse(request.body);
    const result = await db.query(
      "select app.register_delivery($1,$2,$3,$4) as result",
      [request.profile.id, campaignId, dpi, requestId],
    );
    const value = result.rows[0]!.result;
    reply.code(
      value.outcome === "already_delivered"
        ? 409
        : value.outcome === "registered"
          ? 201
          : 200,
    );
    return value;
  });
  app.post("/api/deliveries/:id/void", async (request) => {
    requireAdmin(request.profile);
    const id = uuid.parse((request.params as { id: string }).id);
    const { reason } = z
      .object({ reason: z.string().trim().min(10).max(500) })
      .strict()
      .parse(request.body);
    await db.query("select app.void_delivery($1,$2,$3)", [
      request.profile.id,
      id,
      reason,
    ]);
    return { ok: true };
  });
  app.get("/api/campaigns/:id/activity", async (request) => {
    const id = uuid.parse((request.params as { id: string }).id);
    await assertCampaign(db, request.profile, id);
    return (
      await db.query<Delivery>(
        "select id,person_id,campaign_id,dpi,recipient_name,point_name,operator_name,delivered_at,voided_at from app.deliveries where campaign_id=$1 and voided_at is null and ($2::boolean or operator_id=$3) order by delivered_at desc limit 8",
        [id, request.profile.role === "admin", request.profile.id],
      )
    ).rows;
  });
}
