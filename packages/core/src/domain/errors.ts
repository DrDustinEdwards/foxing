// Domain errors thrown by core write paths. They carry an HTTP status + stable code so the API error handler maps them to problem details
// (site-runtime ./http-errors); keeping authorization in core is what lets mobile reuse the rules.
export class DomainError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

/** D1 reports a unique index violation in the error message; nothing else is matched. */
export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Error && /UNIQUE constraint failed/i.test(error.message);
}

export const domainErrors = {
  notFound: (message = "Not found.") => new DomainError("not_found", message, 404),
  forbidden: (message = "Not allowed.") => new DomainError("forbidden", message, 403),
  conflict: (message: string) => new DomainError("conflict", message, 409),
  planRequired: () => new DomainError("plus_required", "This is a Foxing Plus feature.", 403),
  validation: (message = "Invalid request.") => new DomainError("validation", message, 422),
};
