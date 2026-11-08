/**
 * Typed application errors. Services throw these; the API layer maps them to HTTP responses
 * using `httpStatus` and `code` so the UI and REST API report failures the same way.
 */
export type AppErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "validation_failed"
  | "rate_limited"
  | "internal";

const STATUS_BY_CODE: Record<AppErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  validation_failed: 422,
  rate_limited: 429,
  internal: 500,
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly httpStatus: number;
  readonly field?: string;

  constructor(code: AppErrorCode, message: string, options?: { field?: string; cause?: unknown }) {
    super(message, { cause: options?.cause });
    this.name = "AppError";
    this.code = code;
    this.httpStatus = STATUS_BY_CODE[code];
    this.field = options?.field;
  }

  toJSON() {
    return { code: this.code, message: this.message, ...(this.field ? { field: this.field } : {}) };
  }
}

export const notFound = (what: string) => new AppError("not_found", `${what} not found`);
export const forbidden = (message = "You don't have permission to do that") =>
  new AppError("forbidden", message);

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
