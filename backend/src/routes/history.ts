import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { uuid } from "@mazate/contracts";
import type { Database } from "../db/database.js";
import { requireAdmin } from "../middleware/auth.js";

export function historyRoutes(
  app: FastifyInstance,
  db: Database,
  timezone: string,
) {
  app.get("/api/history", async (request) => {
    requireAdmin(request.profile);
    const f = z
      .object({
        campaignId: uuid.optional(),
        kind: z.enum(["all", "delivery", "closure"]).default("all"),
        q: z.string().trim().max(120).default(""),
        from: z.iso.date().optional(),
        to: z.iso.date().optional(),
        page: z.coerce.number().int().min(1).max(100000).default(1),
      })
      .strict()
      .refine((v) => !v.from || !v.to || v.from <= v.to)
      .parse(request.query);
    return db.transaction(async (tx) => {
      await tx.query(
        "set transaction isolation level repeatable read read only",
      );
      const params: unknown[] = [];
      const bind = (v: unknown) => {
        params.push(v);
        return `$${params.length}`;
      };
      const rules = [
        "(a.action in ('delivery.register','delivery.void','shift.close') or (a.action='campaign.status' and a.detail->>'status'='closed'))",
      ];
      if (f.campaignId) rules.push(`c.id=${bind(f.campaignId)}`);
      if (f.kind === "delivery")
        rules.push("a.action in ('delivery.register','delivery.void')");
      if (f.kind === "closure")
        rules.push("a.action in ('shift.close','campaign.status')");
      if (f.from)
        rules.push(
          `a.created_at>=(${bind(f.from)}::date::timestamp at time zone ${bind(timezone)})`,
        );
      if (f.to)
        rules.push(
          `a.created_at<((${bind(f.to)}::date+1)::timestamp at time zone ${bind(timezone)})`,
        );
      if (f.q) {
        const value = bind(`%${f.q.replace(/[\\%_]/g, "\\$&")}%`);
        rules.push(
          `(d.dpi ilike ${value} or d.recipient_name ilike ${value} or actor.display_name ilike ${value} or a.detail->>'employeeName' ilike ${value})`,
        );
      }
      const base = `from app.audit_log a join app.profiles actor on actor.id=a.actor_id left join app.deliveries d on d.id=a.entity_id and a.action in ('delivery.register','delivery.void') left join app.campaigns c on c.id=coalesce(d.campaign_id,a.entity_id) where ${rules.join(" and ")}`;
      const total = (
        await tx.query(`select count(*)::int total ${base}`, params)
      ).rows[0]!.total;
      const rows = (
        await tx.query(
          `select a.id::text,a.action,a.created_at,a.detail,actor.display_name actor,c.name campaign_name,d.dpi,d.recipient_name,coalesce(d.point_name,a.detail->>'pointName') point_name ${base} order by a.created_at desc,a.id desc limit 25 offset ${bind((f.page - 1) * 25)}`,
          params,
        )
      ).rows;
      return { rows, total, page: f.page, pageSize: 25 };
    });
  });
}
