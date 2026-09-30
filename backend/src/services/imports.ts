import type { Database } from "../db/database.js";
import type { Stage } from "../imports/store.js";
import type { ImportResult } from "@mazate/contracts";
import { AppError } from "../lib/errors.js";
import { lockAdmin, audit } from "./access.js";
export async function commitImport(
  db: Database,
  stage: Stage,
  skipInvalid: boolean,
): Promise<ImportResult> {
  const plan = stage.plan;
  if (!plan) throw new AppError("IMPORT_PREVIEW_REQUIRED");
  if (plan.analysis.issues.length && !skipInvalid)
    throw new AppError("IMPORT_REQUIRES_CONFIRMATION");
  if (!plan.analysis.valid.length) throw new AppError("IMPORT_EMPTY");
  return db.transaction(async (tx) => {
    await lockAdmin(tx, stage.actor);
    const c = await tx.query(
      "select status from app.campaigns where id=$1 for update",
      [plan.mapping.campaignId],
    );
    if (c.rows[0]?.status !== "draft")
      throw new AppError("IMPORT_DRAFT_ONLY", 409);
    const previous = await tx.query(
      "select result from app.imports where id=$1",
      [stage.id],
    );
    if (previous.rows[0]) return previous.rows[0].result as ImportResult;
    let created = 0;
    for (let offset = 0; offset < plan.analysis.valid.length; offset += 500) {
      const batch = plan.analysis.valid.slice(offset, offset + 500);
      const data = JSON.stringify(batch);
      const added = await tx.query(
        "insert into app.people(dpi,full_name) select dpi,full_name from jsonb_to_recordset($1::jsonb) as r(dpi text,full_name text) on conflict(dpi) do nothing returning id",
        [data],
      );
      created += added.rowCount ?? 0;
      await tx.query(
        "insert into app.campaign_people(campaign_id,person_id,full_name,extra) select $1,p.id,r.full_name,r.extra from jsonb_to_recordset($2::jsonb) as r(dpi text,full_name text,extra jsonb) join app.people p on p.dpi=r.dpi on conflict(campaign_id,person_id) do update set full_name=excluded.full_name,extra=excluded.extra",
        [plan.mapping.campaignId, data],
      );
    }
    const result = {
      imported: plan.analysis.valid.length,
      created,
      existing: plan.analysis.valid.length - created,
      skipped: plan.analysis.issues.length,
    };
    await tx.query(
      "insert into app.imports(id,campaign_id,actor_id,filename,mapping,result) values($1,$2,$3,$4,$5,$6)",
      [
        stage.id,
        plan.mapping.campaignId,
        stage.actor,
        stage.filename,
        JSON.stringify(plan.mapping),
        JSON.stringify(result),
      ],
    );
    await audit(
      tx,
      stage.actor,
      "roster.import",
      plan.mapping.campaignId,
      result,
    );
    await tx.query(
      "insert into public.delivery_events(campaign_id,kind) values($1,'roster')",
      [plan.mapping.campaignId],
    );
    return result;
  });
}
