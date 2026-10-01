export class AppError extends Error {
  constructor(
    public code: string,
    public status = 400,
  ) {
    super(code);
  }
}
export const databaseErrors: Record<string, number> = {
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  POINT_REQUIRED: 403,
  INVALID_DPI: 400,
  IDEMPOTENCY_MISMATCH: 409,
  DELIVERY_VOIDED: 409,
  CAMPAIGN_NOT_ACTIVE: 409,
  SHIFT_CLOSED: 409,
  NOT_ELIGIBLE: 404,
  INVALID_REASON: 400,
};
