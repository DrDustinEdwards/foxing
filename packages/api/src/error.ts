// Every failure answers as RFC 9457 problem details (site-runtime ./http-errors):
// { type, title, status, detail, code, ...extensions }. Clients branch on `code` and show `detail`.
import {
  AppError,
  errors as shared,
  honoErrorHandler,
} from "@dustinedwards/site-runtime/http-errors";

export { AppError };

export const errors = {
  ...shared,
  planRequired: () => new AppError(403, "plus_required", "This is a Foxing Plus feature."),
  quotaExceeded: (resetsAt: string) =>
    new AppError(429, "quota", "Daily AI usage limit reached.", { resets_at: resetsAt }),
};

// AppError, core's DomainError and any thrown error with a status and code answer as they say; a
// ZodError is a 422 `validation` with its issues as `errors`; anything else is logged as
// api_unhandled with the request id and answered 500.
export const errorHandler = honoErrorHandler();
