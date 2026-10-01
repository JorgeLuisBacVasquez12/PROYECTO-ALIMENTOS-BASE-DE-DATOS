import type { Database, Executor } from "../db/database.js";
import { AppError } from "../lib/errors.js";
import { audit, lockAdmin } from "./access.js";

export async function closeShift(
  tx: Executor,
  actorId: string,
  campaignId: string,
  userId: string,
) {
  // Matches register_delivery's campaign -> assignment lock order.
  const campaign = await tx.query(
    "select id,status from app.campaigns where id=$1 for share",
    [campaignId],
  );
  if (!campaign.rows.length) throw new AppError("NOT_FOUND", 404);
  const current = await tx.query(
    "select a.closed_at,a.point_id,p.name point_name,u.display_name from app.assignments a join app.points p on p.id=a.point_id join app.profiles u on u.id=a.user_id where a.campaign_id=$1 and a.user_id=$2 for update of a",
    [campaignId, userId],
  );
  const shift = current.rows[0];
  if (!shift) throw new AppError("FORBIDDEN", 403);
  if (shift.closed_at) return { closed_at: shift.closed_at };
  if (campaign.rows[0]!.status !== "active")
    throw new AppError("CAMPAIGN_NOT_ACTIVE", 409);
  const result = await tx.query(
    "update app.assignments set closed_at=now(),closed_by=$3 where campaign_id=$1 and user_id=$2 returning closed_at",
    [campaignId, userId, actorId],
  );
  await audit(tx, actorId, "shift.close", campaignId, {
    userId,
    employeeName: shift.display_name,
    pointId: shift.point_id,
    pointName: shift.point_name,
  });
  await tx.query(
    "insert into public.delivery_events(campaign_id,kind) values($1,'campaign')",
    [campaignId],
  );
  return result.rows[0];
}

export async function changeCampaignStatus(
  db: Database,
  actor: string,
  id: string,
  status: "active" | "closed",
) {
  return db.transaction(async (tx) => {
    await lockAdmin(tx, actor);
    const current = (
      await tx.query(
        "select status from app.campaigns where id=$1 for update",
        [id],
      )
    ).rows[0];
    if (!current) throw new AppError("NOT_FOUND", 404);
    if (current.status === status) return { ok: true };
    if (status === "active") {
      const counts = (
        await tx.query(
          "select exists(select 1 from app.campaign_people where campaign_id=$1) people, exists(select 1 from app.assignments a join app.profiles p on p.id=a.user_id join app.points pt on pt.id=a.point_id where a.campaign_id=$1 and p.active and pt.active) staff",
          [id],
        )
      ).rows[0]!;
      if (!counts.people || !counts.staff)
        throw new AppError("CAMPAIGN_SETUP_REQUIRED", 409);
      if (current.status === "closed")
        await tx.query(
          "update app.assignments set closed_at=null,closed_by=null,assigned_at=now() where campaign_id=$1",
          [id],
        );
      await tx.query(
        "update app.campaigns set status='active',started_at=now(),closed_at=null,closed_by=null where id=$1",
        [id],
      );
    } else {
      const assignments = await tx.query(
        "select user_id from app.assignments where campaign_id=$1 and closed_at is null order by user_id",
        [id],
      );
      for (const a of assignments.rows)
        await closeShift(tx, actor, id, String(a.user_id));
      await tx.query(
        "update app.campaigns set status='closed',closed_at=now(),closed_by=$2 where id=$1",
        [id, actor],
      );
    }
    await audit(tx, actor, "campaign.status", id, {
      status,
      previousStatus: current.status,
    });
    await tx.query(
      "insert into public.delivery_events(campaign_id,kind) values($1,'campaign')",
      [id],
    );
    return { ok: true };
  });
}
