// Domain-level errors thrown by core write paths (Phase 5 clubs and later). Carry an
// HTTP status + stable code so the API error handler can map them to the standard
// { error: { code, message } } envelope without the routes each re-checking. Keeping
// authorization in core (not the routes) is what lets mobile reuse the same rules.
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

export const domainErrors = {
  notFound: (message = "Not found.") => new DomainError("not_found", message, 404),
  forbidden: (message = "Not allowed.") => new DomainError("forbidden", message, 403),
  conflict: (message: string) => new DomainError("conflict", message, 409),
  planRequired: () => new DomainError("plus_required", "This is a Foxing Plus feature.", 403),
  validation: (message = "Invalid request.") => new DomainError("validation", message, 422),
};
