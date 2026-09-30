import type { FastifyInstance } from "fastify";
import { assignmentSchema, campaignSchema, uuid } from "@mazate/contracts";
import { z } from "zod";
import type { Database } from "../db/database.js";
import { requireAdmin } from "../middleware/auth.js";
import { audit, lockAdmin } from "../services/access.js";
import { AppError } from "../lib/errors.js";
export function campaignRoutes(app: FastifyInstance, db: Database) {
  app.get("/api/bootstrap", async (request) => {
    const [campaigns, points] = await Promise.all([
      db.query(
        "select c.*,a.point_id,p.name point_name from app.campaigns c left join app.assignments a on a.campaign_id=c.id and a.user_id=$1 left join app.points p on p.id=a.point_id where $2::boolean or a.user_id=$1 order by c.created_at desc",
        [request.profile.id, request.profile.role === "admin"],
      ),
      db.query(
        "select id,name,active from app.points where $1::boolean order by name",
        [request.profile.role === "admin"],
      ),
    ]);
    return {
      profile: request.profile,
      campaigns: campaigns.rows,
      points: points.rows,
    };
  });
  app.post("/api/campaigns", async (request, reply) => {
    requireAdmin(request.profile);
    const body = campaignSchema.parse(request.body);
    const campaign = await db.transaction(async (tx) => {
      await lockAdmin(tx, request.profile.id);
      const r = await tx.query(
        "insert into app.campaigns(name,benefit,created_by) values($1,$2,$3) returning *",
        [body.name, body.benefit, request.profile.id],
      );
      await audit(tx, request.profile.id, "campaign.create", r.rows[0]!.id);
      return r.rows[0];
    });
    reply.code(201);
    return campaign;
  });
  app.patch("/api/campaigns/:id/status", async (request) => {
    requireAdmin(request.profile);
    const id = uuid.parse((request.params as { id: string }).id);
    const { status } = z
      .object({ status: z.enum(["active", "closed"]) })
      .strict()
      .parse(request.body);
    await db.transaction(async (tx) => {
      await lockAdmin(tx, request.profile.id);
      const c = await tx.query(
        "select status from app.campaigns where id=$1 for update",
        [id],
      );
      if (!c.rows.length) throw new AppError("NOT_FOUND", 404);
      if (status === "active") {
        const counts = await tx.query(
          "select exists(select 1 from app.campaign_people where campaign_id=$1) people,exists(select 1 from app.assignments a join app.profiles p on p.id=a.user_id join app.points pt on pt.id=a.point_id where a.campaign_id=$1 and p.active and pt.active) staff",
          [id],
        );
        if (!counts.rows[0]!.people || !counts.rows[0]!.staff)
          throw new AppError("CAMPAIGN_SETUP_REQUIRED", 409);
      }
      await tx.query("update app.campaigns set status=$2 where id=$1", [
        id,
        status,
      ]);
      await audit(tx, request.profile.id, "campaign.status", id, { status });
      await tx.query(
        "insert into public.delivery_events(campaign_id,kind) values($1,'campaign')",
        [id],
      );
    });
    return { ok: true };
  });
  app.get("/api/campaigns/:id/assignments", async (request) => {
    requireAdmin(request.profile);
    const id = uuid.parse((request.params as { id: string }).id);
    return (
      await db.query(
        "select a.user_id,p.display_name,a.point_id,pt.name point_name from app.assignments a join app.profiles p on p.id=a.user_id join app.points pt on pt.id=a.point_id where a.campaign_id=$1 order by p.display_name",
        [id],
      )
    ).rows;
  });
  app.put("/api/campaigns/:id/assignments", async (request) => {
    requireAdmin(request.profile);
    const id = uuid.parse((request.params as { id: string }).id);
    const { userId, pointId } = assignmentSchema.parse(request.body);
    await db.transaction(async (tx) => {
      await lockAdmin(tx, request.profile.id);
      await tx.query(
        "insert into app.assignments(campaign_id,user_id,point_id) values($1,$2,$3) on conflict(campaign_id,user_id) do update set point_id=excluded.point_id",
        [id, userId, pointId],
      );
      await audit(tx, request.profile.id, "assignment.set", id, {
        userId,
        pointId,
      });
      await tx.query(
        "insert into public.delivery_events(campaign_id,kind) values($1,'campaign')",
        [id],
      );
    });
    return { ok: true };
  });
}
