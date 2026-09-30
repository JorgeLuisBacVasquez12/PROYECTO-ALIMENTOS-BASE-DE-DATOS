import type { FastifyInstance } from "fastify";
import {
  pointSchema,
  createUserSchema,
  resetPasswordSchema,
  uuid,
} from "@mazate/contracts";
import { z } from "zod";
import type { Database } from "../db/database.js";
import { requireAdmin } from "../middleware/auth.js";
import { audit, lockAdmin } from "../services/access.js";
import { AppError } from "../lib/errors.js";
import { assignUser } from "../services/assignments.js";
export interface UserProvisioner {
  create(email: string, password: string): Promise<string>;
  remove(id: string): Promise<void>;
  resetPassword(id: string, password: string): Promise<void>;
}
export function adminRoutes(
  app: FastifyInstance,
  db: Database,
  users: UserProvisioner,
) {
  app.get("/api/users", async (request) => {
    requireAdmin(request.profile);
    return (
      await db.query(
        `select p.id,p.display_name,p.role,p.active,u.email,
        coalesce((select jsonb_agg(jsonb_build_object('campaign_id',c.id,'campaign_name',c.name,'point_id',pt.id,'point_name',pt.name) order by c.created_at desc)
          from app.assignments a join app.campaigns c on c.id=a.campaign_id join app.points pt on pt.id=a.point_id where a.user_id=p.id and c.status <> 'closed'), '[]'::jsonb) assignments
        from app.profiles p join auth.users u on u.id=p.id order by p.display_name`,
      )
    ).rows;
  });
  app.post(
    "/api/users",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      requireAdmin(request.profile);
      const body = createUserSchema.parse(request.body);
      const id = await users.create(body.email, body.password);
      try {
        await db.transaction(async (tx) => {
          await lockAdmin(tx, request.profile.id);
          await tx.query(
            "insert into app.profiles(id,display_name,role) values($1,$2,$3)",
            [id, body.displayName, body.role],
          );
          await audit(tx, request.profile.id, "user.create", id);
          if (body.assignment)
            await assignUser(
              tx,
              request.profile.id,
              body.assignment.campaignId,
              id,
              body.assignment.pointId,
            );
        });
      } catch (error) {
        await users.remove(id);
        throw error;
      }
      reply.code(201);
      return { id };
    },
  );
  app.post(
    "/api/users/:id/password",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request) => {
      requireAdmin(request.profile);
      const id = uuid.parse((request.params as { id: string }).id);
      const { password } = resetPasswordSchema.parse(request.body);
      if (id === request.profile.id) throw new AppError("USE_MY_ACCOUNT", 400);
      await db.transaction(async (tx) => {
        await lockAdmin(tx, request.profile.id);
        const target = await tx.query(
          "select active from app.profiles where id=$1 for update",
          [id],
        );
        if (!target.rows.length) throw new AppError("NOT_FOUND", 404);
        if (!target.rows[0]!.active) throw new AppError("USER_INACTIVE", 409);
        await audit(tx, request.profile.id, "user.password_reset", id);
        await users.resetPassword(id, password);
      });
      return { ok: true };
    },
  );
  app.patch("/api/users/:id", async (request) => {
    requireAdmin(request.profile);
    const id = uuid.parse((request.params as { id: string }).id);
    const { active } = z
      .object({ active: z.boolean() })
      .strict()
      .parse(request.body);
    if (id === request.profile.id) throw new AppError("CANNOT_DISABLE_SELF");
    await db.transaction(async (tx) => {
      await lockAdmin(tx, request.profile.id);
      const r = await tx.query(
        "update app.profiles set active=$2 where id=$1 returning id",
        [id, active],
      );
      if (!r.rows.length) throw new AppError("NOT_FOUND", 404);
      await audit(tx, request.profile.id, "user.status", id, { active });
    });
    return { ok: true };
  });
  app.post("/api/points", async (request, reply) => {
    requireAdmin(request.profile);
    const { name } = pointSchema.parse(request.body);
    const point = await db.transaction(async (tx) => {
      await lockAdmin(tx, request.profile.id);
      const result = await tx.query(
        "insert into app.points(name) values($1) returning *",
        [name],
      );
      await audit(tx, request.profile.id, "point.create", result.rows[0]!.id);
      return result.rows[0];
    });
    reply.code(201);
    return point;
  });
  app.get("/api/audit", async (request) => {
    requireAdmin(request.profile);
    const { page } = z
      .object({ page: z.coerce.number().int().min(1).default(1) })
      .strict()
      .parse(request.query);
    return (
      await db.query(
        "select a.id,a.action,a.entity_id,a.detail,a.created_at,p.display_name actor from app.audit_log a join app.profiles p on p.id=a.actor_id order by a.created_at desc,a.id desc limit 50 offset $1",
        [(page - 1) * 50],
      )
    ).rows;
  });
}
