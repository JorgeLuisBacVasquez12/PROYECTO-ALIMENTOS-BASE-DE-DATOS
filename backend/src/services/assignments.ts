import type { Executor } from "../db/database.js";
import { AppError } from "../lib/errors.js";
import { audit } from "./access.js";

export async function assignUser(
  tx: Executor,
  actorId: string,
  campaignId: string,
  userId: string,
  pointId: string,
) {
  const campaign = await tx.query(
    "select id from app.campaigns where id=$1 and status <> 'closed' for share",
    [campaignId],
  );
  const user = await tx.query(
    "select id from app.profiles where id=$1 and active for share",
    [userId],
  );
  const point = await tx.query(
    "select id from app.points where id=$1 and active for share",
    [pointId],
  );
  if (!campaign.rows.length || !user.rows.length || !point.rows.length)
    throw new AppError("INVALID_REFERENCE", 400);
  await tx.query(
    "insert into app.assignments(campaign_id,user_id,point_id,assigned_by) values($1,$2,$3,$4) on conflict(campaign_id,user_id) do update set point_id=excluded.point_id,assigned_at=now(),assigned_by=excluded.assigned_by,closed_at=null,closed_by=null",
    [campaignId, userId, pointId, actorId],
  );
  await audit(tx, actorId, "assignment.set", campaignId, { userId, pointId });
  await tx.query(
    "insert into public.delivery_events(campaign_id,kind) values($1,'campaign')",
    [campaignId],
  );
}
