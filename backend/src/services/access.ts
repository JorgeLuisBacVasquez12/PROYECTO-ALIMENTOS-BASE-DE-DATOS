import type { Profile } from "@mazate/contracts";
import type { Executor } from "../db/database.js";
import { AppError } from "../lib/errors.js";
export async function assertCampaign(
  db: Executor,
  profile: Profile,
  campaignId: string,
) {
  const result = await db.query(
    "select id from app.campaigns where id=$1 and ($2::boolean or (status='active' and exists(select 1 from app.assignments where campaign_id=$1 and user_id=$3 and closed_at is null)))",
    [campaignId, profile.role === "admin", profile.id],
  );
  if (!result.rows.length) throw new AppError("FORBIDDEN", 403);
}
export async function lockAdmin(db: Executor, id: string) {
  const result = await db.query(
    "select id from app.profiles where id=$1 and active and role='admin' for share",
    [id],
  );
  if (!result.rows.length) throw new AppError("FORBIDDEN", 403);
}
export async function audit(
  db: Executor,
  actor: string,
  action: string,
  entity: string,
  detail: unknown = {},
) {
  await db.query(
    "insert into app.audit_log(actor_id,action,entity_id,detail) values($1,$2,$3,$4)",
    [actor, action, entity, JSON.stringify(detail)],
  );
}
