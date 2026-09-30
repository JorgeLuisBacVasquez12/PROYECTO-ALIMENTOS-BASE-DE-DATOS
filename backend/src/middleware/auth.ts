import type { FastifyInstance } from "fastify";
import type { Profile } from "@mazate/contracts";
import type { Database } from "../db/database.js";
import { AppError } from "../lib/errors.js";
export type VerifyToken = (token: string) => Promise<string | null>;
declare module "fastify" {
  interface FastifyRequest {
    profile: Profile;
  }
}
export function installAuth(
  app: FastifyInstance,
  db: Database,
  verify: VerifyToken,
) {
  app.decorateRequest("profile", null as unknown as Profile);
  app.addHook("preHandler", async (request) => {
    if (request.routeOptions.url === "/health") return;
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ") || header.length > 8192)
      throw new AppError("UNAUTHORIZED", 401);
    const id = await verify(header.slice(7));
    if (!id) throw new AppError("UNAUTHORIZED", 401);
    const result = await db.query<Profile>(
      "select id,display_name,role,active from app.profiles where id=$1 and active",
      [id],
    );
    if (!result.rows[0]) throw new AppError("FORBIDDEN", 403);
    request.profile = result.rows[0];
  });
}
export function requireAdmin(profile: Profile) {
  if (profile.role !== "admin") throw new AppError("FORBIDDEN", 403);
}
