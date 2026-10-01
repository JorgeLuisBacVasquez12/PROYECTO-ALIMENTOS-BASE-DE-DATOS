import type { FastifyInstance } from "fastify";
import { assignmentSchema, campaignSchema, uuid } from "@mazate/contracts";
import { z } from "zod";
import type { Database } from "../db/database.js";
import { requireAdmin } from "../middleware/auth.js";
import { audit, lockAdmin } from "../services/access.js";
import { AppError } from "../lib/errors.js";
import { assignUser } from "../services/assignments.js";
import { changeCampaignStatus, closeShift } from "../services/jornadas.js";

export function campaignRoutes(app: FastifyInstance, db: Database) {
  app.get("/api/bootstrap", async (request) => {
    const [campaigns, points] = await Promise.all([
      db.query(
        `select c.*,a.point_id,p.name point_name,a.closed_at shift_closed_at,closer.display_name closed_by_name,
        (select count(*)::int from app.campaign_people cp where cp.campaign_id=c.id) eligible,
        (select count(*)::int from app.deliveries d where d.campaign_id=c.id and d.voided_at is null) delivered,
        (select count(*)::int from app.assignments x join app.profiles u on u.id=x.user_id where x.campaign_id=c.id and u.active) employee_count,
        (select count(*)::int from app.assignments x join app.profiles u on u.id=x.user_id where x.campaign_id=c.id and x.closed_at is null and u.active) open_shifts
        from app.campaigns c left join app.assignments a on a.campaign_id=c.id and a.user_id=$1
        left join app.points p on p.id=a.point_id left join app.profiles closer on closer.id=c.closed_by
        where $2::boolean or a.user_id=$1 order by c.created_at desc,c.id`,
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
      const created = (
        await tx.query(
          "insert into app.campaigns(name,benefit,created_by) values($1,$2,$3) returning *",
          [body.name, body.benefit, request.profile.id],
        )
      ).rows[0]!;
      if (body.rosterSourceId) {
        const source = await tx.query(
          "select id from app.campaigns where id=$1 for share",
          [body.rosterSourceId],
        );
        if (!source.rows.length) throw new AppError("INVALID_REFERENCE", 400);
        await tx.query(
          "insert into app.campaign_people(campaign_id,person_id,full_name,extra,sector,age) select $1,person_id,full_name,extra,sector,age from app.campaign_people where campaign_id=$2",
          [created.id, body.rosterSourceId],
        );
      }
      await audit(tx, request.profile.id, "campaign.create", created.id, {
        name: body.name,
        benefit: body.benefit,
        rosterSourceId: body.rosterSourceId,
      });
      return created;
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
    return changeCampaignStatus(db, request.profile.id, id, status);
  });
  app.post("/api/campaigns/:id/shift/close", async (request) => {
    const id = uuid.parse((request.params as { id: string }).id);
    return db.transaction((tx) =>
      closeShift(tx, request.profile.id, id, request.profile.id),
    );
  });
  app.get("/api/campaigns/:id/assignments", async (request) => {
    requireAdmin(request.profile);
    const id = uuid.parse((request.params as { id: string }).id);
    return (
      await db.query(
        `select a.user_id,p.display_name,a.point_id,pt.name point_name,a.assigned_at,a.closed_at,closer.display_name closed_by_name,
      (select count(*)::int from app.deliveries d where d.campaign_id=a.campaign_id and d.operator_id=a.user_id and d.voided_at is null) delivered
      from app.assignments a join app.profiles p on p.id=a.user_id join app.points pt on pt.id=a.point_id left join app.profiles closer on closer.id=a.closed_by
      where a.campaign_id=$1 order by p.display_name`,
        [id],
      )
    ).rows;
  });
  app.put("/api/campaigns/:id/assignments", async (request) => {
    requireAdmin(request.profile);
    const id = uuid.parse((request.params as { id: string }).id);
    const body = z
      .union([
        assignmentSchema,
        z
          .object({ assignments: z.array(assignmentSchema).min(1).max(100) })
          .strict(),
      ])
      .parse(request.body);
    const assignments = "assignments" in body ? body.assignments : [body];
    if (new Set(assignments.map((a) => a.userId)).size !== assignments.length)
      throw new AppError("INVALID_INPUT");
    await db.transaction(async (tx) => {
      await lockAdmin(tx, request.profile.id);
      for (const a of [...assignments].sort((a, b) =>
        a.userId.localeCompare(b.userId),
      ))
        await assignUser(tx, request.profile.id, id, a.userId, a.pointId);
    });
    return { ok: true };
  });
}
