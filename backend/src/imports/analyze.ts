import type { ImportMapping, ImportIssue } from "@mazate/contracts";
import { dpiSchema } from "@mazate/contracts";
import type { Sheet } from "./workbook.js";
import { AppError } from "../lib/errors.js";
export interface ImportRow {
  dpi: string;
  full_name: string;
  extra: Record<string, string>;
  sector: string | null;
  age: number | null;
}
export function analyze(sheet: Sheet, mapping: ImportMapping) {
  const header = sheet.rows[mapping.headerRow - 1];
  if (!header) throw new AppError("INVALID_MAPPING");
  const indexes = [
    mapping.dpiColumn,
    ...mapping.nameColumns,
    ...[mapping.sectorColumn, mapping.ageColumn].filter(
      (n): n is number => n !== undefined,
    ),
  ];
  if (indexes.some((i) => i >= header.length))
    throw new AppError("INVALID_MAPPING");
  const seenHeaders = new Map<string, number>();
  const columns = header.map((cell, i) => {
    const raw = cell.text.trim() || `Columna ${i + 1}`;
    const count = (seenHeaders.get(raw) ?? 0) + 1;
    seenHeaders.set(raw, count);
    return `${i + 1}. ${raw}${count > 1 ? ` (${count})` : ""}`;
  });
  const candidates = sheet.rows
    .slice(mapping.headerRow)
    .map((cells, i) => ({ cells, row: mapping.headerRow + i + 1 }))
    .filter(({ cells }) => cells.some((c) => c.text !== ""));
  const counts = new Map<string, number>();
  for (const { cells } of candidates) {
    const parsed = dpiSchema.safeParse(cells[mapping.dpiColumn]?.text ?? "");
    if (parsed.success)
      counts.set(parsed.data, (counts.get(parsed.data) ?? 0) + 1);
  }
  const valid: ImportRow[] = [];
  const issues: ImportIssue[] = [];
  for (const { cells, row } of candidates) {
    const raw = cells[mapping.dpiColumn]?.text ?? "";
    const dpi = dpiSchema.safeParse(raw);
    const name = mapping.nameColumns
      .map((i) => cells[i]?.text ?? "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    let code: ImportIssue["code"] | undefined;
    if (indexes.some((i) => cells[i]?.formula)) code = "FORMULA_IDENTIFIER";
    else if (!dpi.success) code = "INVALID_DPI";
    else if (!name) code = "MISSING_NAME";
    else if (name.length > 300 || cells.some((c) => c.text.length > 2000))
      code = "OVERSIZED_VALUE";
    else if ((counts.get(dpi.data) ?? 0) > 1) code = "DUPLICATE_DPI";
    if (code) {
      issues.push({ row, code, dpi: raw.slice(0, 30) });
      continue;
    }
    valid.push({
      dpi: dpi.data!,
      full_name: name,
      sector:
        mapping.sectorColumn === undefined
          ? null
          : cells[mapping.sectorColumn]?.text.trim() || null,
      age:
        mapping.ageColumn !== undefined &&
        /^\d{1,3}$/.test(cells[mapping.ageColumn]?.text.trim() ?? "") &&
        Number(cells[mapping.ageColumn]?.text) <= 120
          ? Number(cells[mapping.ageColumn]?.text)
          : null,
      extra: Object.fromEntries(
        columns.map((key, i) => [key, cells[i]?.text ?? ""]),
      ),
    });
  }
  return { valid, issues, columns };
}
