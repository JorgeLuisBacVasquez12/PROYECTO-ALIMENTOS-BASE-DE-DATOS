import ExcelJS from "exceljs";
import yauzl from "yauzl";
import { AppError } from "../lib/errors.js";
export interface Cell {
  text: string;
  formula: boolean;
}
export interface Sheet {
  name: string;
  rows: Cell[][];
}
async function inspectZip(buffer: Buffer) {
  await new Promise<void>((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (error, zip) => {
      if (error || !zip) return reject(new AppError("INVALID_WORKBOOK"));
      let total = 0,
        entries = 0,
        expanded = 0;
      zip.on("error", () => reject(new AppError("INVALID_WORKBOOK")));
      zip.on("entry", (entry) => {
        total += entry.uncompressedSize;
        entries++;
        if (
          total > 80 * 1024 * 1024 ||
          entries > 3000 ||
          entry.fileName.endsWith("vbaProject.bin")
        ) {
          zip.close();
          reject(new AppError("WORKBOOK_TOO_LARGE", 413));
          return;
        }
        if (entry.fileName.endsWith("/")) {
          zip.readEntry();
          return;
        }
        zip.openReadStream(entry, (streamError, stream) => {
          if (streamError || !stream) {
            zip.close();
            reject(new AppError("INVALID_WORKBOOK"));
            return;
          }
          stream.on("data", (chunk) => {
            expanded += chunk.length;
            if (expanded > 80 * 1024 * 1024) {
              stream.destroy();
              zip.close();
              reject(new AppError("WORKBOOK_TOO_LARGE", 413));
            }
          });
          stream.on("error", () => {
            zip.close();
            reject(new AppError("INVALID_WORKBOOK"));
          });
          stream.on("end", () => zip.readEntry());
        });
      });
      zip.on("end", resolve);
      zip.readEntry();
    });
  });
}
function scalar(value: ExcelJS.CellValue): Cell {
  if (value === null || value === undefined)
    return { text: "", formula: false };
  if (value instanceof Date)
    return { text: value.toISOString(), formula: false };
  if (typeof value === "object") {
    if ("formula" in value || "sharedFormula" in value)
      return { text: String(value.result ?? ""), formula: true };
    if ("richText" in value)
      return {
        text: value.richText.map((v) => v.text).join(""),
        formula: false,
      };
    if ("text" in value) return { text: value.text, formula: false };
    return { text: "", formula: false };
  }
  return { text: String(value).trim(), formula: false };
}
export async function readWorkbook(
  buffer: Buffer,
  maxRows: number,
  maxColumns: number,
): Promise<Sheet[]> {
  await inspectZip(buffer);
  const book = new ExcelJS.Workbook();
  try {
    await book.xlsx.load(buffer as never);
  } catch {
    throw new AppError("INVALID_WORKBOOK");
  }
  if (!book.worksheets.length || book.worksheets.length > 20)
    throw new AppError("INVALID_WORKBOOK");
  let total = 0;
  return book.worksheets.map((sheet) => {
    total += sheet.rowCount;
    if (
      total > maxRows + 100 ||
      sheet.columnCount > maxColumns ||
      sheet.rowCount * sheet.columnCount > 500000
    )
      throw new AppError("WORKBOOK_TOO_LARGE", 413);
    const rows: Cell[][] = [];
    for (let r = 1; r <= sheet.rowCount; r++) {
      const row: Cell[] = [];
      for (let c = 1; c <= sheet.columnCount; c++)
        row.push(scalar(sheet.getCell(r, c).value));
      rows.push(row);
    }
    return { name: sheet.name, rows };
  });
}
