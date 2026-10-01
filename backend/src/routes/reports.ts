import type { FastifyInstance } from "fastify";
import ExcelJS from "exceljs";
import { uuid } from "@mazate/contracts";
import type { Database } from "../db/database.js";
import type { Config } from "../config/env.js";
import { requireAdmin } from "../middleware/auth.js";
import { assertCampaign, audit } from "../services/access.js";
import { getReport, getStats, reportSchema } from "../services/reports.js";
import { AppError } from "../lib/errors.js";
export function reportRoutes(
  app: FastifyInstance,
  db: Database,
  config: Config,
) {
  app.get("/api/campaigns/:id/report-options", async (request) => {
    requireAdmin(request.profile);
    const id = uuid.parse((request.params as { id: string }).id);
    return {
      sectors: (
        await db.query(
          "select distinct sector from app.campaign_people where campaign_id=$1 and sector is not null order by sector",
          [id],
        )
      ).rows.map((r) => r.sector),
    };
  });
  app.get("/api/campaigns/:id/stats", async (request) => {
    const id = uuid.parse((request.params as { id: string }).id);
    await assertCampaign(db, request.profile, id);
    return getStats(db, id);
  });
  app.get("/api/campaigns/:id/report", async (request) => {
    requireAdmin(request.profile);
    const id = uuid.parse((request.params as { id: string }).id);
    return getReport(
      db,
      id,
      reportSchema.parse(request.query),
      config.APP_TIMEZONE,
    );
  });
  app.get(
    "/api/campaigns/:id/export",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      requireAdmin(request.profile);
      const id = uuid.parse((request.params as { id: string }).id);
      const report = await getReport(
        db,
        id,
        reportSchema.parse(request.query),
        config.APP_TIMEZONE,
        config.REPORT_MAX_ROWS,
      );
      if (report.total > config.REPORT_MAX_ROWS)
        throw new AppError("EXPORT_TOO_LARGE", 413);
      const book = new ExcelJS.Workbook();
      const sheet = book.addWorksheet("Entregas");
      const extras = [
        ...new Set(report.rows.flatMap((r) => Object.keys(r.extra))),
      ];
      sheet.addRow([
        "DPI",
        "Nombre",
        "Sector",
        "Edad según padrón",
        "Estado",
        "Fecha y hora",
        "Punto",
        "Registrado por",
        ...extras.map((k) => `Dato: ${k}`),
      ]);
      const format = new Intl.DateTimeFormat("es-GT", {
        timeZone: config.APP_TIMEZONE,
        dateStyle: "short",
        timeStyle: "medium",
      });
      for (const row of report.rows)
        sheet.addRow([
          row.dpi,
          row.full_name,
          row.sector ?? "",
          row.age ?? "",
          row.delivery_id ? "Entregado" : "Pendiente",
          row.delivered_at ? format.format(new Date(row.delivered_at)) : "",
          row.point_name ?? "",
          row.operator_name ?? "",
          ...extras.map((k) => row.extra[k] ?? ""),
        ]);
      sheet.columns.forEach((column, i) => {
        column.width = i === 1 ? 40 : 24;
        column.numFmt = "@";
      });
      sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      sheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF092C46" },
      };
      sheet.views = [{ state: "frozen", ySplit: 1 }];
      sheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: Math.max(1, sheet.rowCount), column: sheet.columnCount },
      };
      await audit(db, request.profile.id, "report.export", id, {
        rows: report.rows.length,
      });
      reply
        .type(
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        .header("Content-Disposition", 'attachment; filename="entregas.xlsx"');
      return Buffer.from(await book.xlsx.writeBuffer());
    },
  );
}
