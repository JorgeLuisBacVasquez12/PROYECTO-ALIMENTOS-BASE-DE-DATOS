import { z } from "zod";
import {
  uuid,
  type Report,
  type Stats,
  type ReportRow,
} from "@mazate/contracts";
import type { Database, Executor } from "../db/database.js";
export const reportSchema = z
  .object({
    q: z.string().trim().max(120).default(""),
    status: z.enum(["all", "delivered", "pending"]).default("all"),
    pointId: uuid.optional(),
    operatorId: uuid.optional(),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict()
  .refine((v) => !v.from || !v.to || v.from <= v.to);
export type ReportFilters = z.infer<typeof reportSchema>;
export async function getStats(db: Executor, id: string): Promise<Stats> {
  const r = await db.query(
    "select count(*)::int eligible,count(d.id)::int delivered,(count(*)-count(d.id))::int pending from app.campaign_people cp left join app.deliveries d on d.campaign_id=cp.campaign_id and d.person_id=cp.person_id and d.voided_at is null where cp.campaign_id=$1",
    [id],
  );
  return r.rows[0] as Stats;
}
export async function getReport(
  db: Database,
  id: string,
  f: ReportFilters,
  timezone: string,
  exportLimit?: number,
): Promise<Report> {
  return db.transaction(async (tx) => {
    await tx.query("set transaction isolation level repeatable read read only");
    const params: unknown[] = [id];
    const conditions = ["cp.campaign_id=$1"];
    const bind = (value: unknown) => {
      params.push(value);
      return `$${params.length}`;
    };
    if (f.q) {
      const v = bind(`%${f.q.replace(/[\\%_]/g, "\\$&")}%`);
      conditions.push(`(cp.full_name ilike ${v} or p.dpi ilike ${v})`);
    }
    if (f.status === "delivered") conditions.push("d.id is not null");
    if (f.status === "pending") conditions.push("d.id is null");
    if (f.pointId) conditions.push(`d.point_id=${bind(f.pointId)}`);
    if (f.operatorId) conditions.push(`d.operator_id=${bind(f.operatorId)}`);
    if (f.from)
      conditions.push(
        `d.delivered_at>=(${bind(f.from)}::date::timestamp at time zone ${bind(timezone)})`,
      );
    if (f.to)
      conditions.push(
        `d.delivered_at<((${bind(f.to)}::date+1)::timestamp at time zone ${bind(timezone)})`,
      );
    const base = `from app.campaign_people cp join app.people p on p.id=cp.person_id left join app.deliveries d on d.campaign_id=cp.campaign_id and d.person_id=cp.person_id and d.voided_at is null where ${conditions.join(" and ")}`;
    const total = (await tx.query(`select count(*)::int total ${base}`, params))
      .rows[0]!.total as number;
    const pageSize = exportLimit ?? f.pageSize;
    const rows = (
      await tx.query<ReportRow>(
        `select p.id,p.dpi,cp.full_name,cp.extra,d.id delivery_id,d.point_name,d.operator_name,d.delivered_at ${base} order by cp.full_name,p.id limit ${bind(pageSize)} offset ${bind(exportLimit ? 0 : (f.page - 1) * pageSize)}`,
        params,
      )
    ).rows;
    return {
      rows,
      total,
      stats: await getStats(tx, id),
      page: f.page,
      pageSize,
    };
  });
}
