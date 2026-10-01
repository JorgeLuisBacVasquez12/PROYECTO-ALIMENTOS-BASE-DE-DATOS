import { afterAll, beforeAll, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { randomUUID } from "node:crypto";
import { analyze } from "../backend/src/imports/analyze";
import { readWorkbook } from "../backend/src/imports/workbook";
import { commitImport } from "../backend/src/services/imports";
import { testDatabase, seed, ids, testConfig } from "./helpers/database";
import { createApp } from "../backend/src/app";
import type { ImportMapping } from "@mazate/contracts";
let database: Awaited<ReturnType<typeof testDatabase>>;
let app: Awaited<ReturnType<typeof createApp>>;
const campaign = randomUUID();
const mapping: ImportMapping = {
  campaignId: campaign,
  sheet: "Listado variable",
  headerRow: 2,
  dpiColumn: 2,
  nameColumns: [3, 1],
};
async function workbook() {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet(mapping.sheet);
  sheet.addRow(["Título del documento"]);
  sheet.addRow([
    "Teléfono",
    "Apellido",
    "CUI",
    "Nombres",
    "Comunidad",
    "Comunidad",
  ]);
  sheet.addRow([
    "12345678",
    "Vásquez",
    "0000000000011",
    "José Luis",
    "Centro",
    "Sector uno",
  ]);
  sheet.addRow(["", "López", "9000000000001", "María", "Norte", "Sector dos"]);
  sheet.addRow(["", "Duplicado", "0000000000013", "Persona", "", ""]);
  sheet.addRow(["", "Duplicado", "0000000000013", "Otra persona", "", ""]);
  sheet.addRow(["", "Inválido", "123", "Persona", "", ""]);
  sheet.addRow([
    "",
    "Fórmula",
    { formula: "1+2", result: 3 },
    "Persona",
    "",
    "",
  ]);
  sheet.addRow(["", "", "0000000000014", "", "", ""]);
  return Buffer.from(await book.xlsx.writeBuffer());
}
beforeAll(async () => {
  database = await testDatabase();
  await seed(database.db);
  await database.db.query(
    "insert into app.campaigns(id,name,benefit,created_by) values($1,$2,$3,$4)",
    [campaign, "Importación de prueba", "Porción", ids.admin],
  );
  app = await createApp({
    db: database.db,
    config: testConfig,
    verify: async (token) => (token === ids.admin ? token : null),
    users: {
      create: async () => randomUUID(),
      remove: async () => {},
      resetPassword: async () => {},
    },
  });
});
afterAll(async () => {
  await app?.close();
  await database?.db.close();
});
it("maps arbitrary columns, multiple name fields, accents and leading zeroes", async () => {
  const sheets = await readWorkbook(await workbook(), 50000, 150);
  const result = analyze(sheets[0]!, mapping);
  expect(result.valid).toHaveLength(2);
  expect(result.issues).toHaveLength(5);
  expect(result.valid[0]!.dpi).toBe("0000000000011");
  expect(result.valid[0]!.full_name).toBe("José Luis Vásquez");
  expect(new Set(result.columns).size).toBe(6);
  expect(Object.values(result.valid[0]!.extra)).toContain("Sector uno");
  expect(result.issues.filter((i) => i.code === "DUPLICATE_DPI")).toHaveLength(
    2,
  );
  expect(result.issues.some((i) => i.code === "FORMULA_IDENTIFIER")).toBe(true);
});
it("rejects a disguised file, oversized sheet and impossible mapping", async () => {
  await expect(
    readWorkbook(Buffer.from("not a workbook"), 50000, 150),
  ).rejects.toMatchObject({ code: "INVALID_WORKBOOK" });
  await expect(readWorkbook(await workbook(), 50000, 2)).rejects.toMatchObject({
    code: "WORKBOOK_TOO_LARGE",
  });
  const sheets = await readWorkbook(await workbook(), 50000, 150);
  expect(() => analyze(sheets[0]!, { ...mapping, headerRow: 99 })).toThrow(
    "INVALID_MAPPING",
  );
});
it("imports transactionally, requires explicit skipping and preserves previous campaigns and deliveries", async () => {
  const sheets = await readWorkbook(await workbook(), 50000, 150);
  const analysis = analyze(sheets[0]!, mapping);
  const stage = {
    id: randomUUID(),
    actor: ids.admin,
    filename: "ejemplo.xlsx",
    sheets,
    expires: Date.now() + 60000,
    plan: { id: randomUUID(), mapping, analysis },
  };
  await expect(commitImport(database.db, stage, false)).rejects.toMatchObject({
    code: "IMPORT_REQUIRES_CONFIRMATION",
  });
  const result = await commitImport(database.db, stage, true);
  expect(result).toEqual({ imported: 2, created: 1, existing: 1, skipped: 5 });
  expect(await commitImport(database.db, stage, true)).toEqual(result);
  const row = await database.db.query(
    "select cp.full_name from app.campaign_people cp join app.people p on p.id=cp.person_id where cp.campaign_id=$1 and p.dpi='9000000000001'",
    [ids.campaign],
  );
  expect(row.rows[0]!.full_name).toBe("Persona de prueba 1");
  const member = await database.db.query(
    "select count(*)::int n from app.campaign_people where campaign_id=$1",
    [campaign],
  );
  expect(member.rows[0]!.n).toBe(2);
  await database.db.query(
    "update app.campaigns set status='active' where id=$1",
    [campaign],
  );
  await expect(
    commitImport(database.db, { ...stage, id: randomUUID() }, true),
  ).rejects.toMatchObject({ code: "IMPORT_DRAFT_ONLY" });
});
it("accepts multipart upload and prevents commit before mapping review", async () => {
  const boundary = "mazate-test-boundary";
  const data = await workbook();
  const payload = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="padron.xlsx"\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`,
    ),
    data,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const response = await app.inject({
    method: "POST",
    url: "/api/imports/upload",
    headers: {
      authorization: `Bearer ${ids.admin}`,
      "content-type": `multipart/form-data; boundary=${boundary}`,
    },
    payload,
  });
  expect(response.statusCode).toBe(200);
  expect(response.json().sheets[0].name).toBe(mapping.sheet);
  const result = await app.inject({
    method: "POST",
    url: `/api/imports/${response.json().id}/commit`,
    headers: { authorization: `Bearer ${ids.admin}` },
    payload: { planId: randomUUID(), skipInvalid: true },
  });
  expect(result.statusCode).toBe(409);
});
it("keeps optional sector/age separate from original Excel columns and never guesses an invalid age", async () => {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Datos");
  sheet.addRows([
    ["DPI", "Nombre", "Sector", "Edad"],
    ["0000000000051", "Ana de prueba", " Norte ", 64],
    ["0000000000052", "Luis de prueba", "", "edad desconocida"],
    ["0000000000053", "María de prueba", "Centro", 130],
  ]);
  const sheets = await readWorkbook(
    Buffer.from(await book.xlsx.writeBuffer()),
    100,
    10,
  );
  const result = analyze(sheets[0]!, {
    campaignId: campaign,
    sheet: "Datos",
    headerRow: 1,
    dpiColumn: 0,
    nameColumns: [1],
    sectorColumn: 2,
    ageColumn: 3,
  });
  expect(
    result.valid.map((row) => ({ sector: row.sector, age: row.age })),
  ).toEqual([
    { sector: "Norte", age: 64 },
    { sector: null, age: null },
    { sector: "Centro", age: null },
  ]);
  expect(Object.values(result.valid[1]!.extra)).toContain("edad desconocida");
});
