import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { mappingSchema, uuid } from "@mazate/contracts";
import { z } from "zod";
import type { Database } from "../db/database.js";
import type { Config } from "../config/env.js";
import { requireAdmin } from "../middleware/auth.js";
import { AppError } from "../lib/errors.js";
import { readWorkbook } from "../imports/workbook.js";
import { analyze } from "../imports/analyze.js";
import { ImportStore } from "../imports/store.js";
import { commitImport } from "../services/imports.js";
export function importRoutes(
  app: FastifyInstance,
  db: Database,
  config: Config,
) {
  const store = new ImportStore(config.IMPORT_TTL_MINUTES);
  app.post(
    "/api/imports/upload",
    { config: { rateLimit: { max: 6, timeWindow: "1 minute" } } },
    async (request) => {
      requireAdmin(request.profile);
      const file = await request.file();
      if (!file || !file.filename.toLowerCase().endsWith(".xlsx"))
        throw new AppError("XLSX_REQUIRED");
      const buffer = await file.toBuffer();
      const sheets = await readWorkbook(
        buffer,
        config.IMPORT_MAX_ROWS,
        config.IMPORT_MAX_COLUMNS,
      );
      const stage = store.add(
        request.profile.id,
        file.filename.slice(0, 200),
        sheets,
      );
      return {
        id: stage.id,
        filename: stage.filename,
        expiresAt: new Date(stage.expires).toISOString(),
        sheets: sheets.map((s) => ({
          name: s.name,
          rows: s.rows.length,
          preview: s.rows
            .slice(0, 105)
            .map((r) => r.map((c) => c.text.slice(0, 200))),
        })),
      };
    },
  );
  app.post("/api/imports/:id/preview", async (request) => {
    requireAdmin(request.profile);
    const id = uuid.parse((request.params as { id: string }).id);
    const mapping = mappingSchema.parse(request.body);
    const stage = store.get(id, request.profile.id);
    const campaign = await db.query(
      "select status from app.campaigns where id=$1",
      [mapping.campaignId],
    );
    if (campaign.rows[0]?.status !== "draft")
      throw new AppError("IMPORT_DRAFT_ONLY", 409);
    const sheet = stage.sheets.find((s) => s.name === mapping.sheet);
    if (!sheet) throw new AppError("INVALID_MAPPING");
    const analysis = analyze(sheet, mapping);
    if (analysis.valid.length + analysis.issues.length > config.IMPORT_MAX_ROWS)
      throw new AppError("WORKBOOK_TOO_LARGE", 413);
    const planId = randomUUID();
    stage.plan = { id: planId, mapping, analysis };
    const dpis = analysis.valid.map((r) => r.dpi);
    const existing = (
      await db.query(
        "select count(*)::int count from app.people where dpi=any($1::text[])",
        [dpis],
      )
    ).rows[0]!.count;
    return {
      id: stage.id,
      planId,
      valid: analysis.valid.length,
      invalid: analysis.issues.length,
      existing,
      sample: analysis.valid
        .slice(0, 5)
        .map(({ dpi, full_name }) => ({ dpi, full_name })),
      issues: analysis.issues.slice(0, 100),
      issueCount: analysis.issues.length,
      columns: analysis.columns,
    };
  });
  app.get("/api/imports/:id/issues", async (request, reply) => {
    requireAdmin(request.profile);
    const stage = store.get(
      uuid.parse((request.params as { id: string }).id),
      request.profile.id,
    );
    if (!stage.plan) throw new AppError("IMPORT_PREVIEW_REQUIRED");
    // A JSON error report avoids executing spreadsheet formulas from invalid cells.
    reply.header(
      "Content-Disposition",
      'attachment; filename="incidencias-importacion.json"',
    );
    return stage.plan.analysis.issues;
  });
  app.post("/api/imports/:id/commit", async (request) => {
    requireAdmin(request.profile);
    const id = uuid.parse((request.params as { id: string }).id);
    const { skipInvalid, planId } = z
      .object({ skipInvalid: z.boolean(), planId: uuid })
      .strict()
      .parse(request.body);
    const prior = await db.query(
      "select result from app.imports where id=$1 and actor_id=$2",
      [id, request.profile.id],
    );
    if (prior.rows[0]) return prior.rows[0].result;
    const stage = store.get(id, request.profile.id);
    if (stage.plan?.id !== planId)
      throw new AppError("IMPORT_PREVIEW_REQUIRED", 409);
    const result = await commitImport(db, stage, skipInvalid);
    store.remove(id);
    return result;
  });
}
