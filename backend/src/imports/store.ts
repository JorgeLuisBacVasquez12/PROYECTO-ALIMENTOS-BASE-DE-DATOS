import { randomUUID } from "node:crypto";
import type { ImportMapping } from "@mazate/contracts";
import type { Sheet } from "./workbook.js";
import type { analyze } from "./analyze.js";
import { AppError } from "../lib/errors.js";
export interface Stage {
  id: string;
  actor: string;
  filename: string;
  sheets: Sheet[];
  expires: number;
  plan?: {
    id: string;
    mapping: ImportMapping;
    analysis: ReturnType<typeof analyze>;
  };
}
export class ImportStore {
  private stages = new Map<string, Stage>();
  constructor(private ttlMinutes: number) {}
  private prune() {
    for (const [key, stage] of this.stages)
      if (stage.expires < Date.now()) this.stages.delete(key);
  }
  add(actor: string, filename: string, sheets: Sheet[]) {
    this.prune();
    if (this.stages.size >= 12) throw new AppError("IMPORT_BUSY", 429);
    for (const [key, stage] of this.stages)
      if (stage.actor === actor) this.stages.delete(key);
    const size = (value: Sheet[]) =>
      value.reduce(
        (sum, s) =>
          sum +
          s.rows.reduce(
            (a, r) => a + r.reduce((b, c) => b + c.text.length * 2 + 64, 0),
            0,
          ),
        0,
      );
    if (
      size(sheets) +
        [...this.stages.values()].reduce((sum, s) => sum + size(s.sheets), 0) >
      128 * 1024 * 1024
    )
      throw new AppError("IMPORT_BUSY", 429);
    const stage: Stage = {
      id: randomUUID(),
      actor,
      filename,
      sheets,
      expires: Date.now() + this.ttlMinutes * 60000,
    };
    this.stages.set(stage.id, stage);
    return stage;
  }
  get(id: string, actor: string) {
    this.prune();
    const stage = this.stages.get(id);
    if (!stage || stage.actor !== actor)
      throw new AppError("IMPORT_EXPIRED", 404);
    return stage;
  }
  remove(id: string) {
    this.stages.delete(id);
  }
}
