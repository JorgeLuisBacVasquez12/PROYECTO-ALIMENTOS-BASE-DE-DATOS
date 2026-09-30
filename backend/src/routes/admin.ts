import type { FastifyInstance } from "fastify";
import { pointSchema, userSchema, uuid } from "@mazate/contracts";
import { z } from "zod";
import type { Database } from "../db/database.js";
import { requireAdmin } from "../middleware/auth.js";
import { audit, lockAdmin } from "../services/access.js";
import { AppError } from "../lib/errors.js";
export interface UserProvisioner {
  create(email: string, password: string): Promise<string>;
  remove(id: string): Promise<void>;
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
        "select id,display_name,role,active from app.profiles order by display_name",
      )
    ).rows;
  });
  app.post(
    "/api/users",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      requireAdmin(request.profile);
      const body = userSchema.parse(request.body);
      const id = await users.create(body.email, body.password);
      try {
        await db.transaction(async (tx) => {
          await lockAdmin(tx, request.profile.id);
          await tx.query(
            "insert into app.profiles(id,display_name,role) values($1,$2,$3)",
            [id, body.displayName, body.role],
          );
          await audit(tx, request.profile.id, "user.create", id);
        });
      } catch (error) {
        await users.remove(id);
        throw error;
      }
      reply.code(201);
      return { id };
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
