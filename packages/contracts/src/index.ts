import { z } from "zod";

export const uuid = z.string().uuid();
export const dpiSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ""))
  .pipe(z.string().regex(/^\d{13}$/));
export const lookupSchema = z
  .object({ campaignId: uuid, dpi: dpiSchema })
  .strict();
export const deliverySchema = lookupSchema.extend({ requestId: uuid });
export const campaignSchema = z
  .object({
    name: z.string().trim().min(3).max(120),
    benefit: z.string().trim().min(2).max(120),
    rosterSourceId: uuid.optional(),
  })
  .strict();
export const pointSchema = z
  .object({ name: z.string().trim().min(2).max(100) })
  .strict();
export const assignmentSchema = z
  .object({ userId: uuid, pointId: uuid })
  .strict();
export const passwordSchema = z.string().min(12).max(128);
export const userSchema = z
  .object({
    email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
    displayName: z.string().trim().min(3).max(100),
    role: z.enum(["admin", "operator"]),
    password: passwordSchema,
  })
  .strict();
export const createUserSchema = userSchema.extend({
  role: z.literal("operator").default("operator"),
  assignment: z.object({ campaignId: uuid, pointId: uuid }).strict().optional(),
});
export const resetPasswordSchema = z
  .object({ password: passwordSchema })
  .strict();
export const mappingSchema = z
  .object({
    campaignId: uuid,
    sheet: z.string().min(1).max(200),
    headerRow: z.number().int().min(1).max(100),
    dpiColumn: z.number().int().min(0).max(199),
    nameColumns: z.array(z.number().int().min(0).max(199)).min(1).max(8),
    sectorColumn: z.number().int().min(0).max(199).optional(),
    ageColumn: z.number().int().min(0).max(199).optional(),
  })
  .strict()
  .refine(
    (v) =>
      !v.nameColumns.includes(v.dpiColumn) &&
      new Set([
        v.dpiColumn,
        ...v.nameColumns,
        ...[v.sectorColumn, v.ageColumn].filter(
          (n): n is number => n !== undefined,
        ),
      ]).size ===
        1 +
          v.nameColumns.length +
          Number(v.sectorColumn !== undefined) +
          Number(v.ageColumn !== undefined),
  );
export type ImportMapping = z.infer<typeof mappingSchema>;
export type Role = "admin" | "operator";
export interface Profile {
  id: string;
  display_name: string;
  role: Role;
  active: boolean;
}
export interface TeamUser extends Profile {
  email: string | null;
  assignments: {
    campaign_id: string;
    campaign_name: string;
    point_id: string;
    point_name: string;
  }[];
}
export interface Point {
  id: string;
  name: string;
  active: boolean;
}
export interface Campaign {
  id: string;
  name: string;
  benefit: string;
  status: "draft" | "active" | "closed";
  point_id: string | null;
  point_name: string | null;
  shift_closed_at: string | null;
  closed_at: string | null;
  closed_by_name: string | null;
  created_at: string;
  eligible: number;
  delivered: number;
  employee_count: number;
  open_shifts: number;
}
export interface Bootstrap {
  profile: Profile;
  campaigns: Campaign[];
  points: Point[];
}
export interface Person {
  id: string;
  dpi: string;
  full_name: string;
  sector?: string | null;
  age?: number | null;
}
export interface Delivery {
  id: string;
  person_id: string;
  campaign_id: string;
  dpi: string;
  recipient_name: string;
  point_name: string;
  operator_name: string;
  delivered_at: string;
  voided_at: string | null;
}
export interface Lookup {
  state: "available" | "delivered" | "not_found";
  person: Person | null;
  delivery: Delivery | null;
}
export interface DeliveryResult {
  outcome: "registered" | "already_delivered" | "replayed";
  delivery: Delivery;
}
export interface Stats {
  eligible: number;
  delivered: number;
  pending: number;
}
export interface ReportRow extends Person {
  extra: Record<string, string>;
  delivery_id: string | null;
  point_name: string | null;
  operator_name: string | null;
  delivered_at: string | null;
}
export interface Report {
  rows: ReportRow[];
  total: number;
  stats: Stats;
  page: number;
  pageSize: number;
}
export interface SheetPreview {
  name: string;
  rows: number;
  preview: string[][];
}
export interface UploadPreview {
  id: string;
  filename: string;
  sheets: SheetPreview[];
  expiresAt: string;
}
export interface ImportIssue {
  row: number;
  code:
    | "INVALID_DPI"
    | "MISSING_NAME"
    | "DUPLICATE_DPI"
    | "FORMULA_IDENTIFIER"
    | "OVERSIZED_VALUE";
  dpi: string;
}
export interface ImportPlan {
  id: string;
  planId: string;
  valid: number;
  invalid: number;
  existing: number;
  sample: { dpi: string; full_name: string }[];
  issues: ImportIssue[];
  issueCount: number;
  columns: string[];
}
export interface ImportResult {
  imported: number;
  created: number;
  existing: number;
  skipped: number;
}
export interface Assignment {
  user_id: string;
  display_name: string;
  point_id: string;
  point_name: string;
  assigned_at: string;
  closed_at: string | null;
  closed_by_name: string | null;
  delivered: number;
}
export interface HistoryEvent {
  id: string;
  action: string;
  actor: string;
  created_at: string;
  campaign_name: string | null;
  recipient_name: string | null;
  dpi: string | null;
  point_name: string | null;
  detail: Record<string, unknown>;
}
export interface HistoryReport {
  rows: HistoryEvent[];
  total: number;
  page: number;
  pageSize: number;
}
export interface ApiErrorBody {
  code: string;
  requestId?: string;
}
